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
const T1  = '550e8400-e29b-41d4-a716-446655440010'

const adminToken  = () => generateAccessToken({ id: 'u1', email: 'a@r1.com', role: 'Admin',   restaurantId: 'r1' })
const waiterToken = () => generateAccessToken({ id: 'u3', email: 'w@r1.com', role: 'Waiter',  restaurantId: 'r1' })

beforeEach(() => {
  vi.clearAllMocks()
  mockClient.query.mockReset()
  mockClient.release.mockReset()
})

// ── DELETE /tables/:id ────────────────────────────────────────────────────────

describe('DELETE /tables/:id', () => {
  it('1 — Admin deletes table with no active orders → 204', async () => {
    // pool.query sequence: exists check, active orders check
    // then pool.connect() → client: BEGIN, null orders, null reservations, DELETE, COMMIT
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ id: T1 }], rowCount: 1 })   // exists check
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })               // active orders check → none
    mockPool.connect.mockResolvedValue(mockClient)
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })   // BEGIN
      .mockResolvedValueOnce({ rows: [] })   // UPDATE orders SET table_id = NULL
      .mockResolvedValueOnce({ rows: [] })   // UPDATE reservations SET table_id = NULL
      .mockResolvedValueOnce({ rows: [] })   // DELETE
      .mockResolvedValueOnce({ rows: [] })   // COMMIT

    const res = await request(app)
      .delete(`/api/tables/${T1}`)
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(204)
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT')
    expect(mockClient.release).toHaveBeenCalled()
  })

  it('2 — Table has active orders → 400 TABLE_HAS_ACTIVE_ORDERS', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ id: T1 }], rowCount: 1 })               // exists
      .mockResolvedValueOnce({ rows: [{ id: 'ord1' }], rowCount: 1 })            // active orders found

    const res = await request(app)
      .delete(`/api/tables/${T1}`)
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('TABLE_HAS_ACTIVE_ORDERS')
    expect(mockPool.connect).not.toHaveBeenCalled()
  })

  it('3 — Cross-restaurant table → 404', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 })  // exists check → not found

    const res = await request(app)
      .delete(`/api/tables/${T1}`)
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(404)
    expect(mockPool.connect).not.toHaveBeenCalled()
  })
})
