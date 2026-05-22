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

const WH1 = '550e8400-e29b-41d4-a716-446655440001'
const WH2 = '550e8400-e29b-41d4-a716-446655440002'
const T1  = '550e8400-e29b-41d4-a716-446655440010'
const T2  = '550e8400-e29b-41d4-a716-446655440011'
const T3  = '550e8400-e29b-41d4-a716-446655440012'

const adminToken  = () => generateAccessToken({ id: 'u1', email: 'a@r1.com',  role: 'Admin',   restaurantId: 'r1' })
const managerToken = () => generateAccessToken({ id: 'u2', email: 'm@r1.com', role: 'Manager', restaurantId: 'r1' })
const waiterToken  = () => generateAccessToken({ id: 'u3', email: 'w@r1.com', role: 'Waiter',  restaurantId: 'r1' })

const updatedRows = [
  { id: T1, number: 1, capacity: 4, zone: 'Главна', status: 'free', warehouse_id: WH2 },
  { id: T2, number: 2, capacity: 4, zone: 'Главна', status: 'free', warehouse_id: WH2 },
  { id: T3, number: 3, capacity: 2, zone: 'Тераса', status: 'free', warehouse_id: WH2 },
]

// PATCH /tables/bulk client.query sequence:
//   [0] BEGIN
//   [1] warehouse check → 1 row
//   [2] table count check → N rows
//   [3] UPDATE RETURNING rows
//   [4] COMMIT
function mockBulkSuccess() {
  mockPool.connect.mockResolvedValue(mockClient)
  mockClient.query
    .mockResolvedValueOnce({ rows: [] })                                          // [0] BEGIN
    .mockResolvedValueOnce({ rows: [{ id: WH2 }], rowCount: 1 })                 // [1] warehouse check
    .mockResolvedValueOnce({ rows: [{ id: T1 }, { id: T2 }, { id: T3 }], rowCount: 3 }) // [2] table check
    .mockResolvedValueOnce({ rows: updatedRows, rowCount: 3 })                   // [3] UPDATE
    .mockResolvedValueOnce({ rows: [] })                                          // [4] COMMIT
}

beforeEach(() => {
  vi.clearAllMocks()
  mockClient.query.mockReset()
  mockClient.release.mockReset()
})

// ── PATCH /tables/bulk ────────────────────────────────────────────────────────

describe('PATCH /tables/bulk', () => {
  it('1 — Admin bulk-assigns 3 tables → 200 with updated rows', async () => {
    mockBulkSuccess()

    const res = await request(app)
      .patch('/api/tables/bulk')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ table_ids: [T1, T2, T3], warehouse_id: WH2 })

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(3)
    expect(res.body[0].warehouse_id).toBe(WH2)
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT')
    expect(mockClient.release).toHaveBeenCalled()
  })

  it('2 — Manager bulk-assigns → 200', async () => {
    mockBulkSuccess()

    const res = await request(app)
      .patch('/api/tables/bulk')
      .set('Authorization', `Bearer ${managerToken()}`)
      .send({ table_ids: [T1, T2, T3], warehouse_id: WH2 })

    expect(res.status).toBe(200)
  })

  it('3 — Waiter cannot bulk-assign → 403', async () => {
    const res = await request(app)
      .patch('/api/tables/bulk')
      .set('Authorization', `Bearer ${waiterToken()}`)
      .send({ table_ids: [T1], warehouse_id: WH2 })

    expect(res.status).toBe(403)
    expect(mockPool.connect).not.toHaveBeenCalled()
  })

  it('4 — Invalid warehouse (not in restaurant) → 400', async () => {
    mockPool.connect.mockResolvedValue(mockClient)
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                           // BEGIN
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })              // warehouse check → 0 rows
      .mockResolvedValueOnce({ rows: [] })                           // ROLLBACK

    const res = await request(app)
      .patch('/api/tables/bulk')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ table_ids: [T1], warehouse_id: WH2 })

    expect(res.status).toBe(400)
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK')
  })

  it('5 — One table not found (cross-restaurant) → 404', async () => {
    const BAD_ID = '550e8400-e29b-41d4-a716-446655440099'
    mockPool.connect.mockResolvedValue(mockClient)
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                                  // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: WH2 }], rowCount: 1 })         // warehouse check
      .mockResolvedValueOnce({ rows: [{ id: T1 }], rowCount: 1 })          // only 1 of 2 tables found
      .mockResolvedValueOnce({ rows: [] })                                  // ROLLBACK

    const res = await request(app)
      .patch('/api/tables/bulk')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ table_ids: [T1, BAD_ID], warehouse_id: WH2 })

    expect(res.status).toBe(404)
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK')
  })

  it('6 — Empty table_ids array → 400 Zod error', async () => {
    const res = await request(app)
      .patch('/api/tables/bulk')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ table_ids: [], warehouse_id: WH2 })

    expect(res.status).toBe(400)
    expect(mockPool.connect).not.toHaveBeenCalled()
  })
})

// ── GET /warehouses/:id/products stock_status ─────────────────────────────────

describe('GET /warehouses/:id/products stock_status', () => {
  it('7 — Returns stock_status field for each product', async () => {
    const products = [
      { id: 'p1', name: 'Брашно', unit: 'kg', min_stock: 5, purchase_price: 50, selling_price: 60,
        category_id: null, warehouse_stock: 10, stock_status: 'ok' },
      { id: 'p2', name: 'Масло',  unit: 'L',  min_stock: 3, purchase_price: 80, selling_price: 100,
        category_id: null, warehouse_stock: 2,  stock_status: 'low_stock' },
    ]

    mockPool.query
      .mockResolvedValueOnce({ rows: [{ id: WH1 }], rowCount: 1 })  // warehouse check
      .mockResolvedValueOnce({ rows: products, rowCount: 2 })         // SELECT products

    const res = await request(app)
      .get(`/api/warehouses/${WH1}/products`)
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body[0].stock_status).toBe('ok')
    expect(res.body[1].stock_status).toBe('low_stock')
  })

  it('8 — Low stock product has stock_status=low_stock, out-of-stock has out_of_stock', async () => {
    const products = [
      { id: 'p1', name: 'А', unit: 'kg', min_stock: 10, purchase_price: 10, selling_price: 15,
        category_id: null, warehouse_stock: 3,  stock_status: 'low_stock' },
      { id: 'p2', name: 'Б', unit: 'kg', min_stock: 5,  purchase_price: 20, selling_price: 25,
        category_id: null, warehouse_stock: 0,  stock_status: 'out_of_stock' },
      { id: 'p3', name: 'В', unit: 'kg', min_stock: 2,  purchase_price: 30, selling_price: 35,
        category_id: null, warehouse_stock: 0,  stock_status: 'not_assigned' },
    ]

    mockPool.query
      .mockResolvedValueOnce({ rows: [{ id: WH1 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: products, rowCount: 3 })

    const res = await request(app)
      .get(`/api/warehouses/${WH1}/products`)
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    const statuses = res.body.map((p: any) => p.stock_status)
    expect(statuses).toContain('low_stock')
    expect(statuses).toContain('out_of_stock')
    expect(statuses).toContain('not_assigned')
  })
})
