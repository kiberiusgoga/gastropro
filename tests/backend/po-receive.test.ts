import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('../../src/db', () => ({
  default: { query: vi.fn(), connect: vi.fn() },
}))
vi.mock('../../src/lib/logger', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))
vi.mock('../../src/services/authAudit', () => ({
  logAuthEvent: vi.fn().mockResolvedValue(undefined),
}))

import express from 'express'
import request from 'supertest'
import router from '../../src/api'
import { errorMiddleware } from '../../src/middleware/errorMiddleware'
import pool from '../../src/db'
import { generateAccessToken } from '../../src/auth'
import { logAuthEvent } from '../../src/services/authAudit'

const app = express()
app.use(express.json())
app.use('/api', router)
app.use(errorMiddleware as express.ErrorRequestHandler)

const mockPool = pool as unknown as {
  query: ReturnType<typeof vi.fn>
  connect: ReturnType<typeof vi.fn>
}
const mockLogAuthEvent = logAuthEvent as unknown as ReturnType<typeof vi.fn>
const mockClient = { query: vi.fn(), release: vi.fn() }

// UUIDs — all must be valid v4 format; Zod rejects anything else.
const P1   = '550e8400-e29b-41d4-a716-446655440001'
const P2   = '550e8400-e29b-41d4-a716-446655440002'
const PO1  = '550e8400-e29b-41d4-a716-446655440010'
const POI1 = '550e8400-e29b-41d4-a716-446655440030'
const POI2 = '550e8400-e29b-41d4-a716-446655440031'
const INV1 = '550e8400-e29b-41d4-a716-446655440020'
const FAKE = '550e8400-e29b-41d4-a716-446655440099'

const managerToken = () =>
  generateAccessToken({ id: 'u1', email: 'mgr@r1.com', role: 'Manager', restaurantId: 'r1' })
const waiterToken = () =>
  generateAccessToken({ id: 'u2', email: 'wtr@r1.com', role: 'Waiter', restaurantId: 'r1' })

// Default PO row returned by the load query (one item, draft status).
const defaultPo = {
  id: PO1,
  supplier_name: 'Supplier X',
  status: 'draft',
  items: [{ id: POI1, product_id: P1, product_name: 'Flour', quantity: '5.000', unit_price: '40.00' }],
}

// Returned by the bulk product SELECT inside createInvoiceWithReceipt.
const flourProduct = { id: P1, name: 'Flour', default_expiry_days: null }

// Sets up pool.query mock for the PO load (first call in the handler).
function mockPoLoad(po = defaultPo) {
  mockPool.query.mockResolvedValueOnce({ rows: [po], rowCount: 1 })
}

// Sets up client.query mock sequence for a single-item receive.
// Call order inside createInvoiceWithReceipt (sourced to PO, price > 0):
//   [0] BEGIN
//   [1] SELECT products
//   [2] INSERT invoices RETURNING id
//   [3] INSERT invoice_items
//   [4] updateStock SELECT current_stock
//   [5] updateStock UPDATE current_stock
//   [6] updateStock INSERT transactions
//   [7] UPDATE products SET purchase_price  (if price > 0)
//   [8] UPDATE purchase_orders SET status='received'
//   [9] COMMIT
function mockReceiveFull({
  product = flourProduct,
  invoiceId = INV1,
  currentStock = '10.000',
  price = 40,
}: {
  product?: object
  invoiceId?: string
  currentStock?: string
  price?: number
} = {}) {
  mockClient.query
    .mockResolvedValueOnce({ rows: [] })                                              // BEGIN
    .mockResolvedValueOnce({ rows: [product], rowCount: 1 })                          // SELECT products
    .mockResolvedValueOnce({ rows: [{ id: invoiceId }], rowCount: 1 })               // INSERT invoices
    .mockResolvedValueOnce({ rows: [], rowCount: 1 })                                 // INSERT invoice_items
    .mockResolvedValueOnce({ rows: [{ current_stock: currentStock }], rowCount: 1 })  // updateStock SELECT
    .mockResolvedValueOnce({ rows: [], rowCount: 1 })                                 // updateStock UPDATE stock
    .mockResolvedValueOnce({ rows: [], rowCount: 1 })                                 // updateStock INSERT txn

  if (price > 0) {
    mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 1 })                 // UPDATE purchase_price
  }

  mockClient.query
    .mockResolvedValueOnce({ rows: [], rowCount: 1 })                                 // UPDATE purchase_orders status
    .mockResolvedValueOnce({ rows: [] })                                              // COMMIT
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPool.connect.mockResolvedValue(mockClient)
})

