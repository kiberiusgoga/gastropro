import express from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import net from 'net';
import pool from './db';
import { deductForOrderItem, restoreForOrderItem } from './services/inventoryDeductionService';
import { authenticateToken, AuthRequest, authorizeRole, generateAccessToken, generateRefreshToken, verifyRefreshToken, verifyAccessToken } from './auth';
import { sseAdd, sseRemove, sseBroadcast } from './lib/sse';
import { asyncHandler } from './middleware/errorMiddleware';
import { AuthenticationError, NotFoundError, ValidationError, ConflictError } from './lib/errors';
import { z } from 'zod';
import logger from './lib/logger';

const router = express.Router();

// --- VALIDATION SCHEMAS ---

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const setupSchema = z.object({
  restaurantName: z.string().min(2),
  userName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
});

const categorySchema = z.object({
  name: z.string().min(2).max(50),
});

const productSchema = z.object({
  name: z.string().min(2).max(100),
  barcode: z.string().optional(),
  unit: z.string().min(1),
  purchase_price: z.number().nonnegative(),
  selling_price: z.number().nonnegative(),
  category_id: z.string().uuid(),
  min_stock: z.number().nonnegative().default(0),
  active: z.boolean().optional().default(true),
});

const invoiceItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().positive(),
  price: z.number().nonnegative(),
});

const invoiceSchema = z.object({
  invoice_number: z.string().min(1),
  supplier_name: z.string().min(1),
  date: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  items: z.array(invoiceItemSchema).min(1),
});

// --- RESTAURANT SETUP ---

router.post('/restaurants/setup', asyncHandler(async (req, res) => {
  const { restaurantName, userName, email, password } = setupSchema.parse(req.body);
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Check if email exists
    const emailCheck = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (emailCheck.rowCount && emailCheck.rowCount > 0) {
       throw new ConflictError('User email already exists');
    }

    const restResult = await client.query(
      'INSERT INTO restaurants (name) VALUES ($1) RETURNING id',
      [restaurantName]
    );
    const restaurantId = restResult.rows[0].id;
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const userResult = await client.query(
      'INSERT INTO users (name, email, role, password_hash, restaurant_id) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, restaurant_id',
      [userName, email, 'Admin', hashedPassword, restaurantId]
    );
    const user = userResult.rows[0];

    await client.query('COMMIT');
    
    const userData = { id: user.id, email: user.email, role: user.role, restaurantId: user.restaurant_id };
    const accessToken = generateAccessToken(userData);
    const refreshToken = generateRefreshToken(userData);

    res.status(201).json({ 
      accessToken, 
      refreshToken, 
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        restaurantId: user.restaurant_id
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

router.get('/restaurants/:id', authenticateToken, asyncHandler(async (req: AuthRequest, res) => {
  if (req.params.id !== req.user?.restaurantId) {
    throw new AuthenticationError('Unauthorized access to restaurant');
  }
  const result = await pool.query('SELECT * FROM restaurants WHERE id = $1', [req.params.id]);
  if (result.rowCount === 0) throw new NotFoundError('Restaurant not found');
  res.json(result.rows[0]);
}));

router.put('/restaurants/:id', authenticateToken, asyncHandler(async (req: AuthRequest, res) => {
  if (req.params.id !== req.user?.restaurantId) {
    throw new AuthenticationError('Unauthorized access to restaurant');
  }
  const { name, address, phone, tax_number, currency, timezone } = req.body;
  const result = await pool.query(
    `UPDATE restaurants SET name=$1, address=$2, phone=$3, tax_number=$4, currency=$5, timezone=$6
     WHERE id=$7 RETURNING *`,
    [name, address ?? null, phone ?? null, tax_number ?? null, currency ?? 'MKD', timezone ?? 'Europe/Skopje', req.params.id],
  );
  if (result.rowCount === 0) throw new NotFoundError('Restaurant not found');
  res.json(result.rows[0]);
}));

router.put('/auth/change-password', authenticateToken, asyncHandler(async (req: AuthRequest, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || newPassword.length < 6) {
    throw new ValidationError('Invalid password data');
  }
  const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [req.user?.id]);
  if (!userRes.rowCount) throw new NotFoundError('User not found');
  const valid = await bcrypt.compare(currentPassword, userRes.rows[0].password_hash);
  if (!valid) throw new AuthenticationError('Current password is incorrect');
  const hash = await bcrypt.hash(newPassword, 10);
  await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.user?.id]);
  res.json({ message: 'Password updated' });
}));

// --- AUTH ---

const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
  handler: (req, res, _next, options) => {
    logger.warn('Rate limit hit on /auth/login', { ip: req.ip });
    res.status(429).json(options.message);
  },
});

router.post('/auth/login', loginRateLimit, asyncHandler(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  
  const result = await pool.query('SELECT * FROM users WHERE email = $1 AND active = TRUE', [email]);
  const user = result.rows[0];

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    logger.warn('Failed login attempt', { email, ip: req.ip });
    throw new AuthenticationError('Invalid credentials');
  }

  const userData = { id: user.id, email: user.email, role: user.role, restaurantId: user.restaurant_id };
  const accessToken = generateAccessToken(userData);
  const refreshToken = generateRefreshToken(userData);

  logger.info('User logged in', { userId: user.id, email: user.email, role: user.role });

  res.json({
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      restaurantId: user.restaurant_id
    }
  });
}));

router.post('/auth/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw new AuthenticationError('Refresh token required');

  const userData = verifyRefreshToken(refreshToken);
  if (!userData) throw new AuthenticationError('Invalid or expired refresh token');

  const newAccessToken = generateAccessToken({ 
    id: userData.id, 
    email: userData.email, 
    role: userData.role, 
    restaurantId: userData.restaurantId 
  });
  
  res.json({ accessToken: newAccessToken });
}));

// --- CATEGORIES ---

router.get('/categories', authenticateToken, asyncHandler(async (req: AuthRequest, res) => {
  const result = await pool.query('SELECT * FROM categories WHERE restaurant_id = $1 ORDER BY name', [req.user?.restaurantId]);
  res.json(result.rows);
}));

router.post('/categories', authenticateToken, authorizeRole(['Admin', 'Manager']), asyncHandler(async (req: AuthRequest, res) => {
  const { name } = categorySchema.parse(req.body);
  const restaurantId = req.user?.restaurantId;
  
  // Check for duplicate
  const existing = await pool.query('SELECT id FROM categories WHERE name = $1 AND restaurant_id = $2', [name, restaurantId]);
  if (existing.rowCount && existing.rowCount > 0) {
    throw new ConflictError('Category already exists');
  }

  const result = await pool.query(
    'INSERT INTO categories (name, restaurant_id) VALUES ($1, $2) RETURNING *', 
    [name, restaurantId]
  );
  res.status(201).json(result.rows[0]);
}));

router.put('/categories/:id', authenticateToken, authorizeRole(['Admin', 'Manager']), asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { name } = categorySchema.parse(req.body);
  const restaurantId = req.user?.restaurantId;
  
  const result = await pool.query(
    'UPDATE categories SET name = $1 WHERE id = $2 AND restaurant_id = $3 RETURNING *', 
    [name, id, restaurantId]
  );
  if (result.rowCount === 0) throw new NotFoundError('Category not found');
  res.json(result.rows[0]);
}));

router.delete('/categories/:id', authenticateToken, authorizeRole(['Admin', 'Manager']), asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;
  const restaurantId = req.user?.restaurantId;
  
  // Check if category has products
  const products = await pool.query('SELECT id FROM products WHERE category_id = $1 AND restaurant_id = $2 LIMIT 1', [id, restaurantId]);
  if (products.rowCount && products.rowCount > 0) {
    throw new ValidationError('Category has products and cannot be deleted');
  }
  
  const result = await pool.query('DELETE FROM categories WHERE id = $1 AND restaurant_id = $2', [id, restaurantId]);
  if (result.rowCount === 0) throw new NotFoundError('Category not found');
  
  res.json({ message: 'Category deleted successfully' });
}));

// --- PRODUCTS ---

router.get('/products', authenticateToken, asyncHandler(async (req: AuthRequest, res) => {
  const result = await pool.query('SELECT * FROM products WHERE restaurant_id = $1 ORDER BY name', [req.user?.restaurantId]);
  res.json(result.rows);
}));

router.post('/products', authenticateToken, authorizeRole(['Admin', 'Manager']), asyncHandler(async (req: AuthRequest, res) => {
  const data = productSchema.parse(req.body);
  const restaurantId = req.user?.restaurantId;
  
  const result = await pool.query(
    'INSERT INTO products (name, barcode, unit, purchase_price, selling_price, category_id, min_stock, restaurant_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
    [data.name, data.barcode, data.unit, data.purchase_price, data.selling_price, data.category_id, data.min_stock, restaurantId]
  );
  res.status(201).json(result.rows[0]);
}));

router.put('/products/:id', authenticateToken, authorizeRole(['Admin', 'Manager']), asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;
  const data = productSchema.parse(req.body);
  const restaurantId = req.user?.restaurantId;
  
  const result = await pool.query(
    'UPDATE products SET name = $1, barcode = $2, unit = $3, purchase_price = $4, selling_price = $5, category_id = $6, min_stock = $7, active = $8, updated_at = CURRENT_TIMESTAMP WHERE id = $9 AND restaurant_id = $10 RETURNING *',
    [data.name, data.barcode, data.unit, data.purchase_price, data.selling_price, data.category_id, data.min_stock, data.active, id, restaurantId]
  );
  if (result.rowCount === 0) throw new NotFoundError('Product not found');
  res.json(result.rows[0]);
}));

