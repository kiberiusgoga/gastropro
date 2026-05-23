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

const mockPool = pool as unknown as { query: ReturnType<typeof vi.fn> }

const adminToken = () =>
  generateAccessToken({ id: 'u1', email: 'a@r1.com', role: 'Admin', restaurantId: 'r1' })
const waiterToken = () =>
  generateAccessToken({ id: 'u2', email: 'w@r1.com', role: 'Waiter', restaurantId: 'r1' })

const outOfStockItem = {
  id: 'p1', name: 'Брашно', unit: 'kg', min_stock: 5,
  quantity: 0, warehouse_id: 'wh1', warehouse_name: 'Главен',
}
const lowStockItem = {
  id: 'p2', name: 'Масло', unit: 'L', min_stock: 3,
  quantity: 1, warehouse_id: 'wh1', warehouse_name: 'Главен',
}

beforeEach(() => { vi.clearAllMocks() })

describe('GET /stock/alerts', () => {
  it('1 — Returns empty arrays when no alerts', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // out_of_stock query
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // low_stock query

    const res = await request(app)
      .get('/api/stock/alerts')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.out_of_stock).toHaveLength(0)
    expect(res.body.low_stock).toHaveLength(0)
  })

  it('2 — out_of_stock contains only products with quantity = 0', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [outOfStockItem], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })

    const res = await request(app)
      .get('/api/stock/alerts')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.out_of_stock).toHaveLength(1)
    expect(res.body.out_of_stock[0].quantity).toBe(0)
    expect(res.body.out_of_stock[0].name).toBe('Брашно')
  })

  it('3 — low_stock contains products with 0 < quantity <= min_stock', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [lowStockItem], rowCount: 1 })

    const res = await request(app)
      .get('/api/stock/alerts')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.low_stock).toHaveLength(1)
    expect(res.body.low_stock[0].quantity).toBe(1)
    expect(res.body.low_stock[0].min_stock).toBe(3)
  })

  it('4 — Only returns alerts for the authenticated restaurant (tenancy guard)', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [outOfStockItem], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [lowStockItem], rowCount: 1 })

    await request(app)
      .get('/api/stock/alerts')
      .set('Authorization', `Bearer ${adminToken()}`)

    // Both queries must be parameterised with the restaurant id
    expect(mockPool.query.mock.calls[0][1]).toContain('r1')
    expect(mockPool.query.mock.calls[1][1]).toContain('r1')
  })

  it('5 — Response includes warehouse_name from warehouse join', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [outOfStockItem], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })

    const res = await request(app)
      .get('/api/stock/alerts')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.out_of_stock[0].warehouse_name).toBe('Главен')
    expect(res.body.out_of_stock[0].warehouse_id).toBe('wh1')
  })
})
