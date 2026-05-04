/**
 * Security tests: multi-tenancy isolation
 *
 * These tests describe the REQUIRED secure behavior.
 * Tests marked with "CURRENTLY FAILS" demonstrate an unfixed vulnerability.
 * All tests must pass after Step 4 fixes are applied.
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
// Bug: UPDATE restaurant_tables SET status=... WHERE id=$1
//      omits AND restaurant_id=... allowing any authenticated
//      tenant to flip the status of any table system-wide.
//
// Fix required: add AND restaurant_id=$N to both UPDATE queries.
// ============================================================

describe('Issue 1 — table status cross-tenant isolation', () => {
  it('POST /orders — UPDATE restaurant_tables must include restaurant_id in WHERE params', async () => {
    // Tenant A (r1) creates an order with table_id='table-r2' that belongs to Tenant B.
    // SECURE behavior: the UPDATE restaurant_tables query is scoped by restaurant_id from JWT ('r1').
    // CURRENTLY FAILS: the UPDATE is `WHERE id=$1` only — 'r1' never appears in its params.
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

    // The UPDATE must have been issued
    expect(tableUpdateCall).toBeDefined()

    // The restaurant_id from the JWT ('r1') MUST appear in the WHERE clause parameters.
    // After the fix: params = [table_id, restaurantId] → 'r1' is present.
    // Before the fix: params = [table_id] only → 'r1' is absent → test FAILS here.
    expect(tableUpdateCall![1]).toContain('r1')
  })

  it('PUT /orders/:id — UPDATE restaurant_tables must include restaurant_id in WHERE params when closing an order', async () => {
    // Tenant A closes an order whose table_id belongs to Tenant B.
    // SECURE behavior: the "free table" UPDATE is scoped by restaurant_id ('r1').
    // CURRENTLY FAILS: UPDATE restaurant_tables SET status='free' WHERE id=$1 — no filter.
    const mockClient = makeClient([
      { rows: [], rowCount: 0 },                                                                         // BEGIN
      { rows: [{ id: 'order-1', restaurant_id: 'r1', table_id: 'table-r2', status: 'paid' }] },         // UPDATE orders
      { rows: [], rowCount: 0 },                                                                         // SELECT open orders on table
      { rows: [], rowCount: 0 },                                                                         // UPDATE restaurant_tables (free)
      { rows: [], rowCount: 0 },                                                                         // COMMIT
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
    // Before fix: params are [table_id] only → 'r1' absent → test FAILS here.
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
// Bug: the junction table is modified using only client-supplied
//      menu_item_id + category_id with no restaurant_id check.
//      Any authenticated user can modify any tenant's category
//      assignments if they know (or guess) the UUIDs.
//
// Fix required: validate that menu_item_id belongs to req.user.restaurantId
//               before allowing write operations.
// ============================================================

describe('Issue 2 — menu_item_categories IDOR', () => {
  it('POST /menu-items/:id/categories — must return 404 when menu item belongs to another restaurant', async () => {
    // Tenant A (r1) tries to assign their category to Tenant B's menu item (mi-r2).
    // SECURE behavior: server checks ownership of :id → not found → 404.
    // CURRENTLY FAILS: category_id is validated but :id is never checked → returns 201.
    mockPool.query
      // category ownership check — passes (cat-r1 belongs to r1)
      .mockResolvedValueOnce({ rows: [{ id: 'cat-r1' }], rowCount: 1 })
      // If the fix is in place, a menu-item ownership check runs here and returns 0 rows.
      // Without the fix, we jump straight to INSERT which returns a row → 201.
      .mockResolvedValueOnce({ rows: [{ menu_item_id: 'mi-r2', category_id: 'cat-r1' }], rowCount: 1 })

    const res = await request(app)
      .post('/api/menu-items/mi-r2/categories')
      .set('Authorization', `Bearer ${tokenA()}`)
      .send({ category_id: 'cat-r1' })

    // Expected after fix: 404 — 'mi-r2' is not in restaurant r1.
    // CURRENTLY FAILS: returns 201.
    expect(res.status).toBe(404)
  })

  it('PUT /menu-items/:id/categories/:cid — must return 404 for cross-tenant junction update (no restaurant check today)', async () => {
    // Tenant A updates a junction row belonging to Tenant B's item.
    // The current UPDATE uses only menu_item_id + category_id — zero restaurant isolation.
    // SECURE behavior: server validates :id belongs to r1 → not found → 404.
    // CURRENTLY FAILS: the UPDATE succeeds and returns 200.
    mockPool.query.mockResolvedValueOnce({
      rows: [{ menu_item_id: 'mi-r2', category_id: 'cat-r2', price_override: 99 }],
      rowCount: 1,
    })

    const res = await request(app)
      .put('/api/menu-items/mi-r2/categories/cat-r2')
      .set('Authorization', `Bearer ${tokenA()}`)
      .send({ price_override: 0, sort_order: 0 })

    // Expected after fix: 404.
    // CURRENTLY FAILS: returns 200 — no restaurant check exists.
    expect(res.status).toBe(404)
  })

  it('DELETE /menu-items/:id/categories/:cid — must return 404 for cross-tenant junction delete (no restaurant check today)', async () => {
    // Tenant A deletes a category assignment for Tenant B's menu item.
    // SECURE behavior: validate :id belongs to r1 → not found → 404.
    // CURRENTLY FAILS: DELETE runs without any restaurant check → returns 200.
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'j1' }], rowCount: 1 })

    const res = await request(app)
      .delete('/api/menu-items/mi-r2/categories/cat-r2')
      .set('Authorization', `Bearer ${tokenA()}`)

    // Expected after fix: 404.
    // CURRENTLY FAILS: returns 200.
    expect(res.status).toBe(404)
  })
})

// ============================================================
// Issue 3 — Bundle items cross-tenant product reference
// Affected routes: POST /bundles, PUT /bundles/:id
//
// Bug: items[].productId (client-supplied) is inserted into
//      bundle_items without verifying the product belongs to the
//      requesting restaurant.  A tenant can anchor their bundle
//      to another tenant's product.
//
// Fix required: validate each item.productId against restaurant_id
//               before INSERT; return 422 if any product is foreign.
// ============================================================

describe('Issue 3 — bundle items cross-tenant product reference', () => {
  it('POST /bundles — must return 422 when a bundle item references a product from another restaurant', async () => {
    // Tenant A creates a bundle whose item.productId = 'prod-r2' (belongs to Tenant B).
    // SECURE behavior: server validates product ownership → 422 unprocessable.
    // CURRENTLY FAILS: no validation → INSERT proceeds → 201.
    const mockClient = makeClient([
      { rows: [], rowCount: 0 },                                                 // BEGIN
      { rows: [{ id: 'bundle-1', restaurant_id: 'r1' }], rowCount: 1 },         // INSERT bundles
      // With fix: a product ownership check runs here and returns 0 rows → 422.
      // Without fix: INSERT bundle_items proceeds.
      { rows: [{}], rowCount: 1 },                                               // INSERT bundle_items
      { rows: [], rowCount: 0 },                                                 // COMMIT
    ])
    mockPool.connect.mockResolvedValueOnce(mockClient)

    const res = await request(app)
      .post('/api/bundles')
      .set('Authorization', `Bearer ${tokenA()}`)
      .send({ name: 'Test Bundle', sellingPrice: 500, items: [{ productId: 'prod-r2', quantity: 1 }] })

    // Expected after fix: 422.
    // CURRENTLY FAILS: returns 201.
    expect(res.status).toBe(422)
  })

  it('PUT /bundles/:id — must return 422 when replacement items reference a product from another restaurant', async () => {
    // Tenant A updates their bundle, passing item.productId = 'prod-r2'.
    // CURRENTLY FAILS: no validation → 200.
    const mockClient = makeClient([
      { rows: [], rowCount: 0 },                                                         // BEGIN
      { rows: [{ id: 'bundle-1', restaurant_id: 'r1', name: 'B', selling_price: 500 }], rowCount: 1 }, // UPDATE bundles
      { rows: [], rowCount: 0 },                                                         // DELETE bundle_items
      // With fix: product ownership check → 0 rows → ROLLBACK + 422.
      // Without fix: INSERT bundle_items proceeds.
      { rows: [{}], rowCount: 1 },                                                       // INSERT bundle_items
      { rows: [], rowCount: 0 },                                                         // COMMIT
    ])
    mockPool.connect.mockResolvedValueOnce(mockClient)

    const res = await request(app)
      .put('/api/bundles/bundle-1')
      .set('Authorization', `Bearer ${tokenA()}`)
      .send({ name: 'Updated Bundle', sellingPrice: 600, active: true, items: [{ productId: 'prod-r2', quantity: 2 }] })

    // Expected after fix: 422.
    // CURRENTLY FAILS: returns 200.
    expect(res.status).toBe(422)
  })
})