router.delete('/products/:id', authenticateToken, authorizeRole(['Admin', 'Manager']), asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;
  const restaurantId = req.user?.restaurantId;
  
  // Check for transactions
  const transactions = await pool.query('SELECT id FROM transactions WHERE product_id = $1 AND restaurant_id = $2 LIMIT 1', [id, restaurantId]);
  if (transactions.rowCount && transactions.rowCount > 0) {
    throw new ValidationError('Product has history and cannot be deleted. Deactivate it instead.');
  }
  
  const result = await pool.query('DELETE FROM products WHERE id = $1 AND restaurant_id = $2', [id, restaurantId]);
  if (result.rowCount === 0) throw new NotFoundError('Product not found');
  
  res.json({ message: 'Product deleted successfully' });
}));

// --- INVENTORY TRANSACTION ENGINE ---

async function updateStock(client: { query: (text: string, params?: unknown[]) => Promise<{rowCount: number | null, rows: any[]}> }, productId: string, type: 'input' | 'output' | 'receipt' | 'inventory_check' | 'storno', quantity: number, userId: string, restaurantId: string, note?: string, referenceId?: string) {
  const productResult = await client.query('SELECT current_stock FROM products WHERE id = $1 AND restaurant_id = $2 FOR UPDATE', [productId, restaurantId]);
  if (!productResult.rowCount || productResult.rowCount === 0) throw new NotFoundError(`Product not found`);

  const currentStock = parseFloat(productResult.rows[0].current_stock);
  const movementQty = parseFloat(quantity.toString());

  let newStock = currentStock;
  if (type === 'output') {
    newStock -= movementQty;
  } else if (type === 'input' || type === 'receipt' || type === 'storno') {
    newStock += movementQty;
  } else if (type === 'inventory_check') {
    newStock = movementQty;
  }

  if (newStock < 0) {
    throw new ValidationError(`Insufficient stock for product ${productId}`);
  }

  await client.query('UPDATE products SET current_stock = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND restaurant_id = $3', [newStock, productId, restaurantId]);

  const diff = type === 'inventory_check' ? Math.abs(newStock - currentStock) : movementQty;

  await client.query(
    'INSERT INTO transactions (product_id, type, quantity, previous_stock, new_stock, user_id, reference_id, note, restaurant_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
    [productId, type, diff, currentStock, newStock, userId, referenceId, note, restaurantId]
  );
  
  logger.info('Inventory transaction recorded', {
    productId,
    type,
    quantity: diff,
    previousStock: currentStock,
    newStock,
    userId,
    referenceId,
    restaurantId
  });

  return newStock;
}

// Deducts or restores inventory for all menu items in an order that have a bundle (normative) defined.
// direction='deduct' → called on order creation; direction='storno' → called on order cancellation.
async function applyOrderInventory(
  client: { query: (text: string, params?: unknown[]) => Promise<{rowCount: number | null, rows: any[]}> },
  orderId: string,
  direction: 'deduct' | 'storno',
  userId: string,
  restaurantId: string
) {
  const itemsRes = await client.query(
    `SELECT oi.quantity, mi.bundle_id
     FROM order_items oi
     JOIN menu_items mi ON oi.menu_item_id = mi.id
     WHERE oi.order_id = $1 AND mi.bundle_id IS NOT NULL`,
    [orderId]
  );

  if (!itemsRes.rowCount || itemsRes.rowCount === 0) return;

  for (const oi of itemsRes.rows) {
    const bundleItemsRes = await client.query(
      'SELECT product_id, quantity FROM bundle_items WHERE bundle_id = $1',
      [oi.bundle_id]
    );

    for (const bi of bundleItemsRes.rows) {
      const qty = Number(bi.quantity) * Number(oi.quantity);
      const type = direction === 'deduct' ? 'output' : 'storno';
      const note = direction === 'deduct'
        ? `Нарачка #${orderId.slice(0, 8)}`
        : `Сторно нарачка #${orderId.slice(0, 8)}`;
      try {
        await updateStock(client, bi.product_id, type, qty, userId, restaurantId, note, orderId);
      } catch {
        // Log but never block the order — stock deficit is visible in inventory, not a hard stop
        logger.warn(`Inventory ${direction} skipped`, { productId: bi.product_id, orderId });
      }
    }
  }
}

// --- INVOICES (Stock Increase) ---

