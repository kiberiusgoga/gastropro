import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('../../src/db', () => ({
  default: { query: vi.fn(), connect: vi.fn() },
}))
vi.mock('../../src/lib/logger', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
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
const mockClient = { query: vi.fn(), release: vi.fn() }

const tokenMgr = () => generateAccessToken({ id: 'u1', email: 'a@r1.com', role: 'Manager', restaurantId: 'r1' })
const tokenWaiter = () => generateAccessToken({ id: 'u2', email: 'b@r1.com', role: 'Waiter', restaurantId: 'r1' })

// Valid v4 UUIDs required by Zod
const CAT1 = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const P1   = '550e8400-e29b-41d4-a716-446655440001'
const INV1 = '550e8400-e29b-41d4-a716-446655440020'

const validProduct = {
  name: 'Брашно',
  unit: 'kg',
  purchase_price: 40,
  selling_price: 0,
  min_stock: 10,
  category_id: CAT1,
}

const createdRow = {
  id: P1,
  restaurant_id: 'r1',
  name: 'Брашно',
  unit: 'kg',
  purchase_price: '40.00',
  selling_price: '0.00',
  category_id: CAT1,
  current_stock: '0.000',
  default_expiry_days: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPool.connect.mockResolvedValue(mockClient)
})

// Helper: mocks BEGIN + INSERT products
function mockProductInsert(row = createdRow) {
  mockClient.query
    .mockResolvedValueOnce({ rows: [] })                        // BEGIN
    .mockResolvedValueOnce({ rows: [row], rowCount: 1 })        // INSERT products
}

// Helper: appends createInvoiceWithReceipt sequence for one item (purchase_price > 0)
function appendReceiptMocks({ price = 40 }: { price?: number } = {}) {
  const product = { id: P1, name: 'Брашно', default_expiry_days: null }
  mockClient.query
    .mockResolvedValueOnce({ rows: [product], rowCount: 1 })                    // SELECT products
    .mockResolvedValueOnce({ rows: [{ id: INV1 }], rowCount: 1 })               // INSERT invoices
    .mockResolvedValueOnce({ rows: [], rowCount: 1 })                            // INSERT invoice_items
    .mockResolvedValueOnce({ rows: [{ current_stock: '0.000' }], rowCount: 1 }) // updateStock SELECT
    .mockResolvedValueOnce({ rows: [], rowCount: 1 })                            // updateStock UPDATE
    .mockResolvedValueOnce({ rows: [], rowCount: 1 })                            // updateStock INSERT txn
  if (price > 0) {
    mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 1 })            // UPDATE purchase_price
  }
  // no PO update — source_purchase_order_id is null for initial inventory
}

