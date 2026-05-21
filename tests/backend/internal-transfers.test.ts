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

const app = express()
app.use(express.json())
app.use('/api', router)
app.use(errorMiddleware as express.ErrorRequestHandler)

const mockPool = pool as unknown as {
  query: ReturnType<typeof vi.fn>
  connect: ReturnType<typeof vi.fn>
}
const mockClient = { query: vi.fn(), release: vi.fn() }

// Stable UUIDs
const WH_SRC  = '550e8400-e29b-41d4-a716-446655440001'  // source warehouse
const WH_DST  = '550e8400-e29b-41d4-a716-446655440002'  // destination warehouse
const PROD1   = '550e8400-e29b-41d4-a716-446655440010'  // product
const TRF1    = '550e8400-e29b-41d4-a716-446655440050'  // generated transfer id

const managerToken = () =>
  generateAccessToken({ id: 'u1', email: 'mgr@r1.com', role: 'Manager', restaurantId: 'r1' })
const warehouseWorkerToken = () =>
  generateAccessToken({ id: 'u2', email: 'ww@r1.com', role: 'Warehouse Worker', restaurantId: 'r1' })
const waiterToken = () =>
  generateAccessToken({ id: 'u3', email: 'wtr@r1.com', role: 'Waiter', restaurantId: 'r1' })

// The POST /transfers handler runs these client queries in order:
//   [0]  BEGIN
//   [1]  SELECT warehouses validate (both must return 2 rows)
//   [2]  SELECT products validate
//   Source updateStock:
//   [3]  SELECT warehouses (updateStock internal validation)
//   [4]  INSERT stock_levels ON CONFLICT DO NOTHING
//   [5]  SELECT stock_levels FOR UPDATE
//   [6]  UPDATE stock_levels
//   [7]  INSERT transactions
//   Destination updateStock:
//   [8]  SELECT warehouses (updateStock internal validation)
//   [9]  INSERT stock_levels ON CONFLICT DO NOTHING
//   [10] SELECT stock_levels FOR UPDATE
//   [11] UPDATE stock_levels
//   [12] INSERT transactions
//   [13] INSERT internal_transfers RETURNING id, created_at
//   [14] COMMIT
function mockTransferFull({
  sourceStock = '20.000',
  destStock = '0.000',
  transferId = TRF1,
}: {
  sourceStock?: string
  destStock?: string
  transferId?: string
} = {}) {
  const now = new Date().toISOString()
  mockClient.query
    .mockResolvedValueOnce({ rows: [] })                                                    // [0] BEGIN
    .mockResolvedValueOnce({ rows: [{ id: WH_SRC }, { id: WH_DST }], rowCount: 2 })       // [1] warehouses validate
    .mockResolvedValueOnce({ rows: [{ id: PROD1 }], rowCount: 1 })                         // [2] products validate
    // source updateStock
    .mockResolvedValueOnce({ rows: [{ id: WH_SRC }] })                                     // [3] warehouse validation
    .mockResolvedValueOnce({ rows: [], rowCount: 0 })                                       // [4] INSERT stock_levels
    .mockResolvedValueOnce({ rows: [{ quantity: sourceStock }], rowCount: 1 })              // [5] SELECT FOR UPDATE
    .mockResolvedValueOnce({ rows: [], rowCount: 1 })                                       // [6] UPDATE stock_levels
    .mockResolvedValueOnce({ rows: [], rowCount: 1 })                                       // [7] INSERT transactions
    // destination updateStock
    .mockResolvedValueOnce({ rows: [{ id: WH_DST }] })                                     // [8] warehouse validation
    .mockResolvedValueOnce({ rows: [], rowCount: 0 })                                       // [9] INSERT stock_levels
    .mockResolvedValueOnce({ rows: [{ quantity: destStock }], rowCount: 1 })                // [10] SELECT FOR UPDATE
    .mockResolvedValueOnce({ rows: [], rowCount: 1 })                                       // [11] UPDATE stock_levels
    .mockResolvedValueOnce({ rows: [], rowCount: 1 })                                       // [12] INSERT transactions
    .mockResolvedValueOnce({ rows: [{ id: transferId, created_at: now }], rowCount: 1 })   // [13] INSERT internal_transfers
    .mockResolvedValueOnce({ rows: [] })                                                    // [14] COMMIT
}

