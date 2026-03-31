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

// --- AUTH ---

router.post('/auth/login', asyncHandler(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  
  const result = await pool.query('SELECT * FROM users WHERE email = $1 AND active = TRUE', [email]);
  const user = result.rows[0];

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    logger.warn('Failed login attempt', { email, ip: req.ip });
    throw new AuthenticationError('Invalid credentials');
  }

  const userData = { id: user.id, email: user.email, role: user.role };
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
      role: user.role
    }
  });
}));

router.post('/auth/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw new AuthenticationError('Refresh token required');

  const userData = verifyRefreshToken(refreshToken);
  if (!userData) throw new AuthenticationError('Invalid or expired refresh token');

  const newAccessToken = generateAccessToken({ id: userData.id, email: userData.email, role: userData.role });
  res.json({ accessToken: newAccessToken });
}));

// --- CATEGORIES ---

router.get('/categories', authenticateToken, asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT * FROM categories ORDER BY name');
  res.json(result.rows);
}));

router.post('/categories', authenticateToken, authorizeRole(['Admin', 'Manager']), asyncHandler(async (req, res) => {
  const { name } = categorySchema.parse(req.body);
  
  // Check for duplicate
  const existing = await pool.query('SELECT id FROM categories WHERE name = $1', [name]);
  if (existing.rowCount && existing.rowCount > 0) {
    throw new ConflictError('Category already exists');
  }

  const result = await pool.query('INSERT INTO categories (name) VALUES ($1) RETURNING *', [name]);
  res.status(201).json(result.rows[0]);
}));

router.put('/categories/:id', authenticateToken, authorizeRole(['Admin', 'Manager']), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name } = categorySchema.parse(req.body);
  
  const result = await pool.query('UPDATE categories SET name = $1 WHERE id = $2 RETURNING *', [name, id]);
  if (result.rowCount === 0) throw new NotFoundError('Category not found');
  res.json(result.rows[0]);
}));

router.delete('/categories/:id', authenticateToken, authorizeRole(['Admin', 'Manager']), asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Check if category has products
  const products = await pool.query('SELECT id FROM products WHERE category_id = $1 LIMIT 1', [id]);
  if (products.rowCount && products.rowCount > 0) {
    throw new ValidationError('Category has products and cannot be deleted');
  }
  
  const result = await pool.query('DELETE FROM categories WHERE id = $1', [id]);
  if (result.rowCount === 0) throw new NotFoundError('Category not found');
  
  res.json({ message: 'Category deleted successfully' });
}));

// --- PRODUCTS ---

router.get('/products', authenticateToken, asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT * FROM products ORDER BY name');
  res.json(result.rows);
}));

router.post('/products', authenticateToken, authorizeRole(['Admin', 'Manager']), asyncHandler(async (req, res) => {
  const data = productSchema.parse(req.body);
  
  const result = await pool.query(
    'INSERT INTO products (name, barcode, unit, purchase_price, selling_price, category_id, min_stock) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
    [data.name, data.barcode, data.unit, data.purchase_price, data.selling_price, data.category_id, data.min_stock]
  );
  res.status(201).json(result.rows[0]);
}));

router.put('/products/:id', authenticateToken, authorizeRole(['Admin', 'Manager']), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const data = productSchema.parse(req.body);
  
  const result = await pool.query(
    'UPDATE products SET name = $1, barcode = $2, unit = $3, purchase_price = $4, selling_price = $5, category_id = $6, min_stock = $7, active = $8, updated_at = CURRENT_TIMESTAMP WHERE id = $9 RETURNING *',
    [data.name, data.barcode, data.unit, data.purchase_price, data.selling_price, data.category_id, data.min_stock, data.active, id]
  );
  if (result.rowCount === 0) throw new NotFoundError('Product not found');
  res.json(result.rows[0]);
}));

router.delete('/products/:id', authenticateToken, authorizeRole(['Admin', 'Manager']), asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Check for transactions
  const transactions = await pool.query('SELECT id FROM transactions WHERE product_id = $1 LIMIT 1', [id]);
  if (transactions.rowCount && transactions.rowCount > 0) {
    throw new ValidationError('Product has history and cannot be deleted. Deactivate it instead.');
  }
  
  const result = await pool.query('DELETE FROM products WHERE id = $1', [id]);
  if (result.rowCount === 0) throw new NotFoundError('Product not found');
  
  res.json({ message: 'Product deleted successfully' });
}));