router.post('/invoices', authenticateToken, asyncHandler(async (req: AuthRequest, res) => {
  const { invoice_number, supplier_name, date, items } = invoiceSchema.parse(req.body);
  const restaurantId = req.user?.restaurantId;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const total_amount = items.reduce((acc, item) => acc + (item.quantity * item.price), 0);
    
    const invoiceResult = await client.query(
      'INSERT INTO invoices (invoice_number, supplier_name, date, total_amount, status, user_id, restaurant_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [invoice_number, supplier_name, date, total_amount, 'completed', req.user?.id, restaurantId]
    );
    const invoiceId = invoiceResult.rows[0].id;

    for (const item of items) {
      await client.query(
        'INSERT INTO invoice_items (invoice_id, product_id, quantity, price, total) VALUES ($1, $2, $3, $4, $5)',
        [invoiceId, item.product_id, item.quantity, item.price, item.quantity * item.price]
      );

      await updateStock(client, item.product_id, 'receipt', item.quantity, req.user?.id || '', restaurantId || '', `Invoice #${invoice_number}`, invoiceId);
    }

    await client.query('COMMIT');
    res.status(201).json({ id: invoiceId, message: 'Invoice processed successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

// --- INVENTORY MOVEMENTS ---

// Centralized movement recorder
async function recordMovement(req: AuthRequest, res: express.Response) {
  const { product_id, type, quantity, note } = req.body;
  const restaurantId = req.user?.restaurantId || '';
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const newStock = await updateStock(client, product_id, type, quantity, req.user?.id || '', restaurantId, note);
    await client.query('COMMIT');
    res.json({ message: 'Movement recorded successfully', newStock });
  } catch (error: unknown) {
    await client.query('ROLLBACK');
    const message = error instanceof Error ? error.message : 'Movement failed';
    res.status(400).json({ error: message });
  } finally {
    client.release();
  }
}

router.post('/inventory/movement', authenticateToken, recordMovement);
router.post('/inventory/input', authenticateToken, (req: AuthRequest, res) => { req.body.type = 'input'; recordMovement(req, res); });
router.post('/inventory/output', authenticateToken, (req: AuthRequest, res) => { req.body.type = 'output'; recordMovement(req, res); });

router.post('/inventory/bundle-output', authenticateToken, async (req: AuthRequest, res) => {
  const { bundle_id, quantity, note } = req.body;
  const restaurantId = req.user?.restaurantId || '';
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Get Bundle Items ensuring the bundle belongs to the restaurant
    const itemsResult = await client.query(
      `SELECT bi.product_id, bi.quantity 
       FROM bundle_items bi 
       JOIN bundles b ON bi.bundle_id = b.id 
       WHERE b.id = $1 AND b.restaurant_id = $2`, 
      [bundle_id, restaurantId]
    );
    
    if (itemsResult.rowCount === 0) throw new Error('Bundle not found or has no items');

    // 2. Deduct each item
    for (const item of itemsResult.rows) {
      const totalDeduction = item.quantity * quantity;
      await updateStock(client, item.product_id, 'output', totalDeduction, req.user?.id || '', restaurantId, `Bundle deduction: ${note || ''}`, bundle_id);
    }

    await client.query('COMMIT');
    res.json({ message: 'Bundle deduction successful' });
  } catch (error: unknown) {
    await client.query('ROLLBACK');
    const message = error instanceof Error ? error.message : 'Bundle deduction failed';
    res.status(400).json({ error: message });
  } finally {
    client.release();
  }
});

// --- TRANSACTIONS (Audit Trail) ---

router.get('/transactions', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      `SELECT t.*, p.name as product_name, u.name as user_name 
       FROM transactions t 
       JOIN products p ON t.product_id = p.id 
       JOIN users u ON t.user_id = u.id 
       WHERE t.restaurant_id = $1
       ORDER BY t.date DESC LIMIT 100`,
      [req.user?.restaurantId]
    );
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// --- DASHBOARD STATS ---

router.get('/dashboard/stats', authenticateToken, async (req: AuthRequest, res) => {
  const restaurantId = req.user?.restaurantId;
  try {
    const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM products WHERE restaurant_id = $1) as total_products,
        (SELECT COALESCE(SUM(current_stock * purchase_price), 0) FROM products WHERE restaurant_id = $1) as inventory_value,
        (SELECT COUNT(*) FROM products WHERE current_stock <= min_stock AND restaurant_id = $1) as low_stock_alerts,
        (SELECT COUNT(*) FROM transactions WHERE date >= CURRENT_DATE AND restaurant_id = $1) as daily_transactions
    `, [restaurantId]);
    res.json(stats.rows[0]);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// --- USER MANAGEMENT ---

router.get('/users', authenticateToken, authorizeRole(['Admin']), async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, active, created_at as "createdAt" FROM users WHERE restaurant_id = $1 ORDER BY name',
      [req.user?.restaurantId]
    );
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.post('/users', authenticateToken, authorizeRole(['Admin']), async (req: AuthRequest, res) => {
  const { name, email, role, active, password } = req.body;
  const restaurantId = req.user?.restaurantId;
  try {
    const hashedPassword = await bcrypt.hash(password || 'password123', 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, role, active, password_hash, restaurant_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, role, active, created_at as "createdAt"',
      [name, email, role, active, hashedPassword, restaurantId]
    );
    res.status(201).json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Failed to create user' });
  }
});

router.put('/users/:id', authenticateToken, authorizeRole(['Admin']), async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { name, email, role, active } = req.body;
  const restaurantId = req.user?.restaurantId;
  try {
    const result = await pool.query(
      'UPDATE users SET name = $1, email = $2, role = $3, active = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 AND restaurant_id = $6 RETURNING id, name, email, role, active, created_at as "createdAt"',
      [name, email, role, active, id, restaurantId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// --- BUNDLES (Normatives) ---

router.get('/bundles', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const bundlesResult = await pool.query('SELECT * FROM bundles WHERE active = TRUE AND restaurant_id = $1 ORDER BY name', [req.user?.restaurantId]);
    const bundles = bundlesResult.rows;

    for (const bundle of bundles) {
      const itemsResult = await pool.query(
        `SELECT bi.*, p.name as product_name, p.unit 
         FROM bundle_items bi 
         JOIN products p ON bi.product_id = p.id 
         WHERE bi.bundle_id = $1 AND p.restaurant_id = $2`,
        [bundle.id, req.user?.restaurantId]
      );
      bundle.items = itemsResult.rows;
    }

    res.json(bundles);
  } catch {
    res.status(500).json({ error: 'Failed to fetch bundles' });
  }
});

router.post('/bundles', authenticateToken, authorizeRole(['Admin', 'Manager']), async (req: AuthRequest, res) => {
  const { name, sellingPrice, items } = req.body;
  const restaurantId = req.user?.restaurantId;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const bundleResult = await client.query(
      'INSERT INTO bundles (name, selling_price, restaurant_id) VALUES ($1, $2, $3) RETURNING *',
      [name, sellingPrice, restaurantId]
    );
    const bundleId = bundleResult.rows[0].id;

    for (const item of items) {
      await client.query(
        'INSERT INTO bundle_items (bundle_id, product_id, quantity) VALUES ($1, $2, $3)',
        [bundleId, item.productId, item.quantity]
      );
    }

    await client.query('COMMIT');
    res.status(201).json(bundleResult.rows[0]);
  } catch {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to create bundle' });
  } finally {
    client.release();
  }
});

router.put('/bundles/:id', authenticateToken, authorizeRole(['Admin', 'Manager']), async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { name, sellingPrice, items, active } = req.body;
  const restaurantId = req.user?.restaurantId;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const bundleResult = await client.query(
      'UPDATE bundles SET name = $1, selling_price = $2, active = $3 WHERE id = $4 AND restaurant_id = $5 RETURNING *',
      [name, sellingPrice, active !== undefined ? active : true, id, restaurantId]
    );

    if (bundleResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Bundle not found' });
    }

    // Update items: delete old ones and insert new ones
    await client.query('DELETE FROM bundle_items WHERE bundle_id = $1', [id]);
    for (const item of items) {
      await client.query(
        'INSERT INTO bundle_items (bundle_id, product_id, quantity) VALUES ($1, $2, $3)',
        [id, item.productId, item.quantity]
      );
    }

    await client.query('COMMIT');
    res.json(bundleResult.rows[0]);
  } catch {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to update bundle' });
  } finally {
    client.release();
  }
});

router.delete('/bundles/:id', authenticateToken, authorizeRole(['Admin', 'Manager']), async (req: AuthRequest, res) => {
  const { id } = req.params;
  const restaurantId = req.user?.restaurantId;
  try {
    await pool.query('UPDATE bundles SET active = FALSE WHERE id = $1 AND restaurant_id = $2', [id, restaurantId]);
    res.json({ message: 'Bundle deactivated successfully' });
  } catch {
    res.status(500).json({ error: 'Failed to delete bundle' });
  }
});

// --- INVENTORY CHECKS ---

router.get('/inventory-checks', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query('SELECT * FROM inventory_checks WHERE restaurant_id = $1 ORDER BY date DESC', [req.user?.restaurantId]);
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Failed to fetch inventory checks' });
  }
});

router.post('/inventory-checks', authenticateToken, async (req: AuthRequest, res) => {
  const { items } = req.body;
  const userId = req.user?.id || '';
  const restaurantId = req.user?.restaurantId || '';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const checkResult = await client.query(
      'INSERT INTO inventory_checks (user_id, status, restaurant_id) VALUES ($1, $2, $3) RETURNING *',
      [userId, 'completed', restaurantId]
    );
    const checkId = checkResult.rows[0].id;

    for (const item of items) {
      const diff = item.realQty - item.systemQty;
      
      await client.query(
        'INSERT INTO inventory_check_items (check_id, product_id, system_qty, real_qty, diff) VALUES ($1, $2, $3, $4, $5)',
        [checkId, item.productId, item.systemQty, item.realQty, diff]
      );

      if (diff !== 0) {
        await updateStock(client, item.productId, 'inventory_check', item.realQty, userId, restaurantId, `Inventory check diff (${diff > 0 ? '+' : ''}${diff})`, checkId);
      }
    }

    await client.query('COMMIT');
    res.status(201).json(checkResult.rows[0]);
  } catch (error: unknown) {
    await client.query('ROLLBACK');
    const message = error instanceof Error ? error.message : 'Failed to complete inventory check';
    res.status(500).json({ error: message });
  } finally {
    client.release();
  }
});

// --- REPORTS ---

router.get('/reports/sales', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.name as product_name,
        SUM(ii.quantity) as total_quantity,
        SUM(ii.total) as total_revenue
      FROM invoice_items ii
      JOIN products p ON ii.product_id = p.id
      JOIN invoices i ON ii.invoice_id = i.id
      WHERE i.restaurant_id = $1
      GROUP BY p.id, p.name
      ORDER BY total_revenue DESC
    `, [req.user?.restaurantId]);
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/reports/inventory', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.name,
        p.current_stock,
        p.min_stock,
        c.name as category_name,
        (p.current_stock * p.purchase_price) as stock_value
      FROM products p
      JOIN categories c ON p.category_id = c.id
      WHERE p.restaurant_id = $1
      ORDER BY stock_value DESC
    `, [req.user?.restaurantId]);
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// ==========================================
// POS SYSTEM ROUTES
// ==========================================

// --- MENU CATEGORIES ---

// GET /menu-categories — list with item count; custom categories first by sort_order
router.get('/menu-categories', authenticateToken, asyncHandler(async (req: AuthRequest, res) => {
  const result = await pool.query(
    `SELECT mc.*,
            COUNT(DISTINCT mic.menu_item_id)::int AS item_count
     FROM menu_categories mc
     LEFT JOIN menu_item_categories mic ON mic.category_id = mc.id
     WHERE mc.restaurant_id = $1
     GROUP BY mc.id
     ORDER BY mc.sort_order, mc.name`,
    [req.user?.restaurantId],
  );
  res.json(result.rows);
}));

// POST /menu-categories — create custom category only
router.post('/menu-categories', authenticateToken, asyncHandler(async (req: AuthRequest, res) => {
  const { name, icon, color, sort_order, name_translations } = req.body;
  if (!name || name.trim().length < 2) throw new ValidationError('Name must be at least 2 characters');
  const result = await pool.query(
    `INSERT INTO menu_categories
       (restaurant_id, name, icon, color, sort_order, active, type, name_translations, created_by, updated_at)
     VALUES ($1,$2,$3,$4,$5,true,'custom',$6,$7,NOW())
     RETURNING *`,
    [req.user?.restaurantId, name.trim(), icon || null, color || null, sort_order ?? 0,
     name_translations ? JSON.stringify(name_translations) : null,
     req.user?.id],
  );
  res.status(201).json(result.rows[0]);
}));

// PUT /menu-categories/:id — system categories: only sort_order allowed; custom: full update
router.put('/menu-categories/:id', authenticateToken, asyncHandler(async (req: AuthRequest, res) => {
  const cat = await pool.query(
    'SELECT * FROM menu_categories WHERE id = $1 AND restaurant_id = $2',
    [req.params.id, req.user?.restaurantId],
  );
  if (!cat.rowCount) throw new NotFoundError('Category not found');
  const row = cat.rows[0];

  if (row.type === 'system') {
    // System categories: only sort_order can be changed
    const { sort_order } = req.body;
    const updated = await pool.query(
      'UPDATE menu_categories SET sort_order=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
      [sort_order ?? row.sort_order, req.params.id],
    );
    return res.json(updated.rows[0]);
  }

  const { name, icon, color, sort_order, active, name_translations } = req.body;
  const updated = await pool.query(
    `UPDATE menu_categories
     SET name=$1, icon=$2, color=$3, sort_order=$4, active=$5,
         name_translations=$6, updated_at=NOW()
     WHERE id=$7 AND restaurant_id=$8
     RETURNING *`,
    [name ?? row.name, icon ?? row.icon, color ?? row.color,
     sort_order ?? row.sort_order, active !== undefined ? active : row.active,
     name_translations ? JSON.stringify(name_translations) : row.name_translations,
     req.params.id, req.user?.restaurantId],
  );
  res.json(updated.rows[0]);
}));

// DELETE /menu-categories/:id — system categories are protected; conflict if items remain
router.delete('/menu-categories/:id', authenticateToken, asyncHandler(async (req: AuthRequest, res) => {
  const cat = await pool.query(
    'SELECT type FROM menu_categories WHERE id = $1 AND restaurant_id = $2',
    [req.params.id, req.user?.restaurantId],
  );
  if (!cat.rowCount) throw new NotFoundError('Category not found');
  if (cat.rows[0].type === 'system') throw new ConflictError('System categories cannot be deleted');

  const usageCheck = await pool.query(
    'SELECT COUNT(*) FROM menu_item_categories WHERE category_id = $1',
    [req.params.id],
  );
  if (Number(usageCheck.rows[0].count) > 0) {
    throw new ConflictError('Category still has menu items. Remove items first.');
  }

  await pool.query('DELETE FROM menu_categories WHERE id = $1 AND restaurant_id = $2', [req.params.id, req.user?.restaurantId]);
  res.json({ message: 'Deleted' });
}));

// PATCH /menu-categories/reorder — bulk update sort_order
router.patch('/menu-categories/reorder', authenticateToken, asyncHandler(async (req: AuthRequest, res) => {
  const { order } = req.body as { order: Array<{ id: string; sort_order: number }> };
  if (!Array.isArray(order) || order.length === 0) throw new ValidationError('order array required');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const entry of order) {
      await client.query(
        'UPDATE menu_categories SET sort_order=$1, updated_at=NOW() WHERE id=$2 AND restaurant_id=$3',
        [entry.sort_order, entry.id, req.user?.restaurantId],
      );
    }
    await client.query('COMMIT');
    res.json({ message: 'Reordered' });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

// --- MENU ITEM CATEGORIES (junction) ---

// GET /menu-items/:id/categories
router.get('/menu-items/:id/categories', authenticateToken, asyncHandler(async (req: AuthRequest, res) => {
  const result = await pool.query(
    `SELECT mic.*, mc.name, mc.type, mc.icon, mc.color
     FROM menu_item_categories mic
     JOIN menu_categories mc ON mc.id = mic.category_id
     WHERE mic.menu_item_id = $1 AND mc.restaurant_id = $2
     ORDER BY mic.sort_order, mc.name`,
    [req.params.id, req.user?.restaurantId],
  );
  res.json(result.rows);
}));

// POST /menu-items/:id/categories — assign a category (with optional price override)
router.post('/menu-items/:id/categories', authenticateToken, asyncHandler(async (req: AuthRequest, res) => {
  const { category_id, price_override, sort_order } = req.body;
  if (!category_id) throw new ValidationError('category_id required');
  // Verify category belongs to restaurant
  const catCheck = await pool.query(
    'SELECT id FROM menu_categories WHERE id=$1 AND restaurant_id=$2',
    [category_id, req.user?.restaurantId],
  );
  if (!catCheck.rowCount) throw new NotFoundError('Category not found');

  const result = await pool.query(
    `INSERT INTO menu_item_categories (menu_item_id, category_id, price_override, sort_order)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (menu_item_id, category_id)
       DO UPDATE SET price_override=EXCLUDED.price_override, sort_order=EXCLUDED.sort_order
     RETURNING *`,
    [req.params.id, category_id, price_override ?? null, sort_order ?? 0],
  );
  res.status(201).json(result.rows[0]);
}));

// PUT /menu-items/:id/categories/:cid — update price_override / sort_order
router.put('/menu-items/:id/categories/:cid', authenticateToken, asyncHandler(async (req: AuthRequest, res) => {
  const { price_override, sort_order } = req.body;
  const result = await pool.query(
    `UPDATE menu_item_categories
     SET price_override=$1, sort_order=$2
     WHERE menu_item_id=$3 AND category_id=$4
     RETURNING *`,
    [price_override ?? null, sort_order ?? 0, req.params.id, req.params.cid],
  );
  if (!result.rowCount) throw new NotFoundError('Assignment not found');
  res.json(result.rows[0]);
}));

// DELETE /menu-items/:id/categories/:cid — remove from category
router.delete('/menu-items/:id/categories/:cid', authenticateToken, asyncHandler(async (req: AuthRequest, res) => {
  const result = await pool.query(
    'DELETE FROM menu_item_categories WHERE menu_item_id=$1 AND category_id=$2 RETURNING id',
    [req.params.id, req.params.cid],
  );
  if (!result.rowCount) throw new NotFoundError('Assignment not found');
  res.json({ message: 'Removed' });
}));

// --- MENU ITEMS ---
router.get('/menu-items', authenticateToken, asyncHandler(async (req: AuthRequest, res) => {
  // Optional filter by category_id (checks junction table)
  const { category_id } = req.query as { category_id?: string };

  let query: string;
  let params: any[];

  if (category_id) {
    query = `
      SELECT mi.*,
             mc.name AS category_name,
             COALESCE(mic.price_override, mi.price) AS displayed_price,
             ARRAY_AGG(DISTINCT mic2.category_id) FILTER (WHERE mic2.category_id IS NOT NULL) AS category_ids
      FROM menu_items mi
      LEFT JOIN menu_categories mc ON mc.id = mi.menu_category_id
      JOIN menu_item_categories mic ON mic.menu_item_id = mi.id AND mic.category_id = $2
      LEFT JOIN menu_item_categories mic2 ON mic2.menu_item_id = mi.id
      WHERE mi.restaurant_id = $1
      GROUP BY mi.id, mc.name, mic.price_override
      ORDER BY mic.sort_order, mi.name`;
    params = [req.user?.restaurantId, category_id];
  } else {
    query = `
      SELECT mi.*,
             mc.name AS category_name,
             mi.price AS displayed_price,
             ARRAY_AGG(DISTINCT mic.category_id) FILTER (WHERE mic.category_id IS NOT NULL) AS category_ids
      FROM menu_items mi
      LEFT JOIN menu_categories mc ON mc.id = mi.menu_category_id
      LEFT JOIN menu_item_categories mic ON mic.menu_item_id = mi.id
      WHERE mi.restaurant_id = $1
      GROUP BY mi.id, mc.name
      ORDER BY mc.sort_order, mi.name`;
    params = [req.user?.restaurantId];
  }

  const result = await pool.query(query, params);
  res.json(result.rows);
}));

router.post('/menu-items', authenticateToken, async (req: AuthRequest, res) => {
  const { menu_category_id, name, price, active, available, preparation_station } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO menu_items (restaurant_id, menu_category_id, name, price, active, available, preparation_station) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [req.user?.restaurantId, menu_category_id, name, price, active !== false, available !== false, preparation_station]
    );
    res.status(201).json(result.rows[0]);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.put('/menu-items/:id', authenticateToken, async (req: AuthRequest, res) => {
  const { menu_category_id, name, price, active, available, preparation_station } = req.body;
  try {
    const result = await pool.query(
      'UPDATE menu_items SET menu_category_id = $1, name = $2, price = $3, active = $4, available = $5, preparation_station = $6, updated_at = CURRENT_TIMESTAMP WHERE id = $7 AND restaurant_id = $8 RETURNING *',
      [menu_category_id, name, price, active, available, preparation_station, req.params.id, req.user?.restaurantId]
    );
    res.json(result.rows[0]);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.delete('/menu-items/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    await pool.query('DELETE FROM menu_items WHERE id = $1 AND restaurant_id = $2', [req.params.id, req.user?.restaurantId]);
    res.json({ message: 'Deleted' });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// --- RECIPE (NORMATIV) ---
// Kompatibilni kombinacii: recipe_unit → dozvol. inventory_unit
const RECIPE_UNIT_COMPAT: Record<string, string[]> = {
  g:   ['kg'],
  ml:  ['l'],
  kg:  ['kg'],
  l:   ['l'],
  pcs: ['pcs', 'box'],
  box: ['box'],
};
function isUnitCompatible(recipeUnit: string, invUnit: string): boolean {
  return (RECIPE_UNIT_COMPAT[recipeUnit] ?? []).includes(invUnit);
}

// GET /menu-items/:id/recipe — lista na sostojki so tekovna zaliha
router.get('/menu-items/:id/recipe', authenticateToken, asyncHandler(async (req: AuthRequest, res) => {
  const result = await pool.query(
    `SELECT ri.id, ri.quantity, ri.recipe_unit,
            p.id AS inventory_item_id, p.name AS ingredient_name,
            p.current_stock, p.unit AS inventory_unit
     FROM recipe_ingredients ri
     JOIN products p ON p.id = ri.inventory_item_id
     WHERE ri.menu_item_id = $1 AND ri.restaurant_id = $2
     ORDER BY p.name`,
    [req.params.id, req.user?.restaurantId],
  );
  res.json(result.rows);
}));

// GET /menu-items/:id/recipe/stock-check?portions=N — proverka na dovolnost
router.get('/menu-items/:id/recipe/stock-check', authenticateToken, asyncHandler(async (req: AuthRequest, res) => {
  const portions = Math.max(1, parseInt(req.query.portions as string) || 1);
  const CONV: Record<string, Record<string, number>> = {
    g: { kg: 0.001 }, ml: { l: 0.001 },
    kg: { kg: 1 }, l: { l: 1 },
    pcs: { pcs: 1, box: 1 }, box: { box: 1 },
  };
  const recipeRes = await pool.query(
    `SELECT ri.quantity, ri.recipe_unit,
            p.name AS ingredient_name, p.current_stock, p.unit AS inv_unit
     FROM recipe_ingredients ri
     JOIN products p ON p.id = ri.inventory_item_id
     WHERE ri.menu_item_id = $1 AND ri.restaurant_id = $2`,
    [req.params.id, req.user?.restaurantId],
  );
  const items = recipeRes.rows.map(r => {
    const factor = CONV[r.recipe_unit]?.[r.inv_unit] ?? 1;
    const required = Number(r.quantity) * factor * portions;
    const available = Number(r.current_stock);
    return { ingredient_name: r.ingredient_name, required, available, unit: r.inv_unit, sufficient: available >= required };
  });
  res.json(items);
}));

// POST /menu-items/:id/recipe — dodavanje sostojok
router.post('/menu-items/:id/recipe', authenticateToken, asyncHandler(async (req: AuthRequest, res) => {
  const { inventory_item_id, quantity, recipe_unit } = req.body;
  if (!inventory_item_id || !quantity || !recipe_unit) throw new ValidationError('inventory_item_id, quantity, recipe_unit se zadolzitelni');
  if (Number(quantity) <= 0) throw new ValidationError('quantity mora da bide > 0');

  const miRes = await pool.query('SELECT id FROM menu_items WHERE id = $1 AND restaurant_id = $2', [req.params.id, req.user?.restaurantId]);
  if (miRes.rowCount === 0) throw new NotFoundError('Menu item not found');

  const prodRes = await pool.query('SELECT unit FROM products WHERE id = $1 AND restaurant_id = $2', [inventory_item_id, req.user?.restaurantId]);
  if (prodRes.rowCount === 0) throw new NotFoundError('Inventory item not found');

  if (!isUnitCompatible(recipe_unit, prodRes.rows[0].unit)) {
    throw new ValidationError(`Edinicata '${recipe_unit}' ne e kompatibilna so '${prodRes.rows[0].unit}' za ovoj proizvod`);
  }

  const result = await pool.query(
    `INSERT INTO recipe_ingredients (restaurant_id, menu_item_id, inventory_item_id, quantity, recipe_unit)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [req.user?.restaurantId, req.params.id, inventory_item_id, quantity, recipe_unit],
  );
  res.status(201).json(result.rows[0]);
}));

