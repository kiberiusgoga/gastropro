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

const WH1 = '550e8400-e29b-41d4-a716-446655440001'
const WH2 = '550e8400-e29b-41d4-a716-446655440002'

const adminToken  = () => generateAccessToken({ id: 'u1', email: 'a@r1.com', role: 'Admin',   restaurantId: 'r1' })
const waiterToken = () => generateAccessToken({ id: 'u3', email: 'w@r1.com', role: 'Waiter',  restaurantId: 'r1' })

// GET /stock/summary fires 5 parallel pool.query calls via Promise.all
function mockSummary(total: number, low: number, out: number, wh: number, tr: number) {
  mockPool.query
    .mockResolvedValueOnce({ rows: [{ total }] })         // total_stock_value
    .mockResolvedValueOnce({ rows: [{ cnt: low }] })      // low_stock_count
    .mockResolvedValueOnce({ rows: [{ cnt: out }] })      // out_of_stock_count
    .mockResolvedValueOnce({ rows: [{ cnt: wh }] })       // warehouses_count
    .mockResolvedValueOnce({ rows: [{ cnt: tr }] })       // recent_transfers_count
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── GET /stock/summary ────────────────────────────────────────────────────────

describe('GET /stock/summary', () => {
  it('1 — Returns 5 KPIs with correct types', async () => {
    mockSummary(15000, 3, 1, 2, 5)

    const res = await request(app)
      .get('/api/stock/summary')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(typeof res.body.total_stock_value).toBe('number')
    expect(typeof res.body.low_stock_count).toBe('number')
    expect(typeof res.body.out_of_stock_count).toBe('number')
    expect(typeof res.body.warehouses_count).toBe('number')
    expect(typeof res.body.recent_transfers_count).toBe('number')
    expect(res.body.total_stock_value).toBe(15000)
    expect(res.body.low_stock_count).toBe(3)
    expect(res.body.out_of_stock_count).toBe(1)
    expect(res.body.warehouses_count).toBe(2)
    expect(res.body.recent_transfers_count).toBe(5)
  })

  it('2 — No products → all zeros', async () => {
    mockSummary(0, 0, 0, 0, 0)

    const res = await request(app)
      .get('/api/stock/summary')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.total_stock_value).toBe(0)
    expect(res.body.low_stock_count).toBe(0)
    expect(res.body.out_of_stock_count).toBe(0)
    expect(res.body.warehouses_count).toBe(0)
    expect(res.body.recent_transfers_count).toBe(0)
  })

  it('3 — Tenancy isolation (only queries with restaurantId)', async () => {
    mockSummary(500, 1, 0, 1, 2)

    await request(app)
      .get('/api/stock/summary')
      .set('Authorization', `Bearer ${adminToken()}`)

    // Each of the 5 queries should have been called with ['r1'] as first param
    const calls = mockPool.query.mock.calls
    expect(calls).toHaveLength(5)
    calls.forEach((call) => {
      expect(call[1]).toContain('r1')
    })
  })

  it('8 — Waiter can access summary → 200 (no RBAC restriction)', async () => {
    mockSummary(1000, 0, 0, 1, 0)

    const res = await request(app)
      .get('/api/stock/summary')
      .set('Authorization', `Bearer ${waiterToken()}`)

    expect(res.status).toBe(200)
  })
})

// ── GET /stock/matrix ─────────────────────────────────────────────────────────

describe('GET /stock/matrix', () => {
  it('4 — Returns warehouses and products arrays', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ id: WH1, name: 'Главен', is_main: true }] })  // warehouses
      .mockResolvedValueOnce({ rows: [
        { id: 'p1', name: 'Брашно', unit: 'kg', min_stock: 5, category_id: null,
          stock_by_warehouse: { [WH1]: 10 } },
      ]})  // products

    const res = await request(app)
      .get('/api/stock/matrix')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.warehouses)).toBe(true)
    expect(Array.isArray(res.body.products)).toBe(true)
    expect(res.body.warehouses).toHaveLength(1)
    expect(res.body.products).toHaveLength(1)
    expect(res.body.products[0].stock_by_warehouse).toBeDefined()
  })

  it('5 — No warehouses → empty arrays', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [] })  // warehouses
      .mockResolvedValueOnce({ rows: [] })  // products

    const res = await request(app)
      .get('/api/stock/matrix')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.warehouses).toHaveLength(0)
    expect(res.body.products).toHaveLength(0)
  })

  it('6 — Main warehouse is first in response', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [
        { id: WH1, name: 'Главен', is_main: true },
        { id: WH2, name: 'Помошен', is_main: false },
      ]})
      .mockResolvedValueOnce({ rows: [] })

    const res = await request(app)
      .get('/api/stock/matrix')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.warehouses[0].is_main).toBe(true)
  })

  it('7 — Matrix tenancy isolation (queries use restaurantId)', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })

    await request(app)
      .get('/api/stock/matrix')
      .set('Authorization', `Bearer ${adminToken()}`)

    const calls = mockPool.query.mock.calls
    expect(calls).toHaveLength(2)
    calls.forEach((call) => {
      expect(call[1]).toContain('r1')
    })
  })

  it('9 — Waiter can access matrix → 200 (no RBAC restriction)', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })

    const res = await request(app)
      .get('/api/stock/matrix')
      .set('Authorization', `Bearer ${waiterToken()}`)

    expect(res.status).toBe(200)
  })
})