// --- INVENTORY TRANSACTION ENGINE ---

async function updateStock(client: { query: (text: string, params?: unknown[]) => Promise<unknown> }, productId: string, type: 'input' | 'output' | 'receipt' | 'inventory_check', quantity: number, userId: string, note?: string, referenceId?: string) {
  const productResult = await client.query('SELECT current_stock FROM products WHERE id = $1 FOR UPDATE', [productId]);
  if (productResult.rowCount === 0) throw new NotFoundError(`Product not found`);
  
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

  await client.query('UPDATE products SET current_stock = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newStock, productId]);

  const diff = type === 'inventory_check' ? Math.abs(newStock - currentStock) : movementQty;

  await client.query(
    'INSERT INTO transactions (product_id, type, quantity, previous_stock, new_stock, user_id, reference_id, note) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
    [productId, type, diff, currentStock, newStock, userId, referenceId, note]
  );
  
  logger.info('Inventory transaction recorded', {
    productId,
    type,
    quantity: diff,
    previousStock: currentStock,
    newStock,
    userId,
    referenceId,
  });

  return newStock;
}

// --- INVOICES (Stock Increase) ---

router.post('/invoices', authenticateToken, asyncHandler(async (req: AuthRequest, res: express.Response) => {
  const { invoice_number, supplier_name, date, items } = invoiceSchema.parse(req.body);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const total_amount = items.reduce((acc, item) => acc + (item.quantity * item.price), 0);
    
    const invoiceResult = await client.query(
      'INSERT INTO invoices (invoice_number, supplier_name, date, total_amount, status, user_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [invoice_number, supplier_name, date, total_amount, 'completed', req.user?.id]
    );
    const invoiceId = invoiceResult.rows[0].id;

    for (const item of items) {
      await client.query(
        'INSERT INTO invoice_items (invoice_id, product_id, quantity, price, total) VALUES ($1, $2, $3, $4, $5)',
        [invoiceId, item.product_id, item.quantity, item.price, item.quantity * item.price]
      );

      await updateStock(client, item.product_id, 'receipt', item.quantity, req.user?.id || '', `Invoice #${invoice_number}`, invoiceId);
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

// --- INVENTORY MOVEMENTS (Stock Decrease/Increase) ---

router.post('/inventory/input', authenticateToken, async (req: AuthRequest, res) => {
  req.body.type = 'input';
  return router.handle(req, res, () => {}); // This is a bit hacky, better to extract logic
});

router.post('/inventory/output', authenticateToken, async (req: AuthRequest, res) => {
  req.body.type = 'output';
  return router.handle(req, res, () => {});
});

// Centralized movement recorder
async function recordMovement(req: AuthRequest, res: express.Response) {
  const { product_id, type, quantity, note } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const newStock = await updateStock(client, product_id, type, quantity, req.user?.id || '', note);
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
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Get Bundle Items
    const itemsResult = await client.query('SELECT product_id, quantity FROM bundle_items WHERE bundle_id = $1', [bundle_id]);
    if (itemsResult.rowCount === 0) throw new Error('Bundle not found or has no items');

    // 2. Deduct each item
    for (const item of itemsResult.rows) {
      const totalDeduction = item.quantity * quantity;
      await updateStock(client, item.product_id, 'output', totalDeduction, req.user?.id || '', `Bundle deduction: ${note || ''}`, bundle_id);
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

router.get('/transactions', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.*, p.name as product_name, u.name as user_name 
       FROM transactions t 
       JOIN products p ON t.product_id = p.id 
       JOIN users u ON t.user_id = u.id 
       ORDER BY t.date DESC LIMIT 100`
    );
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// --- DASHBOARD STATS ---

router.get('/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM products) as total_products,
        (SELECT SUM(current_stock * purchase_price) FROM products) as inventory_value,
        (SELECT COUNT(*) FROM products WHERE current_stock <= min_stock) as low_stock_alerts,
        (SELECT COUNT(*) FROM transactions WHERE date >= CURRENT_DATE) as daily_transactions
    `);
    res.json(stats.rows[0]);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// --- USER MANAGEMENT ---

router.get('/users', authenticateToken, authorizeRole(['Admin']), async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email, role, active, created_at as "createdAt" FROM users ORDER BY name');
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.post('/users', authenticateToken, authorizeRole(['Admin']), async (req, res) => {
  const { name, email, role, active, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password || 'password123', 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, role, active, password) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, active, created_at as "createdAt"',
      [name, email, role, active, hashedPassword]
    );
    res.status(201).json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Failed to create user' });
  }
});

router.put('/users/:id', authenticateToken, authorizeRole(['Admin']), async (req, res) => {
  const { id } = req.params;
  const { name, email, role, active } = req.body;
  try {
    const result = await pool.query(
      'UPDATE users SET name = $1, email = $2, role = $3, active = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING id, name, email, role, active, created_at as "createdAt"',
      [name, email, role, active, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// --- BUNDLES (Normatives) ---

router.get('/bundles', authenticateToken, async (req, res) => {
  try {
    const bundlesResult = await pool.query('SELECT * FROM bundles WHERE active = TRUE ORDER BY name');
    const bundles = bundlesResult.rows;

    for (const bundle of bundles) {
      const itemsResult = await pool.query(
        `SELECT bi.*, p.name as product_name, p.unit 
         FROM bundle_items bi 
         JOIN products p ON bi.product_id = p.id 
         WHERE bi.bundle_id = $1`,
        [bundle.id]
      );
      bundle.items = itemsResult.rows;
    }

    res.json(bundles);
  } catch {
    res.status(500).json({ error: 'Failed to fetch bundles' });
  }
});

router.post('/bundles', authenticateToken, authorizeRole(['Admin', 'Manager']), async (req, res) => {
  const { name, sellingPrice, items } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const bundleResult = await client.query(
      'INSERT INTO bundles (name, selling_price) VALUES ($1, $2) RETURNING *',
      [name, sellingPrice]
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

router.put('/bundles/:id', authenticateToken, authorizeRole(['Admin', 'Manager']), async (req, res) => {
  const { id } = req.params;
  const { name, sellingPrice, items, active } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const bundleResult = await client.query(
      'UPDATE bundles SET name = $1, selling_price = $2, active = $3 WHERE id = $4 RETURNING *',
      [name, sellingPrice, active !== undefined ? active : true, id]
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

router.delete('/bundles/:id', authenticateToken, authorizeRole(['Admin', 'Manager']), async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('UPDATE bundles SET active = FALSE WHERE id = $1', [id]);
    res.json({ message: 'Bundle deactivated successfully' });
  } catch {
    res.status(500).json({ error: 'Failed to delete bundle' });
  }
});

// --- INVENTORY CHECKS ---

router.get('/inventory-checks', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM inventory_checks ORDER BY date DESC');
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Failed to fetch inventory checks' });
  }
});

router.post('/inventory-checks', authenticateToken, async (req: AuthRequest, res) => {
  const { items } = req.body;
  const userId = req.user?.id || '';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const checkResult = await client.query(
      'INSERT INTO inventory_checks (user_id, status) VALUES ($1, $2) RETURNING *',
      [userId, 'completed']
    );
    const checkId = checkResult.rows[0].id;

    for (const item of items) {
      const diff = item.realQty - item.systemQty;
      
      await client.query(
        'INSERT INTO inventory_check_items (check_id, product_id, system_qty, real_qty, diff) VALUES ($1, $2, $3, $4, $5)',
        [checkId, item.productId, item.systemQty, item.realQty, diff]
      );

      if (diff !== 0) {
        await updateStock(client, item.productId, 'inventory_check', item.realQty, userId, `Inventory check diff (${diff > 0 ? '+' : ''}${diff})`, checkId);
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

router.get('/reports/sales', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.name as product_name,
        SUM(ii.quantity) as total_quantity,
        SUM(ii.total) as total_revenue
      FROM invoice_items ii
      JOIN products p ON ii.product_id = p.id
      GROUP BY p.id, p.name
      ORDER BY total_revenue DESC
    `);
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/reports/inventory', authenticateToken, async (req, res) => {
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
      ORDER BY stock_value DESC
    `);
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