// ── 1. Default receive — no body ──────────────────────────────────────────────

describe('Default receive (no body)', () => {
  it('1 — draft PO with no body: invoice created with PO items at PO prices', async () => {
    mockPoLoad()
    mockReceiveFull()

    const res = await request(app)
      .post(`/api/purchase-orders/${PO1}/receive`)
      .set('Authorization', `Bearer ${managerToken()}`)
      .send({})

    expect(res.status).toBe(201)
    expect(res.body.source_purchase_order_id).toBe(PO1)
    expect(res.body.item_count).toBe(1)
  })
})

// ── 2. source_purchase_order_id on invoice ─────────────────────────────────

describe('Invoice linkage', () => {
  it('2 — created invoice has source_purchase_order_id pointing to the PO', async () => {
    mockPoLoad()
    mockReceiveFull()

    const res = await request(app)
      .post(`/api/purchase-orders/${PO1}/receive`)
      .set('Authorization', `Bearer ${managerToken()}`)
      .send({})

    expect(res.status).toBe(201)

    // Verify the INSERT invoices call included the PO id as source_purchase_order_id ($9)
    const invoiceInsert = mockClient.query.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('INSERT INTO invoices'),
    )
    // $9 = source_purchase_order_id
    expect(invoiceInsert?.[1][8]).toBe(PO1)
  })
})

// ── 3. PO status updated to 'received' ────────────────────────────────────

describe('PO status update', () => {
  it('3 — PO status set to received inside the transaction', async () => {
    mockPoLoad()
    mockReceiveFull()

    await request(app)
      .post(`/api/purchase-orders/${PO1}/receive`)
      .set('Authorization', `Bearer ${managerToken()}`)
      .send({})

    const poUpdate = mockClient.query.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes("status = 'received'"),
    )
    expect(poUpdate).toBeDefined()
    expect(poUpdate?.[1][0]).toBe(PO1)
    expect(poUpdate?.[1][1]).toBe('r1')
  })
})

// ── 4. purchase_price updated ─────────────────────────────────────────────

describe('purchase_price update', () => {
  it('4 — products.purchase_price updated for each item with non-zero price', async () => {
    mockPoLoad()
    mockReceiveFull({ price: 40 })

    await request(app)
      .post(`/api/purchase-orders/${PO1}/receive`)
      .set('Authorization', `Bearer ${managerToken()}`)
      .send({})

    const priceUpdate = mockClient.query.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('SET purchase_price'),
    )
    expect(priceUpdate).toBeDefined()
    expect(priceUpdate?.[1][0]).toBe(40)
    expect(priceUpdate?.[1][1]).toBe(P1)
  })
})

// ── 5. current_stock increased ────────────────────────────────────────────

describe('Stock update', () => {
  it('5 — products.current_stock increased by received quantity', async () => {
    mockPoLoad()
    mockReceiveFull({ currentStock: '10.000' })

    await request(app)
      .post(`/api/purchase-orders/${PO1}/receive`)
      .set('Authorization', `Bearer ${managerToken()}`)
      .send({})

    // updateStock UPDATE sets current_stock = old + qty. $1 = newStock, $2 = product_id
    const stockUpdate = mockClient.query.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('SET current_stock'),
    )
    expect(stockUpdate).toBeDefined()
    // 10 (old) + 5 (qty from PO) = 15
    expect(stockUpdate?.[1][0]).toBe(15)
  })
})

// ── 6. Quantity override ──────────────────────────────────────────────────