const validBody = {
  source_warehouse_id: WH_SRC,
  destination_warehouse_id: WH_DST,
  product_id: PROD1,
  quantity: 5,
  note: 'Kitchen restock',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPool.connect.mockResolvedValue(mockClient)
})

// ── 1. Happy path ─────────────────────────────────────────────────────────────

describe('Happy path', () => {
  it('1 — 201 with transfer id and correct fields', async () => {
    mockTransferFull()

    const res = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${managerToken()}`)
      .send(validBody)

    expect(res.status).toBe(201)
    expect(res.body.id).toBe(TRF1)
    expect(res.body.source_warehouse_id).toBe(WH_SRC)
    expect(res.body.destination_warehouse_id).toBe(WH_DST)
    expect(res.body.product_id).toBe(PROD1)
    expect(res.body.quantity).toBe(5)
    expect(res.body.note).toBe('Kitchen restock')
  })

  it('2 — Warehouse Worker role can create a transfer', async () => {
    mockTransferFull()

    const res = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${warehouseWorkerToken()}`)
      .send(validBody)

    expect(res.status).toBe(201)
  })
})

// ── 3. Stock movements ────────────────────────────────────────────────────────

describe('Stock movements', () => {
  it('3 — source stock deducted by quantity', async () => {
    mockTransferFull({ sourceStock: '20.000' })

    await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${managerToken()}`)
      .send(validBody)

    // [6] UPDATE stock_levels for source: $1 = newQty (20-5=15), $2 = WH_SRC, $3 = PROD1
    const sourceUpdate = mockClient.query.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' &&
        (c[0] as string).includes('UPDATE stock_levels') &&
        (c as [string, unknown[]])[1][1] === WH_SRC,
    )
    expect(sourceUpdate).toBeDefined()
    expect((sourceUpdate as [string, unknown[]])[1][0]).toBe(15)  // 20 - 5
  })

  it('4 — destination stock increased by quantity', async () => {
    mockTransferFull({ destStock: '3.000' })

    await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${managerToken()}`)
      .send(validBody)

    // [11] UPDATE stock_levels for destination: $1 = newQty (3+5=8), $2 = WH_DST, $3 = PROD1
    const destUpdate = mockClient.query.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' &&
        (c[0] as string).includes('UPDATE stock_levels') &&
        (c as [string, unknown[]])[1][1] === WH_DST,
    )
    expect(destUpdate).toBeDefined()
    expect((destUpdate as [string, unknown[]])[1][0]).toBe(8)   // 3 + 5
  })

  it('5 — internal_transfers record inserted with correct data', async () => {
    mockTransferFull()

    await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${managerToken()}`)
      .send(validBody)

    const insert = mockClient.query.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('INSERT INTO internal_transfers'),
    )
    expect(insert).toBeDefined()
    const params = (insert as [string, unknown[]])[1]
    expect(params[0]).toBe('r1')       // restaurant_id
    expect(params[1]).toBe(WH_SRC)     // source_warehouse_id
    expect(params[2]).toBe(WH_DST)     // destination_warehouse_id
    expect(params[3]).toBe(PROD1)      // product_id
    expect(params[4]).toBe(5)          // quantity
  })
})

// ── 6. Insufficient stock ─────────────────────────────────────────────────────

describe('Insufficient stock', () => {
  it('6 — transfer with insufficient source stock → 400 + ROLLBACK', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                                           // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: WH_SRC }, { id: WH_DST }], rowCount: 2 }) // warehouses
      .mockResolvedValueOnce({ rows: [{ id: PROD1 }], rowCount: 1 })                // products
      .mockResolvedValueOnce({ rows: [{ id: WH_SRC }] })                            // updateStock: warehouse validate
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })                              // updateStock: INSERT stock_levels
      .mockResolvedValueOnce({ rows: [{ quantity: '2.000' }], rowCount: 1 })         // stock = 2, need 5 → negative
      .mockResolvedValueOnce({ rows: [] })                                           // ROLLBACK

    const res = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${managerToken()}`)
      .send(validBody)

    expect(res.status).toBe(400)

    const rollback = mockClient.query.mock.calls.find((c: unknown[]) => c[0] === 'ROLLBACK')
    const commit   = mockClient.query.mock.calls.find((c: unknown[]) => c[0] === 'COMMIT')
    expect(rollback).toBeDefined()
    expect(commit).toBeUndefined()
  })
})

// ── 7. Validation: same warehouse ────────────────────────────────────────────