// PUT /menu-items/:id/recipe/:rid — ureduvanje na sostojok
router.put('/menu-items/:id/recipe/:rid', authenticateToken, asyncHandler(async (req: AuthRequest, res) => {
  const { quantity, recipe_unit } = req.body;
  if (quantity !== undefined && Number(quantity) <= 0) throw new ValidationError('quantity mora da bide > 0');

  const existing = await pool.query(
    `SELECT ri.*, p.unit AS inventory_unit FROM recipe_ingredients ri
     JOIN products p ON p.id = ri.inventory_item_id
     WHERE ri.id = $1 AND ri.restaurant_id = $2`,
    [req.params.rid, req.user?.restaurantId],
  );
  if (existing.rowCount === 0) throw new NotFoundError('Recipe ingredient not found');

  const newUnit = recipe_unit ?? existing.rows[0].recipe_unit;
  if (!isUnitCompatible(newUnit, existing.rows[0].inventory_unit)) {
    throw new ValidationError(`Edinicata '${newUnit}' ne e kompatibilna so '${existing.rows[0].inventory_unit}'`);
  }

  const result = await pool.query(
    `UPDATE recipe_ingredients
     SET quantity = COALESCE($1, quantity), recipe_unit = COALESCE($2, recipe_unit), updated_at = NOW()
     WHERE id = $3 AND restaurant_id = $4 RETURNING *`,
    [quantity ?? null, recipe_unit ?? null, req.params.rid, req.user?.restaurantId],
  );
  res.json(result.rows[0]);
}));

