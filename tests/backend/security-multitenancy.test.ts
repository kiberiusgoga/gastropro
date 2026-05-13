/**
 * Security tests: multi-tenancy isolation
 *
 * These tests describe the REQUIRED secure behavior.
 * All tests must pass after the fixes in Step 4 are applied.
 *
 * Vulnerabilities covered:
 *   Issue 1 — Table status hijack  (POST /orders, PUT /orders/:id)
 *   Issue 2 — menu_item_categories IDOR  (POST/PUT/DELETE /menu-items/:id/categories[/:cid])
 *   Issue 3 — Bundle items cross-tenant product reference  (POST/PUT /bundles)
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('../../src/db', () => ({
  default: { query: vi.fn(), connect: vi.fn() },
}))
vi.mock('../../src/lib/logger', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))
vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn(), compare: vi.fn() },
  hash: vi.fn(),
  compare: vi.fn(),
}))

import express from 'express'
import request from 'supertest'
import router from '../../src/api'
import { errorMiddleware } from '../../src/middleware/errorMiddleware'
import pool from '../../src/db'
import { generateAccessToken } from '../../src/auth'

const app = express()
app.use(express.json())
app.use('/api', router)
app.use(errorMiddleware as express.ErrorRequestHandler)

const mockPool = pool as unknown as {
  query: ReturnType<typeof vi.fn>
  connect: ReturnType<typeof vi.fn>
}

/** Build a mock transaction client whose query() returns the given responses in order. */
function makeClient(responses: Array<{ rows?: any[]; rowCount?: number }>) {
  const client = { query: vi.fn(), release: vi.fn() }
  for (const r of responses) {
    client.query.mockResolvedValueOnce({ rows: r.rows ?? [], rowCount: r.rowCount ?? (r.rows?.length ?? 0) })
  }
  return client
}

/** Generates a fresh JWT for Tenant A (r1) each time it is called. */
const tokenA = () => generateAccessToken({ id: 'user-a', email: 'a@r1.com', role: 'Admin', restaurantId: 'r1' })

beforeEach(() => vi.clearAllMocks())

// ============================================================
// Issue 1 — Table status hijack
// Affected routes: POST /orders, PUT /orders/:id
//
// Fix applied: AND restaurant_id = $N added to both UPDATE queries.
// ============================================================

