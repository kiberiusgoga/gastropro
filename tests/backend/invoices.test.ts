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

// Proper UUIDs — Zod rejects anything that isn't UUID format.
// The product mock id must match the UUID used in the request body so the Map lookup succeeds.
const P1   = '550e8400-e29b-41d4-a716-446655440001'
const P2   = '550e8400-e29b-41d4-a716-446655440002'
const PO1  = '550e8400-e29b-41d4-a716-446655440010'
const INV1 = '550e8400-e29b-41d4-a716-446655440020'

const managerToken = () =>
  generateAccessToken({ id: 'u1', email: 'mgr@r1.com', role: 'Manager', restaurantId: 'r1' })
const waiterToken = () =>
  generateAccessToken({ id: 'u2', email: 'wtr@r1.com', role: 'Waiter', restaurantId: 'r1' })
const r2Token = () =>
  generateAccessToken({ id: 'u3', email: 'mgr@r2.com', role: 'Manager', restaurantId: 'r2' })

// Base request body. All tests that need variant bodies spread from this.
const baseBody = {
  invoice_number: 'INV-001',
  supplier_name: 'Supplier A',
  date: '2025-01-01',
  items: [{ product_id: P1, quantity: 5, price: 50 }],
}

// Product row returned by the bulk SELECT. The id must equal the product_id in the request
// so the Map lookup in the handler succeeds.
const flour = { id: P1, name: 'Flour', default_expiry_days: null }

// Sets up client.query mock sequence for a single-item invoice.
// Call order in the handler:
//   [0] BEGIN
//   [1] SELECT products (bulk)
//   [2] INSERT invoices RETURNING id
//   [3] INSERT invoice_items
//   [4] updateStock: SELECT current_stock FOR UPDATE
//   [5] updateStock: UPDATE products SET current_stock
//   [6] updateStock: INSERT transactions
//   [7] UPDATE products SET purchase_price   (skipped when price = 0)
//   [?] UPDATE purchase_orders               (only when withPo = true)
//   [-] COMMIT
function mockSingleItemInvoice({
  product = flour,
  invoiceId = INV1,
  currentStock = '10.000',
  price = 50,
  withPo = false,
}: {
  product?: object
  invoiceId?: string
  currentStock?: string
  price?: number
  withPo?: boolean
} = {}) {
  mockClient.query
    .mockResolvedValueOnce({ rows: [] })                                              // BEGIN
    .mockResolvedValueOnce({ rows: [product], rowCount: 1 })                          // bulk SELECT products
    .mockResolvedValueOnce({ rows: [{ id: invoiceId }], rowCount: 1 })               // INSERT invoices
    .mockResolvedValueOnce({ rows: [], rowCount: 1 })                                 // INSERT invoice_items
    .mockResolvedValueOnce({ rows: [{ current_stock: currentStock }], rowCount: 1 })  // updateStock SELECT
    .mockResolvedValueOnce({ rows: [], rowCount: 1 })                                 // updateStock UPDATE stock
    .mockResolvedValueOnce({ rows: [], rowCount: 1 })                                 // updateStock INSERT txn

  if (price > 0) {
    mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 1 })                 // UPDATE purchase_price
  }
  if (withPo) {
    mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 1 })                 // UPDATE purchase_orders status
  }

  mockClient.query.mockResolvedValueOnce({ rows: [] })                               // COMMIT
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPool.connect.mockResolvedValue(mockClient)
})

// ── RBAC ─────────────────────────────────────────────────────────────────────

