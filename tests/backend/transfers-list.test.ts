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

const adminToken = () => generateAccessToken({ id: 'u1', email: 'a@r1.com', role: 'Admin', restaurantId: 'r1' })

const T1 = new Date('2026-05-22T10:00:00Z').toISOString()
const T2 = new Date('2026-05-22T09:00:00Z').toISOString()

const sampleTransfers = [
  {
    id: 'tr1', quantity: 5, unit: 'kg', note: null, created_at: T1,
    source_warehouse_id: 'wh1', source_warehouse_name: 'Главен',
    destination_warehouse_id: 'wh2', destination_warehouse_name: 'Тераса',
    product_id: 'p1', product_name: 'Брашно',
    user_id: 'u1', user_name: 'Admin',
  },
  {
    id: 'tr2', quantity: 2, unit: 'L', note: 'test', created_at: T2,
    source_warehouse_id: 'wh2', source_warehouse_name: 'Тераса',
    destination_warehouse_id: 'wh1', destination_warehouse_name: 'Главен',
    product_id: 'p2', product_name: 'Масло',
    user_id: 'u1', user_name: 'Admin',
  },
]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /transfers', () => {
  it('1 — Returns only transfers for the authenticated restaurant', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: sampleTransfers, rowCount: 2 })

    const res = await request(app)
      .get('/api/transfers')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body).toHaveLength(2)
    // Confirm the SQL was called with the restaurantId
    expect(mockPool.query.mock.calls[0][1]).toContain('r1')
  })

  it('2 — Response includes joined warehouse, product, and user names', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [sampleTransfers[0]], rowCount: 1 })

    const res = await request(app)
      .get('/api/transfers')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    const row = res.body[0]
    expect(row.source_warehouse_name).toBe('Главен')
    expect(row.destination_warehouse_name).toBe('Тераса')
    expect(row.product_name).toBe('Брашно')
    expect(row.unit).toBe('kg')
    expect(row.user_name).toBe('Admin')
  })

  it('3 — Results are ordered by created_at DESC (most recent first)', async () => {
    // The mock returns rows in the order the DB would — newest first (T1 > T2)
    mockPool.query.mockResolvedValueOnce({ rows: sampleTransfers, rowCount: 2 })

    const res = await request(app)
      .get('/api/transfers')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    // The query has ORDER BY created_at DESC hardcoded; we verify the SQL contains it
    const sql: string = mockPool.query.mock.calls[0][0]
    expect(sql).toMatch(/ORDER BY.*created_at.*DESC/i)
    // And the first row is the more-recent one
    expect(res.body[0].id).toBe('tr1')
  })
})