describe('Same warehouse validation', () => {
  it('7 — source == destination → 400 without hitting DB', async () => {
    const res = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${managerToken()}`)
      .send({ ...validBody, destination_warehouse_id: WH_SRC })

    expect(res.status).toBe(400)
    expect(mockPool.connect).not.toHaveBeenCalled()
  })
})

// ── 8. Cross-tenant warehouse validation ──────────────────────────────────────

describe('Cross-tenant warehouse isolation', () => {
  it('8 — warehouse belonging to another tenant → 400', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                                           // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: WH_SRC }], rowCount: 1 })               // only 1 of 2 found
      .mockResolvedValueOnce({ rows: [] })                                           // ROLLBACK

    const res = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${managerToken()}`)
      .send(validBody)

    expect(res.status).toBe(400)
  })
})

// ── 9. Product not found ──────────────────────────────────────────────────────

describe('Product validation', () => {
  it('9 — product not in restaurant → 404', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                                           // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: WH_SRC }, { id: WH_DST }], rowCount: 2 }) // warehouses OK
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })                              // product not found
      .mockResolvedValueOnce({ rows: [] })                                           // ROLLBACK

    const res = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${managerToken()}`)
      .send(validBody)

    expect(res.status).toBe(404)
  })
})

// ── 10. RBAC ─────────────────────────────────────────────────────────────────

describe('RBAC', () => {
  it('10 — Waiter cannot create a transfer → 403', async () => {
    const res = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${waiterToken()}`)
      .send(validBody)

    expect(res.status).toBe(403)
    expect(mockPool.connect).not.toHaveBeenCalled()
  })
})

// ── 11. Zod validation ────────────────────────────────────────────────────────

describe('Zod input validation', () => {
  it('11 — missing product_id → 400 Zod error', async () => {
    const { product_id: _, ...bodyWithoutProduct } = validBody

    const res = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${managerToken()}`)
      .send(bodyWithoutProduct)

    expect(res.status).toBe(400)
    expect(mockPool.connect).not.toHaveBeenCalled()
  })

  it('12 — negative quantity → 400 Zod error', async () => {
    const res = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${managerToken()}`)
      .send({ ...validBody, quantity: -1 })

    expect(res.status).toBe(400)
    expect(mockPool.connect).not.toHaveBeenCalled()
  })
})

// ── 13. GET /transfers ────────────────────────────────────────────────────────

describe('GET /transfers', () => {
  it('13 — returns transfer list for restaurant', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [
        {
          id: TRF1,
          quantity: '5.000',
          note: 'Kitchen restock',
          created_at: new Date().toISOString(),
          source_warehouse_id: WH_SRC,
          source_warehouse_name: 'Main Warehouse',
          destination_warehouse_id: WH_DST,
          destination_warehouse_name: 'Bar',
          product_id: PROD1,
          product_name: 'Tomatoes',
          unit: 'kg',
          user_id: 'u1',
          user_name: 'Manager',
        },
      ],
    })

    const res = await request(app)
      .get('/api/transfers')
      .set('Authorization', `Bearer ${managerToken()}`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].id).toBe(TRF1)
    expect(res.body[0].source_warehouse_name).toBe('Main Warehouse')
    expect(res.body[0].destination_warehouse_name).toBe('Bar')
  })

  it('14 — Waiter can list transfers (no RBAC restriction on GET)', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] })

    const res = await request(app)
      .get('/api/transfers')
      .set('Authorization', `Bearer ${waiterToken()}`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(0)
  })
})

// ── 15. Atomic rollback ───────────────────────────────────────────────────────

describe('Atomic rollback', () => {
  it('15 — any failure inside transaction rolls back; no transfer record created', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                                              // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: WH_SRC }, { id: WH_DST }], rowCount: 2 }) // warehouses OK
      .mockResolvedValueOnce({ rows: [{ id: PROD1 }], rowCount: 1 })                   // products OK
      .mockRejectedValueOnce(new Error('DB connection lost'))                           // updateStock fails
      .mockResolvedValueOnce({ rows: [] })                                              // ROLLBACK

    const res = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${managerToken()}`)
      .send(validBody)

    expect(res.status).toBe(500)

    const insert = mockClient.query.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('INSERT INTO internal_transfers'),
    )
    const commit = mockClient.query.mock.calls.find((c: unknown[]) => c[0] === 'COMMIT')

    expect(insert).toBeUndefined()
    expect(commit).toBeUndefined()
  })
})