describe('RBAC', () => {
  it('12 — Waiter cannot create invoices → 403', async () => {
    const res = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${waiterToken()}`)
      .send(baseBody)
    expect(res.status).toBe(403)
  })
})

// ── Basic creation ────────────────────────────────────────────────────────────

describe('Basic invoice creation', () => {
  it('1 — creates invoice and items, returns 201 with invoice id', async () => {
    mockSingleItemInvoice()

    const res = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${managerToken()}`)
      .send(baseBody)

    expect(res.status).toBe(201)
    expect(res.body.id).toBe(INV1)
  })

  it('2 — name on invoice_items matches product name at creation time', async () => {
    mockSingleItemInvoice({ product: { id: P1, name: 'Flour', default_expiry_days: null } })

    await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${managerToken()}`)
      .send(baseBody)

    const invoiceItemsCall = mockClient.query.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('INSERT INTO invoice_items'),
    )
    // INSERT param order: $1=invoice_id $2=product_id $3=quantity $4=price $5=total $6=name $7=restaurant_id $8=expiry_date
    expect(invoiceItemsCall?.[1][5]).toBe('Flour')
  })

  it('3 — restaurant_id on invoice_items matches parent invoice restaurant', async () => {
    mockSingleItemInvoice()

    await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${managerToken()}`)
      .send(baseBody)

    const invoiceItemsCall = mockClient.query.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('INSERT INTO invoice_items'),
    )
    expect(invoiceItemsCall?.[1][6]).toBe('r1')
  })
})

// ── Expiry date ───────────────────────────────────────────────────────────────

describe('Expiry date handling', () => {
  it('4 — explicit expiry_date in item is stored as-is', async () => {
    mockSingleItemInvoice()

    await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${managerToken()}`)
      .send({
        ...baseBody,
        items: [{ product_id: P1, quantity: 5, price: 50, expiry_date: '2025-03-15' }],
      })

    const invoiceItemsCall = mockClient.query.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('INSERT INTO invoice_items'),
    )
    expect(invoiceItemsCall?.[1][7]).toBe('2025-03-15')
  })

  it('5 — no expiry_date + product has default_expiry_days → auto-computed', async () => {
    // Invoice date 2025-01-01, default 7 days → expiry_date 2025-01-08
    mockSingleItemInvoice({ product: { id: P1, name: 'Flour', default_expiry_days: 7 } })

    await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${managerToken()}`)
      .send({ ...baseBody, date: '2025-01-01' })

    const invoiceItemsCall = mockClient.query.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('INSERT INTO invoice_items'),
    )
    expect(invoiceItemsCall?.[1][7]).toBe('2025-01-08')
  })

  it('6 — no expiry_date + product default_expiry_days NULL → expiry_date NULL', async () => {
    mockSingleItemInvoice({ product: { id: P1, name: 'Flour', default_expiry_days: null } })

    await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${managerToken()}`)
      .send(baseBody)

    const invoiceItemsCall = mockClient.query.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('INSERT INTO invoice_items'),
    )
    expect(invoiceItemsCall?.[1][7]).toBeNull()
  })
})

// ── purchase_price update ─────────────────────────────────────────────────────

describe('purchase_price update on receipt', () => {
  it('7 — item.price > 0 → products.purchase_price updated to receipt price', async () => {
    mockSingleItemInvoice({ price: 75 })

    await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${managerToken()}`)
      .send({ ...baseBody, items: [{ product_id: P1, quantity: 5, price: 75 }] })

    const priceUpdateCall = mockClient.query.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('SET purchase_price'),
    )
    expect(priceUpdateCall).toBeDefined()
    // $1=new price, $2=product_id, $3=restaurant_id
    expect(priceUpdateCall?.[1][0]).toBe(75)
    expect(priceUpdateCall?.[1][1]).toBe(P1)
    expect(priceUpdateCall?.[1][2]).toBe('r1')
  })

  it('8 — item.price = 0 → purchase_price NOT updated (preserves existing price)', async () => {
    mockSingleItemInvoice({ price: 0 })

    await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${managerToken()}`)
      .send({ ...baseBody, items: [{ product_id: P1, quantity: 5, price: 0 }] })

    const priceUpdateCall = mockClient.query.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('SET purchase_price'),
    )
    expect(priceUpdateCall).toBeUndefined()
  })
})

// ── Purchase order receive flow ───────────────────────────────────────────────

describe('Purchase order receive flow', () => {
  it('9 — source_purchase_order_id → PO status set to received', async () => {
    // assertOwns uses pool.query (not client.query) — mock it before the transaction opens
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: PO1 }], rowCount: 1 })
    mockSingleItemInvoice({ withPo: true })

    const res = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${managerToken()}`)
      .send({ ...baseBody, source_purchase_order_id: PO1 })

    expect(res.status).toBe(201)

    const poUpdateCall = mockClient.query.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes("status = 'received'"),
    )
    expect(poUpdateCall).toBeDefined()
    expect(poUpdateCall?.[1][0]).toBe(PO1)
    expect(poUpdateCall?.[1][1]).toBe('r1')
  })

  it('10 — source_purchase_order_id from another restaurant → 404', async () => {
    // assertOwns returns 0 rows → NotFoundError before pool.connect() is called
    mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 })

    const res = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${managerToken()}`)
      .send({ ...baseBody, source_purchase_order_id: PO1 })

    expect(res.status).toBe(404)
    expect(mockPool.connect).not.toHaveBeenCalled()
  })
})

// ── Cross-tenant product isolation ────────────────────────────────────────────

describe('Cross-tenant product isolation', () => {
  it('11 — product_id from another restaurant → 404, transaction rolled back', async () => {
    // Bulk product SELECT returns 0 rows — product does not exist for this tenant
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })              // BEGIN
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // bulk SELECT → product absent
      .mockResolvedValueOnce({ rows: [] })              // ROLLBACK (catch block)

    const res = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${managerToken()}`)
      .send({ ...baseBody, items: [{ product_id: P2, quantity: 1, price: 10 }] })

    expect(res.status).toBe(404)

    const rollbackCall = mockClient.query.mock.calls.find(
      (c: unknown[]) => c[0] === 'ROLLBACK',
    )
    expect(rollbackCall).toBeDefined()
  })
})