// DELETE /menu-items/:id/recipe/:rid — brisenje na sostojok
router.delete('/menu-items/:id/recipe/:rid', authenticateToken, asyncHandler(async (req: AuthRequest, res) => {
  const result = await pool.query(
    'DELETE FROM recipe_ingredients WHERE id = $1 AND restaurant_id = $2 RETURNING id',
    [req.params.rid, req.user?.restaurantId],
  );
  if (result.rowCount === 0) throw new NotFoundError('Recipe ingredient not found');
  res.json({ deleted: true });
}));

// --- TABLES ---
router.get('/tables', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(`
      SELECT t.*, o.id as current_order_id
      FROM restaurant_tables t
      LEFT JOIN orders o ON t.id = o.table_id AND o.status = 'open'
      WHERE t.restaurant_id = $1
      ORDER BY CASE WHEN t.number ~ '^[0-9]+$' THEN t.number::integer ELSE 9999 END, t.number
    `, [req.user?.restaurantId]);
    res.json(result.rows.map(row => ({
      id: row.id,
      restaurantId: row.restaurant_id,
      number: parseInt(row.number) || row.number,
      capacity: row.capacity,
      zone: row.zone,
      status: row.status,
      active: row.active,
      currentOrderId: row.current_order_id || undefined,
    })));
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.post('/tables', authenticateToken, async (req: AuthRequest, res) => {
  const { number, capacity, zone, status, active } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO restaurant_tables (restaurant_id, number, capacity, zone, status, active) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [req.user?.restaurantId, number, capacity || 2, zone, status || 'free', active !== false]
    );
    res.status(201).json(result.rows[0]);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.put('/tables/:id', authenticateToken, async (req: AuthRequest, res) => {
  const { number, capacity, zone, status, active } = req.body;
  try {
    const result = await pool.query(
      'UPDATE restaurant_tables SET number = $1, capacity = $2, zone = $3, status = $4, active = $5 WHERE id = $6 AND restaurant_id = $7 RETURNING *',
      [number, capacity, zone, status, active, req.params.id, req.user?.restaurantId]
    );
    res.json(result.rows[0]);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.delete('/tables/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    await pool.query('DELETE FROM restaurant_tables WHERE id = $1 AND restaurant_id = $2', [req.params.id, req.user?.restaurantId]);
    res.json({ message: 'Deleted' });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// --- PRINTERS ---
router.get('/printers', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query('SELECT * FROM printers WHERE restaurant_id = $1 ORDER BY name', [req.user?.restaurantId]);
    res.json(result.rows);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.post('/printers', authenticateToken, async (req: AuthRequest, res) => {
  const { name, type, connection_type, ip_address, port, station, active } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO printers (restaurant_id, name, type, connection_type, ip_address, port, station, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.user?.restaurantId, name, type, connection_type, ip_address ?? null, port ?? null, station ?? null, active !== false]
    );
    res.status(201).json(result.rows[0]);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.put('/printers/:id', authenticateToken, async (req: AuthRequest, res) => {
  const { name, type, connection_type, ip_address, port, station, active } = req.body;
  try {
    const result = await pool.query(
      `UPDATE printers SET name=$1, type=$2, connection_type=$3, ip_address=$4, port=$5, station=$6, active=$7
       WHERE id=$8 AND restaurant_id=$9 RETURNING *`,
      [name, type, connection_type, ip_address ?? null, port ?? null, station ?? null, active, req.params.id, req.user?.restaurantId]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Printer not found' });
    res.json(result.rows[0]);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.delete('/printers/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    await pool.query('DELETE FROM printers WHERE id=$1 AND restaurant_id=$2', [req.params.id, req.user?.restaurantId]);
    res.status(204).end();
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// ─── ESC/POS helpers ──────────────────────────────────────────────────────────

const ESC = 0x1b;
const GS  = 0x1d;

const escpos = {
  init:    () => Buffer.from([ESC, 0x40]),
  align:   (a: 0 | 1 | 2) => Buffer.from([ESC, 0x61, a]),
  bold:    (on: boolean)   => Buffer.from([ESC, 0x45, on ? 1 : 0]),
  size:    (s: 0 | 1 | 2) => Buffer.from([GS,  0x21, s === 2 ? 0x11 : s === 1 ? 0x10 : 0x00]),
  text:    (s: string)     => Buffer.from(s + '\n', 'utf8'),
  feed:    (n: number)     => Buffer.from([ESC, 0x64, n]),
  cut:     ()              => Buffer.from([GS,  0x56, 0x01]),
};

function padRow(left: string, right: string, width = 32): string {
  const gap = width - left.length - right.length;
  return left + (gap > 0 ? ' '.repeat(gap) : ' ') + right;
}

function buildReceiptEscPos(order: any): Buffer {
  const items  = order.items ?? [];
  const total  = Number(order.total_amount ?? order.totalAmount ?? 0);
  const tax    = total * 0.18;
  const dateStr = new Date(order.created_at ?? order.createdAt ?? Date.now())
    .toLocaleString('mk-MK', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const parts: Buffer[] = [
    escpos.init(),
    escpos.align(1), escpos.bold(true), escpos.size(2),
    escpos.text('GASTRO PRO'),
    escpos.size(0), escpos.bold(false),
    escpos.text('DDV: MK4030000000000'),
    escpos.text('------------------------'),
    escpos.align(0),
    escpos.text(dateStr),
    escpos.text(`#${String(order.id).slice(-6).toUpperCase()}`),
    escpos.text('------------------------'),
  ];

  for (const item of items) {
    const name  = String(item.name ?? '');
    const qty   = Number(item.quantity ?? 1);
    const price = Number(item.price ?? 0);
    parts.push(escpos.text(padRow(`${qty}x ${name}`, `${(qty * price).toFixed(2)}`)));
  }

  parts.push(
    escpos.text('------------------------'),
    escpos.bold(true), escpos.size(1),
    escpos.text(padRow('VKUPNO:', `${total.toFixed(2)} den.`)),
    escpos.size(0), escpos.bold(false),
    escpos.text(padRow('DDV 18%:', `${tax.toFixed(2)}`)),
    escpos.align(1),
    escpos.feed(2),
    escpos.text('BLAGODARIIME!'),
    escpos.feed(3),
    escpos.cut(),
  );

  return Buffer.concat(parts);
}

function buildKitchenEscPos(order: any, items: any[], station: string, tableLabel: string): Buffer {
  const timeStr = new Date().toLocaleTimeString('mk-MK', { hour: '2-digit', minute: '2-digit' });
  const ordNum  = String(order.id).slice(-4).toUpperCase();

  const parts: Buffer[] = [
    escpos.init(),
    escpos.align(1), escpos.bold(true), escpos.size(2),
    escpos.text(tableLabel.toUpperCase()),
    escpos.size(1),
    escpos.text(station.toUpperCase()),
    escpos.size(0), escpos.bold(false),
    escpos.text(`#${ordNum}  ${timeStr}`),
    escpos.text('================================'),
    escpos.align(0),
  ];

  for (const item of items) {
    parts.push(
      escpos.bold(true), escpos.size(1),
      escpos.text(`${item.quantity}x ${item.name}`),
      escpos.size(0), escpos.bold(false),
    );
    if (item.note) {
      parts.push(escpos.text(`   ! ${item.note}`));
    }
  }

  parts.push(
    escpos.text('================================'),
    escpos.feed(4),
    escpos.cut(),
  );

  return Buffer.concat(parts);
}

function sendEscPos(ip: string, port: number, data: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket  = new net.Socket();
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error(`Timeout connecting to printer at ${ip}:${port}`));
    }, 5000);

    socket.connect(port, ip, () => {
      socket.write(data, () => {
        clearTimeout(timeout);
        socket.end();
        resolve();
      });
    });

    socket.on('error', (err) => { clearTimeout(timeout); reject(err); });
  });
}

// ─── POST /print-jobs ─────────────────────────────────────────────────────────

router.post('/print-jobs', authenticateToken, async (req: AuthRequest, res) => {
  const { printer_id, type, content } = req.body;
  try {
    const printerRes = await pool.query(
      'SELECT * FROM printers WHERE id = $1 AND restaurant_id = $2',
      [printer_id, req.user?.restaurantId],
    );
    if (!printerRes.rowCount) return res.status(404).json({ error: 'Printer not found' });

    const printer = printerRes.rows[0];

    if (printer.connection_type !== 'network') {
      return res.json({ status: 'skipped', reason: 'not a network printer' });
    }
    if (!printer.ip_address) {
      return res.status(400).json({ error: 'Printer IP not configured' });
    }

    const port = Number(printer.port) || 9100;
    let data: Buffer;

    if (type === 'kitchen_ticket') {
      const { order, items, station, tableLabel } = content as any;
      data = buildKitchenEscPos(order, items ?? [], station ?? 'kitchen', tableLabel ?? 'MASA');
    } else {
      const { order } = content as any;
      data = buildReceiptEscPos(order);
    }

    await sendEscPos(printer.ip_address, port, data);
    logger.info('[PrintJob] Sent to network printer', { printer_id, type, ip: printer.ip_address, port });
    res.json({ status: 'sent' });
  } catch (err: any) {
    logger.error('[PrintJob] Failed', { error: err.message, printer_id, type });
    res.status(500).json({ error: err.message });
  }
});

// --- ORDERS ---
router.get('/orders', authenticateToken, async (req: AuthRequest, res) => {
  const { status } = req.query;
  let queryStr = 'SELECT * FROM orders WHERE restaurant_id = $1';
  const params: any[] = [req.user?.restaurantId];
  
  if (status) {
    queryStr += ' AND status = $2';
    params.push(status);
  }
  queryStr += ' ORDER BY created_at DESC';

  try {
    const result = await pool.query(queryStr, params);
    
    // fetch items for each order
    const orders = result.rows;
    for (const order of orders) {
      const itemsRes = await pool.query('SELECT * FROM order_items WHERE order_id = $1', [order.id]);
      order.items = itemsRes.rows;
    }
    
    res.json(orders);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.post('/orders', authenticateToken, async (req: AuthRequest, res) => {
  const { table_id, customer_id, shift_id, order_type, guest_count, items } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const orderRes = await client.query(
      `INSERT INTO orders (restaurant_id, table_id, user_id, customer_id, shift_id, order_type, guest_count, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'open') RETURNING *`,
      [req.user?.restaurantId, table_id, req.user?.id, customer_id, shift_id, order_type || 'dine_in', guest_count || 1]
    );
    const order = orderRes.rows[0];

    // insert items
    if (items && items.length > 0) {
      let subtotal = 0;
      for (const item of items) {
        await client.query(
          `INSERT INTO order_items (order_id, menu_item_id, name, quantity, price, preparation_station, note, is_bundle) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [order.id, item.menu_item_id, item.name, item.quantity, item.price, item.preparation_station, item.note, item.is_bundle || false]
        );
        subtotal += item.price * item.quantity;
      }
      
      const updateOrderRes = await client.query(
        'UPDATE orders SET subtotal = $1, total_amount = $1 WHERE id = $2 RETURNING *',
        [subtotal, order.id]
      );
      Object.assign(order, updateOrderRes.rows[0]);
    }

    if (table_id) {
      await client.query("UPDATE restaurant_tables SET status = 'occupied' WHERE id = $1", [table_id]);
    }

    await applyOrderInventory(client, order.id, 'deduct', req.user?.id || '', req.user?.restaurantId || '');

    await client.query('COMMIT');

    sseBroadcast(req.user?.restaurantId || '', 'orders_updated', { type: 'created', orderId: order.id });

    res.status(201).json(order);
  } catch (error: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

router.put('/orders/:id', authenticateToken, async (req: AuthRequest, res) => {
  const { status, discount_amount, subtotal, total_amount } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    let updates = [];
    let params: any[] = [];
    let idx = 1;
    
    if (status) { updates.push(`status = $${idx++}`); params.push(status); }
    if (discount_amount !== undefined) { updates.push(`discount_amount = $${idx++}`); params.push(discount_amount); }
    if (subtotal !== undefined) { updates.push(`subtotal = $${idx++}`); params.push(subtotal); }
    if (total_amount !== undefined) { updates.push(`total_amount = $${idx++}`); params.push(total_amount); }
    
    if (status === 'paid' || status === 'cancelled') {
        updates.push(`closed_at = CURRENT_TIMESTAMP`);
    }

    params.push(req.params.id, req.user?.restaurantId);
    
    const result = await client.query(
      `UPDATE orders SET ${updates.join(', ')} WHERE id = $${idx} AND restaurant_id = $${idx+1} RETURNING *`,
      params
    );

    // If order is paid/cancelled and was dine_in, free the table
    if ((status === 'paid' || status === 'cancelled') && result.rows[0]?.table_id) {
      const openOrdersRes = await client.query("SELECT id FROM orders WHERE table_id = $1 AND status = 'open'", [result.rows[0].table_id]);
      if (openOrdersRes.rowCount === 0) {
        await client.query("UPDATE restaurant_tables SET status = 'free' WHERE id = $1", [result.rows[0].table_id]);
      }
    }

    // Restore inventory when order is cancelled (storno for all bundle-linked items)
    if (status === 'cancelled') {
      await applyOrderInventory(client, req.params.id, 'storno', req.user?.id || '', req.user?.restaurantId || '');
    }

    await client.query('COMMIT');

    sseBroadcast(req.user?.restaurantId || '', 'orders_updated', { type: 'updated', orderId: req.params.id });

    res.json(result.rows[0]);
  } catch (error: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

router.post('/orders/:id/items', authenticateToken, async (req: AuthRequest, res) => {
  const { menu_item_id, name, quantity, price, preparation_station, note, is_bundle } = req.body;
  try {
    const orderRes = await pool.query('SELECT id FROM orders WHERE id = $1 AND restaurant_id = $2', [req.params.id, req.user?.restaurantId]);
    if (orderRes.rowCount === 0) return res.status(404).json({ error: 'Order not found' });
    
    const itemRes = await pool.query(
      `INSERT INTO order_items (order_id, menu_item_id, name, quantity, price, preparation_station, note, is_bundle) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.params.id, menu_item_id, name, quantity, price, preparation_station, note, is_bundle || false]
    );
    res.status(201).json(itemRes.rows[0]);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.put('/orders/:id/items/:itemId', authenticateToken, async (req: AuthRequest, res) => {
  const { quantity, status } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orderRes = await client.query('SELECT id FROM orders WHERE id = $1 AND restaurant_id = $2', [req.params.id, req.user?.restaurantId]);
    if (orderRes.rowCount === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Order not found' }); }

    // Zemame go prethodniot status pred promena (za restore logika)
    const prevRes = await client.query('SELECT status FROM order_items WHERE id = $1 AND order_id = $2', [req.params.itemId, req.params.id]);
    if (prevRes.rowCount === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Order item not found' }); }
    const prevStatus = prevRes.rows[0].status;

    let updates: string[] = [];
    let params: any[] = [];
    let idx = 1;
    if (quantity !== undefined) { updates.push(`quantity = $${idx++}`); params.push(quantity); }
    if (status !== undefined)   { updates.push(`status = $${idx++}`);   params.push(status); }

    let updatedItem: any;
    if (updates.length > 0) {
      params.push(req.params.itemId, req.params.id);
      const itemRes = await client.query(
        `UPDATE order_items SET ${updates.join(', ')} WHERE id = $${idx} AND order_id = $${idx + 1} RETURNING *`,
        params,
      );
      updatedItem = itemRes.rows[0];
    } else {
      const itemRes = await client.query('SELECT * FROM order_items WHERE id = $1 AND order_id = $2', [req.params.itemId, req.params.id]);
      updatedItem = itemRes.rows[0];
    }

    // --- INVENTORY DEDUCTION HOOK ---
    let deductionWarnings: any[] = [];
    if (status === 'ready' && prevStatus !== 'ready') {
      // Order item e spremen → odzemi od zaliha
      deductionWarnings = await deductForOrderItem(req.params.itemId, client);
    } else if (status === 'cancelled' && prevStatus === 'ready') {
      // Ready item e otkazan → vrati ja zalihata
      await restoreForOrderItem(req.params.itemId, client);
    }

    await client.query('COMMIT');
    sseBroadcast(req.user?.restaurantId || '', 'orders_updated', { type: 'item_updated', orderId: req.params.id });
    // Vrakame warnings vo odgovorot za da gi prikaze frontendot
    res.json({ ...updatedItem, deductionWarnings });
  } catch (error: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// --- SHIFTS ---
router.get('/shifts/active', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM shifts WHERE restaurant_id = $1 AND user_id = $2 AND status = 'open' LIMIT 1",
      [req.user?.restaurantId, req.user?.id]
    );
    if (result.rowCount === 0) return res.json(null);
    res.json(result.rows[0]);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.post('/shifts', authenticateToken, async (req: AuthRequest, res) => {
  const { initial_cash } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO shifts (restaurant_id, user_id, initial_cash) VALUES ($1, $2, $3) RETURNING *',
      [req.user?.restaurantId, req.user?.id, initial_cash || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.put('/shifts/:id/end', authenticateToken, async (req: AuthRequest, res) => {
  const { final_cash, expected_cash } = req.body;
  try {
    const result = await pool.query(
      "UPDATE shifts SET end_time = CURRENT_TIMESTAMP, final_cash = $1, expected_cash = $2, status = 'closed' WHERE id = $3 AND restaurant_id = $4 RETURNING *",
      [final_cash, expected_cash, req.params.id, req.user?.restaurantId]
    );
    res.json(result.rows[0]);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// --- SHIFT REPORT ---
router.get('/shifts/:id/report', authenticateToken, async (req: AuthRequest, res) => {
  const { restaurantId } = req.user!;
  const shiftId = req.params.id;

  try {
    // Shift header + totals
    const shiftRes = await pool.query(`
      SELECT
        s.id, s.start_time, s.end_time, s.status,
        s.initial_cash, s.final_cash, s.expected_cash,
        u.name AS user_name,
        COUNT(DISTINCT o.id)::int            AS order_count,
        COALESCE(SUM(o.total_amount), 0)::numeric AS total_revenue
      FROM shifts s
      LEFT JOIN users  u ON u.id = s.user_id
      LEFT JOIN orders o ON o.shift_id = s.id AND o.status = 'paid' AND o.restaurant_id = $2
      WHERE s.id = $1 AND s.restaurant_id = $2
      GROUP BY s.id, u.name
    `, [shiftId, restaurantId]);

    if (!shiftRes.rowCount) return res.status(404).json({ error: 'Shift not found' });
    const s = shiftRes.rows[0];

    // Payment method breakdown (if payments table is populated)
    const payRes = await pool.query(`
      SELECT
        COALESCE(p.method, 'cash') AS method,
        COALESCE(SUM(p.amount), 0)::numeric AS total
      FROM orders o
      LEFT JOIN payments p ON p.order_id = o.id
      WHERE o.shift_id = $1 AND o.status = 'paid' AND o.restaurant_id = $2
      GROUP BY p.method
    `, [shiftId, restaurantId]);

    // Top selling items
    const itemsRes = await pool.query(`
      SELECT
        oi.name,
        SUM(oi.quantity)::int            AS count,
        SUM(oi.quantity * oi.price)::numeric AS revenue
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.shift_id = $1 AND o.status = 'paid' AND o.restaurant_id = $2
      GROUP BY oi.name
      ORDER BY count DESC
      LIMIT 8
    `, [shiftId, restaurantId]);

    // Order type breakdown
    const typesRes = await pool.query(`
      SELECT
        order_type,
        COUNT(*)::int                     AS count,
        COALESCE(SUM(total_amount), 0)::numeric AS revenue
      FROM orders
      WHERE shift_id = $1 AND status = 'paid' AND restaurant_id = $2
      GROUP BY order_type
    `, [shiftId, restaurantId]);

    const totalRevenue = Number(s.total_revenue);
    const rawPayments = payRes.rows.map(r => ({ method: r.method as string, total: Number(r.total) }));
    // If payments table has no entries, treat full revenue as cash
    const paymentsTotal = rawPayments.reduce((acc, r) => acc + r.total, 0);
    const paymentsByMethod = paymentsTotal > 0
      ? rawPayments.filter(r => r.total > 0)
      : [{ method: 'cash', total: totalRevenue }];

    const initialCash = Number(s.initial_cash || 0);
    const finalCash   = Number(s.final_cash   || 0);
    const cashPayments = paymentsByMethod.find(p => p.method === 'cash')?.total ?? totalRevenue;
    const expectedCash = initialCash + cashPayments;
    const cashDiff     = finalCash - expectedCash;

    res.json({
      shift: {
        id:           s.id,
        userName:     s.user_name,
        startTime:    s.start_time,
        endTime:      s.end_time,
        status:       s.status,
        initialCash,
        finalCash,
        expectedCash,
        cashDiff,
        orderCount:   Number(s.order_count),
        totalRevenue,
      },
      paymentsByMethod,
      topItems:   itemsRes.rows.map(r => ({ name: r.name, count: Number(r.count),   revenue: Number(r.revenue) })),
      orderTypes: typesRes.rows.map(r => ({ type: r.order_type, count: Number(r.count), revenue: Number(r.revenue) })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- SECONDARY MODULES (PHASE 4) ---

// Reservations
router.get('/reservations', authenticateToken, async (req: AuthRequest, res) => {
  const { date } = req.query;
  const params: any[] = [req.user?.restaurantId];
  let query = `SELECT * FROM reservations WHERE restaurant_id = $1`;
  if (date) {
    params.push(date);
    query += ` AND date = $2`;
  }
  query += ` ORDER BY date ASC, time ASC`;
  const result = await pool.query(query, params);
  res.json(result.rows);
});
router.post('/reservations', authenticateToken, async (req: AuthRequest, res) => {
  const { customer_name, customer_phone, table_id, table_number, date, time, number_of_guests, notes } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO reservations (restaurant_id, customer_name, customer_phone, table_id, table_number, date, time, number_of_guests, notes) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [req.user?.restaurantId, customer_name, customer_phone, table_id, table_number, date, time, number_of_guests, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});
router.put('/reservations/:id', authenticateToken, async (req: AuthRequest, res) => {
  const { status } = req.body;
  try {
    const result = await pool.query(
      `UPDATE reservations SET status = $1 WHERE id = $2 AND restaurant_id = $3 RETURNING *`,
      [status, req.params.id, req.user?.restaurantId]
    );
    res.json(result.rows[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Deliveries
router.get('/deliveries', authenticateToken, async (req: AuthRequest, res) => {
  const result = await pool.query('SELECT * FROM deliveries WHERE restaurant_id = $1 ORDER BY created_at DESC', [req.user?.restaurantId]);
  res.json(result.rows);
});
router.post('/deliveries', authenticateToken, async (req: AuthRequest, res) => {
  const { order_id, address, phone, fee, estimated_time } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO deliveries (restaurant_id, order_id, address, phone, fee, estimated_time) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.user?.restaurantId, order_id, address, phone, fee, estimated_time]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});
router.put('/deliveries/:id', authenticateToken, async (req: AuthRequest, res) => {
  const { status, driver_id, actual_delivery_time } = req.body;
  try {
    const result = await pool.query(
      `UPDATE deliveries SET status = COALESCE($1, status), driver_id = COALESCE($2, driver_id), actual_delivery_time = COALESCE($3, actual_delivery_time) WHERE id = $4 AND restaurant_id = $5 RETURNING *`,
      [status, driver_id, actual_delivery_time, req.params.id, req.user?.restaurantId]
    );
    res.json(result.rows[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Drivers
router.get('/drivers', authenticateToken, async (req: AuthRequest, res) => {
  const result = await pool.query('SELECT * FROM drivers WHERE restaurant_id = $1 AND active = TRUE', [req.user?.restaurantId]);
  res.json(result.rows);
});
router.post('/drivers', authenticateToken, async (req: AuthRequest, res) => {
  const { name, phone } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO drivers (restaurant_id, name, phone) VALUES ($1, $2, $3) RETURNING *`,
      [req.user?.restaurantId, name, phone]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Discounts
router.get('/discounts', authenticateToken, async (req: AuthRequest, res) => {
  const result = await pool.query('SELECT * FROM discounts WHERE restaurant_id = $1 AND active = TRUE', [req.user?.restaurantId]);
  res.json(result.rows);
});
router.post('/discounts', authenticateToken, async (req: AuthRequest, res) => {
  const { name, type, value, requires_manager_approval } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO discounts (restaurant_id, name, type, value, requires_manager_approval) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user?.restaurantId, name, type, value, requires_manager_approval || false]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});
router.put('/discounts/:id', authenticateToken, async (req: AuthRequest, res) => {
  const { active } = req.body;
  try {
    const result = await pool.query(`UPDATE discounts SET active = $1 WHERE id = $2 AND restaurant_id = $3 RETURNING *`, [active, req.params.id, req.user?.restaurantId]);
    res.json(result.rows[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Suppliers
router.get('/suppliers', authenticateToken, async (req: AuthRequest, res) => {
  const result = await pool.query('SELECT * FROM suppliers WHERE restaurant_id = $1 AND active = TRUE', [req.user?.restaurantId]);
  res.json(result.rows);
});
router.post('/suppliers', authenticateToken, async (req: AuthRequest, res) => {
  const { name, contact_person, phone, email, address } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO suppliers (restaurant_id, name, contact_person, phone, email, address) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.user?.restaurantId, name, contact_person, phone, email, address]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Notifications
router.get('/notifications', authenticateToken, async (req: AuthRequest, res) => {
  const result = await pool.query('SELECT * FROM notifications WHERE restaurant_id = $1 ORDER BY created_at DESC LIMIT 50', [req.user?.restaurantId]);
  res.json(result.rows);
});
router.post('/notifications', authenticateToken, async (req: AuthRequest, res) => {
  const { title, message, type, category, link } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO notifications (restaurant_id, title, message, type, category, link) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.user?.restaurantId, title, message, type, category, link]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});
router.put('/notifications/:id/read', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(`UPDATE notifications SET read = TRUE WHERE id = $1 AND restaurant_id = $2 RETURNING *`, [req.params.id, req.user?.restaurantId]);
    res.json(result.rows[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Purchase Orders
router.get('/purchase-orders', authenticateToken, async (req: AuthRequest, res) => {
  const result = await pool.query('SELECT * FROM purchase_orders WHERE restaurant_id = $1 ORDER BY order_date DESC', [req.user?.restaurantId]);
  res.json(result.rows);
});
router.post('/purchase-orders', authenticateToken, async (req: AuthRequest, res) => {
  const { supplier_id, supplier_name, order_date, expected_date, total_cost, status, notes } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO purchase_orders (restaurant_id, supplier_id, supplier_name, order_date, expected_date, total_cost, status, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.user?.restaurantId, supplier_id, supplier_name, order_date, expected_date, total_cost || 0, status || 'draft', notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});
router.put('/purchase-orders/:id', authenticateToken, async (req: AuthRequest, res) => {
  const { status } = req.body;
  try {
    const result = await pool.query(`UPDATE purchase_orders SET status = COALESCE($1, status) WHERE id = $2 AND restaurant_id = $3 RETURNING *`, [status, req.params.id, req.user?.restaurantId]);
    res.json(result.rows[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Customers (CRM)
router.get('/customers', authenticateToken, async (req: AuthRequest, res) => {
  const result = await pool.query('SELECT * FROM customers WHERE restaurant_id = $1 ORDER BY name ASC', [req.user?.restaurantId]);
  res.json(result.rows);
});
router.post('/customers', authenticateToken, async (req: AuthRequest, res) => {
  const { name, phone, email, notes } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO customers (restaurant_id, name, phone, email, notes) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user?.restaurantId, name, phone, email, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});
router.put('/customers/:id', authenticateToken, async (req: AuthRequest, res) => {
  const { name, phone, email, notes, total_spent, orders_count } = req.body;
  try {
    const result = await pool.query(
      `UPDATE customers SET 
         name = COALESCE($1, name), 
         phone = COALESCE($2, phone), 
         email = COALESCE($3, email), 
         notes = COALESCE($4, notes),
         total_spent = COALESCE($5, total_spent),
         orders_count = COALESCE($6, orders_count)
       WHERE id = $7 AND restaurant_id = $8 RETURNING *`,
      [name, phone, email, notes, total_spent, orders_count, req.params.id, req.user?.restaurantId]
    );
    res.json(result.rows[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Employees (Users table with roles)
router.get('/employees', authenticateToken, async (req: AuthRequest, res) => {
  const result = await pool.query('SELECT * FROM users WHERE restaurant_id = $1 ORDER BY name ASC', [req.user?.restaurantId]);
  res.json(result.rows);
});
router.post('/employees', authenticateToken, async (req: AuthRequest, res) => {
  const { name, email, role, active } = req.body;
  try {
    // Note: A real app requires sending an invite or generating a default password
    const hashedPassword = await bcrypt.hash('123456', 10);
    const result = await pool.query(
      `INSERT INTO users (restaurant_id, name, email, role, password_hash, active) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, role, active, created_at`,
      [req.user?.restaurantId, name, email, role, hashedPassword, active !== false]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});
router.put('/employees/:id', authenticateToken, async (req: AuthRequest, res) => {
  const { name, email, role, active } = req.body;
  try {
    const result = await pool.query(
      `UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email), role = COALESCE($3, role), active = COALESCE($4, active) WHERE id = $5 AND restaurant_id = $6 RETURNING id, name, email, role, active, created_at`,
      [name, email, role, active, req.params.id, req.user?.restaurantId]
    );
    res.json(result.rows[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Invoices (GET)
router.get('/invoices', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query('SELECT * FROM invoices WHERE restaurant_id = $1 ORDER BY date DESC', [req.user?.restaurantId]);
    res.json(result.rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Subscriptions
router.get('/subscriptions', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query('SELECT * FROM subscriptions WHERE restaurant_id = $1 ORDER BY start_date DESC', [req.user?.restaurantId]);
    res.json(result.rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});
router.post('/subscriptions', authenticateToken, async (req: AuthRequest, res) => {
  const { plan, price, billing_cycle, status, start_date, end_date, trial_end_date } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO subscriptions (restaurant_id, plan, price, billing_cycle, status, start_date, end_date, trial_end_date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.user?.restaurantId, plan, price, billing_cycle, status, start_date, end_date, trial_end_date]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});
router.put('/subscriptions/:id', authenticateToken, async (req: AuthRequest, res) => {
  const { plan, price, status } = req.body;
  try {
    const result = await pool.query(
      `UPDATE subscriptions SET plan = COALESCE($1, plan), price = COALESCE($2, price), status = COALESCE($3, status) WHERE id = $4 AND restaurant_id = $5 RETURNING *`,
      [plan, price, status, req.params.id, req.user?.restaurantId]
    );
    res.json(result.rows[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// --- SERVER-SENT EVENTS ---
// EventSource doesn't support custom headers, so the JWT is passed as ?token=
router.get('/events', (req: AuthRequest, res) => {
  const token = req.query.token as string;
  if (!token) return res.status(401).end();

  const user = verifyAccessToken(token);
  if (!user || !user.restaurantId) return res.status(401).end();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering if behind proxy
  res.flushHeaders();

  // Initial ping so the client knows the connection is open
  res.write(': connected\n\n');

  sseAdd(user.restaurantId, res);

  // Keepalive every 25s to prevent proxy timeouts
  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n'); } catch { /* ignore */ }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseRemove(user.restaurantId, res);
  });
});

// --- ANALYTICS ---
router.get('/analytics', authenticateToken, async (req: AuthRequest, res) => {
  const { range = '7d' } = req.query;
  const restaurantId = req.user?.restaurantId;

  try {
    const todayResult = await pool.query(`
      SELECT
        COUNT(*)::int as order_count,
        COALESCE(SUM(total_amount), 0)::numeric as total_revenue,
        COALESCE(AVG(total_amount), 0)::numeric as avg_ticket
      FROM orders
      WHERE restaurant_id = $1 AND status = 'paid' AND DATE(closed_at) = CURRENT_DATE
    `, [restaurantId]);

    let revenueByDay: any[] = [];
    let revenueByMonth: any[] = [];

    if (range === '12m') {
      const monthResult = await pool.query(`
        SELECT
          TO_CHAR(d.month, 'Mon') as month,
          COALESCE(SUM(o.total_amount), 0)::numeric as revenue
        FROM generate_series(
          DATE_TRUNC('month', CURRENT_DATE - INTERVAL '11 months'),
          DATE_TRUNC('month', CURRENT_DATE),
          '1 month'
        ) AS d(month)
        LEFT JOIN orders o ON DATE_TRUNC('month', o.closed_at) = d.month
          AND o.restaurant_id = $1 AND o.status = 'paid'
        GROUP BY d.month ORDER BY d.month
      `, [restaurantId]);
      revenueByMonth = monthResult.rows.map(r => ({ month: r.month, revenue: Number(r.revenue) }));
    } else {
      const days = range === '30d' ? 29 : 6;
      const dayResult = await pool.query(`
        SELECT
          TO_CHAR(d.day, 'DD.MM') as date,
          COALESCE(SUM(o.total_amount), 0)::numeric as revenue
        FROM generate_series(CURRENT_DATE - ($2 * INTERVAL '1 day'), CURRENT_DATE, '1 day') AS d(day)
        LEFT JOIN orders o ON DATE(o.closed_at) = d.day
          AND o.restaurant_id = $1 AND o.status = 'paid'
        GROUP BY d.day ORDER BY d.day
      `, [restaurantId, days]);
      revenueByDay = dayResult.rows.map(r => ({ date: r.date, revenue: Number(r.revenue) }));
    }

    const topItemsResult = await pool.query(`
      SELECT
        oi.name,
        SUM(oi.quantity)::int as count,
        SUM(oi.quantity * oi.price)::numeric as revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.restaurant_id = $1 AND o.status = 'paid'
      GROUP BY oi.name ORDER BY count DESC LIMIT 10
    `, [restaurantId]);

    const categoryResult = await pool.query(`
      SELECT
        COALESCE(mc.name, 'Друго') as name,
        SUM(oi.quantity * oi.price)::numeric as value
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
      LEFT JOIN menu_categories mc ON mi.menu_category_id = mc.id
      WHERE o.restaurant_id = $1 AND o.status = 'paid'
      GROUP BY mc.name ORDER BY value DESC LIMIT 6
    `, [restaurantId]);

    res.json({
      today: {
        revenue: Number(todayResult.rows[0]?.total_revenue || 0),
        orderCount: Number(todayResult.rows[0]?.order_count || 0),
        avgTicket: Math.round(Number(todayResult.rows[0]?.avg_ticket || 0)),
      },
      revenueByDay,
      revenueByMonth,
      topItems: topItemsResult.rows.map(r => ({ name: r.name, count: Number(r.count), revenue: Number(r.revenue) })),
      byCategory: categoryResult.rows.map(r => ({ name: r.name, value: Number(r.value) })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