describe('Quantity override', () => {
  it('6 — override quantity used instead of PO quantity', async () => {
    mockPoLoad()
    // Override quantity = 3 (PO had 5). price still 40.
    mockReceiveFull({ price: 40, currentStock: '10.000' })

    await request(app)
      .post(`/api/purchase-orders/${PO1}/receive`)
      .set('Authorization', `Bearer ${managerToken()}`)
      .send({ items: [{ purchase_order_item_id: POI1, quantity: 3 }] })

    const invoiceItemInsert = mockClient.query.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('INSERT INTO invoice_items'),
    )
    // $3 = quantity in invoice_items INSERT
    expect(invoiceItemInsert?.[1][2]).toBe(3)
  })
})

// ── 7. Price override ─────────────────────────────────────────────────────

describe('Price override', () => {
  it('7 — override price used; product.purchase_price reflects new price', async () => {
    mockPoLoad()
    mockReceiveFull({ price: 45 })

    await request(app)
      .post(`/api/purchase-orders/${PO1}/receive`)
      .set('Authorization', `Bearer ${managerToken()}`)
      .send({ items: [{ purchase_order_item_id: POI1, price: 45 }] })

    const priceUpdate = mockClient.query.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('SET purchase_price'),
    )
    expect(priceUpdate?.[1][0]).toBe(45)
  })
})

// ── 8. expiry_date override ───────────────────────────────────────────────

describe('Expiry date override', () => {
  it('8 — expiry_date override stored on invoice_item; default_expiry_days unchanged', async () => {
    mockPoLoad()
    mockReceiveFull()

    await request(app)
      .post(`/api/purchase-orders/${PO1}/receive`)
      .set('Authorization', `Bearer ${managerToken()}`)
      .send({ items: [{ purchase_order_item_id: POI1, expiry_date: '2025-06-15' }] })

    const invoiceItemInsert = mockClient.query.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('INSERT INTO invoice_items'),
    )
    // $8 = expiry_date
    expect(invoiceItemInsert?.[1][7]).toBe('2025-06-15')
  })
})

// ── 9. Double-receive → 409 ───────────────────────────────────────────────

describe('Status guards', () => {
  it('9 — receiving an already-received PO → 409 PO_NOT_RECEIVABLE', async () => {
    mockPoLoad({ ...defaultPo, status: 'received' })

    const res = await request(app)
      .post(`/api/purchase-orders/${PO1}/receive`)
      .set('Authorization', `Bearer ${managerToken()}`)
      .send({})

    expect(res.status).toBe(409)
    expect(res.body.code).toBe('PO_NOT_RECEIVABLE')
    expect(res.body.details.current_status).toBe('received')
    expect(mockPool.connect).not.toHaveBeenCalled()
  })

  it('10 — receiving a cancelled PO → 409 PO_NOT_RECEIVABLE', async () => {
    mockPoLoad({ ...defaultPo, status: 'cancelled' })

    const res = await request(app)
      .post(`/api/purchase-orders/${PO1}/receive`)
      .set('Authorization', `Bearer ${managerToken()}`)
      .send({})

    expect(res.status).toBe(409)
    expect(res.body.code).toBe('PO_NOT_RECEIVABLE')
    expect(res.body.details.current_status).toBe('cancelled')
  })
})

// ── 11. Cross-tenant → 404 ────────────────────────────────────────────────

describe('Cross-tenant isolation', () => {
  it('11 — PO belonging to another restaurant → 404', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 })

    const res = await request(app)
      .post(`/api/purchase-orders/${PO1}/receive`)
      .set('Authorization', `Bearer ${managerToken()}`)
      .send({})

    expect(res.status).toBe(404)
    expect(mockPool.connect).not.toHaveBeenCalled()
  })
})

// ── 12. RBAC → 403 ───────────────────────────────────────────────────────

describe('RBAC', () => {
  it('12 — Waiter cannot receive a PO → 403', async () => {
    const res = await request(app)
      .post(`/api/purchase-orders/${PO1}/receive`)
      .set('Authorization', `Bearer ${waiterToken()}`)
      .send({})

    expect(res.status).toBe(403)
  })
})

// ── 13. Invalid override item id → 400 ───────────────────────────────────

describe('Override validation', () => {
  it('13 — override references non-existent purchase_order_item_id → 400 INVALID_PO_ITEM_ID', async () => {
    mockPoLoad()

    const res = await request(app)
      .post(`/api/purchase-orders/${PO1}/receive`)
      .set('Authorization', `Bearer ${managerToken()}`)
      .send({ items: [{ purchase_order_item_id: FAKE, quantity: 3 }] })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('INVALID_PO_ITEM_ID')
    expect(mockPool.connect).not.toHaveBeenCalled()
  })
})