describe('Issue 1 — table status cross-tenant isolation', () => {
  it('POST /orders — UPDATE restaurant_tables must include restaurant_id in WHERE params', async () => {
    // Tenant A (r1) creates an order with table_id='table-r2' belonging to Tenant B.
    // The UPDATE restaurant_tables query must be scoped by restaurant_id ('r1').
    // requireActiveShift uses pool.query (not client.query)
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'shift-1' }] })
    const mockClient = makeClient([
      { rows: [], rowCount: 0 },                                                 // BEGIN
      { rows: [{ id: 'order-1', restaurant_id: 'r1', table_id: 'table-r2' }] }, // INSERT orders
      { rows: [], rowCount: 0 },                                                 // UPDATE restaurant_tables (occupied)
      { rows: [], rowCount: 0 },                                                 // applyOrderInventory SELECT
      { rows: [], rowCount: 0 },                                                 // COMMIT
    ])
    mockPool.connect.mockResolvedValueOnce(mockClient)

    await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA()}`)
      .send({ table_id: 'table-r2', order_type: 'dine_in', guest_count: 2 })

    const tableUpdateCall = mockClient.query.mock.calls.find(
      ([sql]: [string]) =>
        typeof sql === 'string' &&
        sql.includes('UPDATE restaurant_tables') &&
        sql.toLowerCase().includes('occupied'),
    )

    expect(tableUpdateCall).toBeDefined()
    // The restaurant_id from the JWT ('r1') MUST appear in the WHERE clause parameters.
    expect(tableUpdateCall![1]).toContain('r1')
  })

  it('PUT /orders/:id — UPDATE restaurant_tables must include restaurant_id in WHERE params when closing an order', async () => {
    // Tenant A closes an order whose table_id belongs to Tenant B.
    // The "free table" UPDATE must be scoped by restaurant_id ('r1').
    const mockClient = makeClient([
      { rows: [], rowCount: 0 },                                                                   // BEGIN
      { rows: [{ id: 'order-1', restaurant_id: 'r1', table_id: 'table-r2', status: 'paid' }] },  // UPDATE orders
      { rows: [], rowCount: 0 },                                                                   // SELECT open orders on table
      { rows: [], rowCount: 0 },                                                                   // UPDATE restaurant_tables (free)
      { rows: [], rowCount: 0 },                                                                   // COMMIT
    ])
    mockPool.connect.mockResolvedValueOnce(mockClient)

    await request(app)
      .put('/api/orders/order-1')
      .set('Authorization', `Bearer ${tokenA()}`)
      .send({ status: 'paid' })

    const tableUpdateCall = mockClient.query.mock.calls.find(
      ([sql]: [string]) =>
        typeof sql === 'string' &&
        sql.includes('UPDATE restaurant_tables') &&
        sql.toLowerCase().includes('free'),
    )

    expect(tableUpdateCall).toBeDefined()
    // After fix: params include restaurant_id ('r1').
    expect(tableUpdateCall![1]).toContain('r1')
  })
})

// ============================================================
// Issue 2 — menu_item_categories IDOR
// Affected routes:
//   POST   /menu-items/:id/categories
//   PUT    /menu-items/:id/categories/:cid
//   DELETE /menu-items/:id/categories/:cid
//
// Fix applied: ownership check SELECT added before each write.
// The mock uses SQL-pattern dispatch so the same mock works for
// both the unfixed (single query) and fixed (ownership + write) paths.
// ============================================================

describe('Issue 2 — menu_item_categories IDOR', () => {
  /**
   * SQL-aware mock:
   *   - SELECT from menu_categories  → category belongs to r1 (passes)
   *   - SELECT from menu_items       → mi-r2 does NOT belong to r1 (fails → 404)
   *   - any other query              → would succeed cross-tenant (demonstrates the bug pre-fix)
   */
  function setupIssue2Mock() {
    mockPool.query.mockImplementation((sql: string) => {
      const s = sql.toLowerCase()
      if (s.includes('from menu_categories'))
        return Promise.resolve({ rows: [{ id: 'cat-r1' }], rowCount: 1 })
      if (s.includes('from menu_items'))
        return Promise.resolve({ rows: [], rowCount: 0 }) // cross-tenant: item not in r1
      // INSERT / UPDATE / DELETE — would succeed without the fix
      return Promise.resolve({ rows: [{ menu_item_id: 'mi-r2', category_id: 'cat-r1' }], rowCount: 1 })
    })
  }

  it('POST /menu-items/:id/categories — must return 404 when menu item belongs to another restaurant', async () => {
    // Tenant A tries to assign their category (cat-r1) to Tenant B's menu item (mi-r2).
    // Fix: ownership check on :id → 404.
    setupIssue2Mock()
    const res = await request(app)
      .post('/api/menu-items/mi-r2/categories')
      .set('Authorization', `Bearer ${tokenA()}`)
      .send({ category_id: 'cat-r1' })
    expect(res.status).toBe(404)
  })

  it('PUT /menu-items/:id/categories/:cid — must return 404 for cross-tenant junction update', async () => {
    // Tenant A updates a junction row for Tenant B's menu item.
    // Fix: ownership check on :id → 404.
    setupIssue2Mock()
    const res = await request(app)
      .put('/api/menu-items/mi-r2/categories/cat-r2')
      .set('Authorization', `Bearer ${tokenA()}`)
      .send({ price_override: 0, sort_order: 0 })
    expect(res.status).toBe(404)
  })

  it('DELETE /menu-items/:id/categories/:cid — must return 404 for cross-tenant junction delete', async () => {
    // Tenant A deletes a category assignment for Tenant B's menu item.
    // Fix: ownership check on :id → 404.
    setupIssue2Mock()
    const res = await request(app)
      .delete('/api/menu-items/mi-r2/categories/cat-r2')
      .set('Authorization', `Bearer ${tokenA()}`)
    expect(res.status).toBe(404)
  })
})

// ============================================================
// Issue 3 — Bundle items cross-tenant product reference
// Affected routes: POST /bundles, PUT /bundles/:id
//
// Fix applied: pre-transaction validation loop using pool.query.
//   - pool.query  → used for the new ownership check (pre-transaction)
//   - pool.connect → mockClient used only when validation passes (full transaction)
//
// The mock separates these two paths cleanly:
//   Unfixed: pool.query never called → pool.connect → transaction → 201
//   Fixed:   pool.query called → 0 rows → 404 (pool.connect never called)
// ============================================================

describe('Issue 3 — bundle items cross-tenant product reference', () => {
  it('POST /bundles — must return 404 when a bundle item references a product from another restaurant', async () => {
    // Tenant A creates a bundle with item.productId = 'prod-r2' (Tenant B's product).
    // Fix: pre-transaction pool.query ownership check → 0 rows → 404.
    mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }) // product not in r1

    // mockClient is set up for the unprotected transaction path (used only if fix is absent)
    const mockClient = makeClient([
      { rowCount: 0 },                                                          // BEGIN
      { rows: [{ id: 'bundle-1', restaurant_id: 'r1' }], rowCount: 1 },        // INSERT bundles
      { rows: [{}], rowCount: 1 },                                              // INSERT bundle_items (cross-tenant)
      { rowCount: 0 },                                                          // COMMIT
    ])
    mockPool.connect.mockResolvedValueOnce(mockClient)

    const res = await request(app)
      .post('/api/bundles')
      .set('Authorization', `Bearer ${tokenA()}`)
      .send({ name: 'Test Bundle', sellingPrice: 500, items: [{ productId: 'prod-r2', quantity: 1 }] })

    expect(res.status).toBe(404)
  })

  it('PUT /bundles/:id — must return 404 when replacement items reference a product from another restaurant', async () => {
    // Tenant A updates their bundle with item.productId = 'prod-r2'.
    // Fix: pre-transaction pool.query ownership check → 0 rows → 404.
    mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }) // product not in r1

    const mockClient = makeClient([
      { rowCount: 0 },                                                                                       // BEGIN
      { rows: [{ id: 'bundle-1', restaurant_id: 'r1', name: 'B', selling_price: 500 }], rowCount: 1 },     // UPDATE bundles
      { rowCount: 0 },                                                                                       // DELETE bundle_items
      { rows: [{}], rowCount: 1 },                                                                          // INSERT bundle_items (cross-tenant)
      { rowCount: 0 },                                                                                       // COMMIT
    ])
    mockPool.connect.mockResolvedValueOnce(mockClient)

    const res = await request(app)
      .put('/api/bundles/bundle-1')
      .set('Authorization', `Bearer ${tokenA()}`)
      .send({ name: 'Updated Bundle', sellingPrice: 600, active: true, items: [{ productId: 'prod-r2', quantity: 2 }] })

    expect(res.status).toBe(404)
  })
})
