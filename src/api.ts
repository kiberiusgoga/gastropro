import express from 'express';
import bcrypt from 'bcryptjs';
import pool from './db';
import { authenticateToken, AuthRequest, authorizeRole, generateAccessToken, generateRefreshToken, verifyRefreshToken } from './auth';
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

// --- AUTH ---

router.post('/auth/login', asyncHandler(async (req, res) => {
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

async function updateStock(client: { query: (text: string, params?: unknown[]) => Promise<{rowCount: number | null, rows: any[]}> }, productId: string, type: 'input' | 'output' | 'receipt' | 'inventory_check', quantity: number, userId: string, restaurantId: string, note?: string, referenceId?: string) {
  const productResult = await client.query('SELECT current_stock FROM products WHERE id = $1 AND restaurant_id = $2 FOR UPDATE', [productId, restaurantId]);
  if (!productResult.rowCount || productResult.rowCount === 0) throw new NotFoundError(`Product not found`);
  
  const currentStock = parseFloat(productResult.rows[0].current_stock);
  const movementQty = parseFloat(quantity.toString());
  
  let newStock = currentStock;
  if (type === 'output') {
    newStock -= movementQty;
  } else if (type === 'input' || type === 'receipt') {
    newStock += movementQty;
  } else if (type === 'inventory_check') {
    newStock = movementQty; // In this case quantity is the new stock
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
router.get('/menu-categories', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query('SELECT * FROM menu_categories WHERE restaurant_id = $1 ORDER BY sort_order, name', [req.user?.restaurantId]);
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/menu-categories', authenticateToken, async (req: AuthRequest, res) => {
  const { name, sort_order, active } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO menu_categories (restaurant_id, name, sort_order, active) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.user?.restaurantId, name, sort_order || 0, active !== false]
    );
    res.status(201).json(result.rows[0]);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.put('/menu-categories/:id', authenticateToken, async (req: AuthRequest, res) => {
  const { name, sort_order, active } = req.body;
  try {
    const result = await pool.query(
      'UPDATE menu_categories SET name = $1, sort_order = $2, active = $3 WHERE id = $4 AND restaurant_id = $5 RETURNING *',
      [name, sort_order, active, req.params.id, req.user?.restaurantId]
    );
    res.json(result.rows[0]);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.delete('/menu-categories/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    await pool.query('DELETE FROM menu_categories WHERE id = $1 AND restaurant_id = $2', [req.params.id, req.user?.restaurantId]);
    res.json({ message: 'Deleted' });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// --- MENU ITEMS ---
router.get('/menu-items', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query('SELECT * FROM menu_items WHERE restaurant_id = $1 ORDER BY name', [req.user?.restaurantId]);
    res.json(result.rows);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

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

// --- TABLES ---
router.get('/tables', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query('SELECT * FROM restaurant_tables WHERE restaurant_id = $1 ORDER BY number', [req.user?.restaurantId]);
    res.json(result.rows);
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
  const { name, type, connection_type, station, active } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO printers (restaurant_id, name, type, connection_type, station, active) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [req.user?.restaurantId, name, type, connection_type, station, active !== false]
    );
    res.status(201).json(result.rows[0]);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
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

    await client.query('COMMIT');
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

    await client.query('COMMIT');
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
  try {
    const orderRes = await pool.query('SELECT id FROM orders WHERE id = $1 AND restaurant_id = $2', [req.params.id, req.user?.restaurantId]);
    if (orderRes.rowCount === 0) return res.status(404).json({ error: 'Order not found' });
    
    let updates = [];
    let params: any[] = [];
    let idx = 1;
    if (quantity !== undefined) { updates.push(`quantity = $${idx++}`); params.push(quantity); }
    if (status !== undefined) { updates.push(`status = $${idx++}`); params.push(status); }
    
    if (updates.length > 0) {
       params.push(req.params.itemId, req.params.id);
       const itemRes = await pool.query(
         `UPDATE order_items SET ${updates.join(', ')} WHERE id = $${idx} AND order_id = $${idx+1} RETURNING *`,
         params
       );
       res.json(itemRes.rows[0]);
    } else {
       const itemRes = await pool.query('SELECT * FROM order_items WHERE id = $1 AND order_id = $2', [req.params.itemId, req.params.id]);
       res.json(itemRes.rows[0]);
    }
  } catch (error: any) { res.status(500).json({ error: error.message }); }
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

// --- SECONDARY MODULES (PHASE 4) ---

// Reservations
router.get('/reservations', authenticateToken, async (req: AuthRequest, res) => {
  const result = await pool.query('SELECT * FROM reservations WHERE restaurant_id = $1 ORDER BY date DESC, time DESC', [req.user?.restaurantId]);
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

export default router;