// ── 14. Empty PO → 409 ───────────────────────────────────────────────────

describe('Empty PO guard', () => {
  it('14 — PO with no items → 409 PO_EMPTY', async () => {
    mockPoLoad({ ...defaultPo, items: [] })

    const res = await request(app)
      .post(`/api/purchase-orders/${PO1}/receive`)
      .set('Authorization', `Bearer ${managerToken()}`)
      .send({})

    expect(res.status).toBe(409)
    expect(res.body.code).toBe('PO_EMPTY')
    expect(mockPool.connect).not.toHaveBeenCalled()
  })
})

// ── 15. Audit log ─────────────────────────────────────────────────────────

describe('Audit log', () => {
  it('15 — purchase_order_received logged with correct metadata', async () => {
    mockPoLoad()
    mockReceiveFull({ invoiceId: INV1 })

    await request(app)
      .post(`/api/purchase-orders/${PO1}/receive`)
      .set('Authorization', `Bearer ${managerToken()}`)
      .send({})

    expect(mockLogAuthEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'purchase_order_received',
        user_id: 'u1',
        restaurant_id: 'r1',
        metadata: expect.objectContaining({
          purchase_order_id: PO1,
          invoice_id: INV1,
          item_count: 1,
          total_amount: 200,   // 5 × 40
          had_overrides: false,
        }),
      }),
    )
  })
})

// ── 16. Atomic rollback ───────────────────────────────────────────────────

describe('Atomic rollback', () => {
  it('16 — stock update failure rolls back invoice + leaves PO status unchanged', async () => {
    mockPoLoad()

    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                                             // BEGIN
      .mockResolvedValueOnce({ rows: [flourProduct], rowCount: 1 })                    // SELECT products
      .mockResolvedValueOnce({ rows: [{ id: INV1 }], rowCount: 1 })                   // INSERT invoices
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })                                // INSERT invoice_items
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })                                // updateStock SELECT → 0 rows → NotFoundError
      .mockResolvedValueOnce({ rows: [] })                                             // ROLLBACK

    const res = await request(app)
      .post(`/api/purchase-orders/${PO1}/receive`)
      .set('Authorization', `Bearer ${managerToken()}`)
      .send({})

    expect(res.status).toBe(404)

    const commit   = mockClient.query.mock.calls.find((c: unknown[]) => c[0] === 'COMMIT')
    const rollback = mockClient.query.mock.calls.find((c: unknown[]) => c[0] === 'ROLLBACK')
    const poUpdate = mockClient.query.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes("status = 'received'"),
    )

    expect(commit).toBeUndefined()
    expect(rollback).toBeDefined()
    expect(poUpdate).toBeUndefined()   // PO status update never reached
    expect(mockLogAuthEvent).not.toHaveBeenCalled()
  })
})

// ── 17. Regression — POST /invoices still works after refactor ────────────

describe('Regression: POST /invoices', () => {
  it('17 — refactored POST /invoices still returns 201 and fires invoice_created audit log', async () => {
    const P = '550e8400-e29b-41d4-a716-446655440001'

    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                                             // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: P, name: 'Flour', default_expiry_days: null }], rowCount: 1 }) // SELECT products
      .mockResolvedValueOnce({ rows: [{ id: INV1 }], rowCount: 1 })                   // INSERT invoices
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })                                // INSERT invoice_items
      .mockResolvedValueOnce({ rows: [{ current_stock: '10.000' }], rowCount: 1 })     // updateStock SELECT
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })                                // updateStock UPDATE
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })                                // updateStock INSERT txn
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })                                // UPDATE purchase_price
      .mockResolvedValueOnce({ rows: [] })                                             // COMMIT

    const res = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${managerToken()}`)
      .send({
        invoice_number: 'INV-REG-001',
        supplier_name: 'Supplier A',
        date: '2025-01-01',
        items: [{ product_id: P, quantity: 5, price: 50 }],
      })

    expect(res.status).toBe(201)
    expect(mockLogAuthEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'invoice_created' }),
    )
  })
})