describe('POST /products', () => {
  it('1 — current_stock=0 → 201, returns product row (no receipt)', async () => {
    mockProductInsert()
    mockClient.query.mockResolvedValueOnce({ rows: [] }) // COMMIT

    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${tokenMgr()}`)
      .send(validProduct)

    expect(res.status).toBe(201)
    expect(res.body.name).toBe('Брашно')
    expect(res.body.restaurant_id).toBe('r1')
    // 3 client calls: BEGIN, INSERT, COMMIT
    expect(mockClient.query).toHaveBeenCalledTimes(3)
  })

  it('2 — current_stock=5, purchase_price=40 → 201, hybrid flow (11 client calls)', async () => {
    mockProductInsert()
    appendReceiptMocks({ price: 40 })
    mockClient.query.mockResolvedValueOnce({ rows: [] }) // COMMIT

    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${tokenMgr()}`)
      .send({ ...validProduct, current_stock: 5 })

    expect(res.status).toBe(201)
    expect(res.body.id).toBe(P1)
    // BEGIN + INSERT + SELECT products + INSERT invoices + INSERT items + updateStock(3) + UPDATE purchase_price + COMMIT = 10
    expect(mockClient.query).toHaveBeenCalledTimes(10)
  })

  it('3 — current_stock=5, purchase_price=0 → no purchase_price UPDATE (10 client calls)', async () => {
    mockProductInsert({ ...createdRow, purchase_price: '0.00' })
    appendReceiptMocks({ price: 0 })
    mockClient.query.mockResolvedValueOnce({ rows: [] }) // COMMIT

    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${tokenMgr()}`)
      .send({ ...validProduct, purchase_price: 0, current_stock: 5 })

    expect(res.status).toBe(201)
    // BEGIN + INSERT + SELECT products + INSERT invoices + INSERT items + updateStock(3) + COMMIT = 9
    expect(mockClient.query).toHaveBeenCalledTimes(9)
  })

  it('4 — default_expiry_days=30 → 201, value forwarded to INSERT', async () => {
    mockProductInsert({ ...createdRow, default_expiry_days: 30 })
    mockClient.query.mockResolvedValueOnce({ rows: [] }) // COMMIT

    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${tokenMgr()}`)
      .send({ ...validProduct, default_expiry_days: 30 })

    expect(res.status).toBe(201)
    // $9 in INSERT call is 30
    const insertCall = mockClient.query.mock.calls[1]
    expect(insertCall[1][8]).toBe(30)
  })

  it('5 — duplicate name → 409 with Macedonian message and ROLLBACK', async () => {
    const pgDupe = Object.assign(new Error('dupe'), {
      code: '23505',
      constraint: 'products_restaurant_name_unique',
    })
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })   // BEGIN
      .mockRejectedValueOnce(pgDupe)         // INSERT throws
      .mockResolvedValueOnce({ rows: [] })   // ROLLBACK

    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${tokenMgr()}`)
      .send(validProduct)

    expect(res.status).toBe(409)
    expect(res.body.message).toContain('Брашно')
    expect(res.body.message).toContain('веќе постои')
    const calls = mockClient.query.mock.calls.map((c: any[]) => c[0])
    expect(calls).toContain('ROLLBACK')
  })

  it('6 — Waiter role → 403', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${tokenWaiter()}`)
      .send(validProduct)

    expect(res.status).toBe(403)
  })

  it('7 — missing name → 400', async () => {
    const { name: _n, ...noName } = validProduct
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${tokenMgr()}`)
      .send(noName)

    expect(res.status).toBe(400)
  })
})

describe('PUT /products/:id', () => {
  const updatedRow = { id: 'p1', restaurant_id: 'r1', ...validProduct }

  it('8 — default_expiry_days=30 → SQL includes default_expiry_days column', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [updatedRow], rowCount: 1 })

    const res = await request(app)
      .put('/api/products/p1')
      .set('Authorization', `Bearer ${tokenMgr()}`)
      .send({ ...validProduct, default_expiry_days: 30 })

    expect(res.status).toBe(200)
    const sql: string = mockPool.query.mock.calls[0][0]
    expect(sql).toContain('default_expiry_days')
    // $9 is the expiry value, $10=id, $11=restaurantId
    expect(mockPool.query.mock.calls[0][1][8]).toBe(30)
  })

  it('9 — no default_expiry_days field → SQL does NOT include default_expiry_days', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [updatedRow], rowCount: 1 })

    const res = await request(app)
      .put('/api/products/p1')
      .set('Authorization', `Bearer ${tokenMgr()}`)
      .send(validProduct)

    expect(res.status).toBe(200)
    const sql: string = mockPool.query.mock.calls[0][0]
    expect(sql).not.toContain('default_expiry_days')
    // Params: name,barcode,unit,pp,sp,cat,min,active,id,restaurantId = 10
    expect(mockPool.query.mock.calls[0][1]).toHaveLength(10)
  })

  it('10 — default_expiry_days=null → column set to NULL ($9=null)', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [updatedRow], rowCount: 1 })

    const res = await request(app)
      .put('/api/products/p1')
      .set('Authorization', `Bearer ${tokenMgr()}`)
      .send({ ...validProduct, default_expiry_days: null })

    expect(res.status).toBe(200)
    const sql: string = mockPool.query.mock.calls[0][0]
    expect(sql).toContain('default_expiry_days')
    expect(mockPool.query.mock.calls[0][1][8]).toBeNull()
  })
})