// ── is_initial_inventory flag ─────────────────────────────────────────────────

describe('is_initial_inventory flag', () => {
  it('13 — is_initial_inventory=true is stored in the invoices INSERT', async () => {
    mockSingleItemInvoice()

    await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${managerToken()}`)
      .send({ ...baseBody, is_initial_inventory: true })

    const invoiceInsertCall = mockClient.query.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('INSERT INTO invoices'),
    )
    // INSERT param order: $1=invoice_number $2=supplier_name $3=date $4=total_amount
    // $5=status $6=user_id $7=restaurant_id $8=is_initial_inventory $9=source_po_id
    expect(invoiceInsertCall?.[1][7]).toBe(true)
  })
})

// ── Audit log ─────────────────────────────────────────────────────────────────

describe('Audit log', () => {
  it('14 — logAuthEvent called with invoice_created action and correct metadata', async () => {
    mockSingleItemInvoice({ invoiceId: INV1 })

    await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${managerToken()}`)
      .send(baseBody)

    expect(mockLogAuthEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'invoice_created',
        user_id: 'u1',
        restaurant_id: 'r1',
        metadata: expect.objectContaining({
          invoice_id: INV1,
          invoice_number: 'INV-001',
          item_count: 1,
          total_amount: 250,
          is_initial_inventory: false,
        }),
      }),
    )
  })
})

// ── Atomic rollback ───────────────────────────────────────────────────────────

describe('Atomic rollback', () => {
  it('15 — if updateStock fails mid-transaction, ROLLBACK called, COMMIT and logAuthEvent not called', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                                             // BEGIN
      .mockResolvedValueOnce({ rows: [flour], rowCount: 1 })                           // bulk SELECT products
      .mockResolvedValueOnce({ rows: [{ id: INV1 }], rowCount: 1 })                   // INSERT invoices
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })                                // INSERT invoice_items
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })                                // updateStock SELECT → 0 rows → NotFoundError
      .mockResolvedValueOnce({ rows: [] })                                             // ROLLBACK (catch block)

    const res = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${managerToken()}`)
      .send(baseBody)

    expect(res.status).toBe(404)

    const commitCall   = mockClient.query.mock.calls.find((c: unknown[]) => c[0] === 'COMMIT')
    const rollbackCall = mockClient.query.mock.calls.find((c: unknown[]) => c[0] === 'ROLLBACK')

    expect(commitCall).toBeUndefined()
    expect(rollbackCall).toBeDefined()
    expect(mockLogAuthEvent).not.toHaveBeenCalled()
  })
})
