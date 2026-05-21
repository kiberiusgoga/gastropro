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

const mockPool = pool as unknown as { query: ReturnType<typeof vi.fn>; connect: ReturnType<typeof vi.fn> }

const WH1 = '550e8400-e29b-41d4-a716-446655440001'
const WH2 = '550e8400-e29b-41d4-a716-446655440002'

const adminToken  = () => generateAccessToken({ id: 'u1', email: 'a@r1.com',   role: 'Admin',   restaurantId: 'r1' })
const managerToken = () => generateAccessToken({ id: 'u2', email: 'mgr@r1.com', role: 'Manager', restaurantId: 'r1' })
const waiterToken  = () => generateAccessToken({ id: 'u3', email: 'w@r1.com',   role: 'Waiter',  restaurantId: 'r1' })

const newWarehouse = { id: WH2, restaurant_id: 'r1', name: 'Тераса', is_main: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }

beforeEach(() => {
  vi.clearAllMocks()
})

// ── POST /warehouses ──────────────────────────────────────────────────────────

describe('POST /warehouses', () => {
  it('1 — Admin creates warehouse → 201', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })       // duplicate check
      .mockResolvedValueOnce({ rows: [newWarehouse], rowCount: 1 }) // INSERT

    const res = await request(app)
      .post('/api/warehouses')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ name: 'Тераса' })

    expect(res.status).toBe(201)
    expect(res.body.name).toBe('Тераса')
    expect(res.body.is_main).toBe(false)
  })

  it('2 — Manager creates warehouse → 201', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [newWarehouse], rowCount: 1 })

    const res = await request(app)
      .post('/api/warehouses')
      .set('Authorization', `Bearer ${managerToken()}`)
      .send({ name: 'Тераса' })

    expect(res.status).toBe(201)
  })

  it('3 — Waiter cannot create warehouse → 403', async () => {
    const res = await request(app)
      .post('/api/warehouses')
      .set('Authorization', `Bearer ${waiterToken()}`)
      .send({ name: 'Тераса' })

    expect(res.status).toBe(403)
    expect(mockPool.query).not.toHaveBeenCalled()
  })

  it('4 — Empty name → 400 Zod error', async () => {
    const res = await request(app)
      .post('/api/warehouses')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ name: '' })

    expect(res.status).toBe(400)
    expect(mockPool.query).not.toHaveBeenCalled()
  })

  it('5 — Duplicate name → 409 WAREHOUSE_NAME_EXISTS', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: WH1 }], rowCount: 1 }) // duplicate found

    const res = await request(app)
      .post('/api/warehouses')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ name: 'Главен магацин' })

    expect(res.status).toBe(409)
    expect(res.body.code).toBe('WAREHOUSE_NAME_EXISTS')
  })
})

// ── PUT /warehouses/:id ───────────────────────────────────────────────────────

describe('PUT /warehouses/:id', () => {
  it('6 — Valid rename → 200 with updated warehouse', async () => {
    const updated = { ...newWarehouse, name: 'Летна тераса' }
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ id: WH2 }], rowCount: 1 })  // exists check
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })               // dup check
      .mockResolvedValueOnce({ rows: [updated], rowCount: 1 })        // UPDATE

    const res = await request(app)
      .put(`/api/warehouses/${WH2}`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ name: 'Летна тераса' })

    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Летна тераса')
  })

  it('7 — Non-existent warehouse → 404', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }) // not found

    const res = await request(app)
      .put(`/api/warehouses/${WH2}`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ name: 'Летна тераса' })

    expect(res.status).toBe(404)
  })

  it('8 — Cross-restaurant warehouse → 404 (not 403)', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }) // returns 0 because restaurant_id mismatch

    const res = await request(app)
      .put(`/api/warehouses/${WH1}`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ name: 'Other' })

    expect(res.status).toBe(404)
  })

  it('9 — Duplicate name on update → 409 WAREHOUSE_NAME_EXISTS', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ id: WH2 }], rowCount: 1 })  // exists
      .mockResolvedValueOnce({ rows: [{ id: WH1 }], rowCount: 1 })  // dup found (different id)

    const res = await request(app)
      .put(`/api/warehouses/${WH2}`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ name: 'Главен магацин' })

    expect(res.status).toBe(409)
    expect(res.body.code).toBe('WAREHOUSE_NAME_EXISTS')
  })
})

// ── DELETE /warehouses/:id ────────────────────────────────────────────────────

describe('DELETE /warehouses/:id', () => {
  it('10 — Non-existent warehouse → 404', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 })

    const res = await request(app)
      .delete(`/api/warehouses/${WH2}`)
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(404)
  })

  it('11 — Main warehouse → 409 CANNOT_DELETE_MAIN', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: WH1, is_main: true }], rowCount: 1 })

    const res = await request(app)
      .delete(`/api/warehouses/${WH1}`)
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(409)
    expect(res.body.code).toBe('CANNOT_DELETE_MAIN')
  })

  it('12 — Warehouse with stock > 0 → 409 WAREHOUSE_HAS_STOCK', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ id: WH2, is_main: false }], rowCount: 1 }) // exists
      .mockResolvedValueOnce({ rows: [{ 1: 1 }], rowCount: 1 })                    // stock found

    const res = await request(app)
      .delete(`/api/warehouses/${WH2}`)
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(409)
    expect(res.body.code).toBe('WAREHOUSE_HAS_STOCK')
  })

  it('13 — Warehouse with assigned tables → 409 WAREHOUSE_HAS_TABLES', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ id: WH2, is_main: false }], rowCount: 1 }) // exists
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })                             // no stock
      .mockResolvedValueOnce({ rows: [{ 1: 1 }], rowCount: 1 })                    // tables found

    const res = await request(app)
      .delete(`/api/warehouses/${WH2}`)
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(409)
    expect(res.body.code).toBe('WAREHOUSE_HAS_TABLES')
  })

  it('14 — Warehouse with transfer history → 409 WAREHOUSE_HAS_TRANSFERS', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ id: WH2, is_main: false }], rowCount: 1 }) // exists
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })                             // no stock
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })                             // no tables
      .mockResolvedValueOnce({ rows: [{ 1: 1 }], rowCount: 1 })                    // transfers found

    const res = await request(app)
      .delete(`/api/warehouses/${WH2}`)
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(409)
    expect(res.body.code).toBe('WAREHOUSE_HAS_TRANSFERS')
  })

  it('15a — Clean warehouse → 200, transactions nulled before delete', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ id: WH2, is_main: false }], rowCount: 1 }) // exists
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })                             // no stock
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })                             // no tables
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })                             // no transfers
      .mockResolvedValueOnce({ rows: [], rowCount: 3 })                             // UPDATE transactions
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })                             // DELETE

    const res = await request(app)
      .delete(`/api/warehouses/${WH2}`)
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.deleted).toBe(true)

    // Verify step 6: transactions nulled
    const txNull = mockPool.query.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('UPDATE transactions SET warehouse_id = NULL'),
    )
    expect(txNull).toBeDefined()
    expect((txNull as [string, unknown[]])[1][0]).toBe(WH2)

    // Verify step 7: DELETE comes after
    const del = mockPool.query.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('DELETE FROM warehouses'),
    )
    expect(del).toBeDefined()
    const txNullIdx = mockPool.query.mock.calls.indexOf(txNull as unknown[])
    const delIdx    = mockPool.query.mock.calls.indexOf(del as unknown[])
    expect(txNullIdx).toBeLessThan(delIdx)
  })
})
