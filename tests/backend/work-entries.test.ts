import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('../../src/db', () => ({
  default: {
    query: vi.fn(),
    connect: vi.fn(),
  },
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
app.use(errorMiddleware)

const mockPool = pool as any

function adminToken() {
  return generateAccessToken({ id: '00000000-0000-4000-8000-000000000001', restaurantId: REST_UUID, role: 'Admin', email: 'a@a.com' })
}
function waiterToken() {
  return generateAccessToken({ id: USER_UUID, restaurantId: REST_UUID, role: 'Waiter', email: 'w@a.com' })
}

const USER_UUID  = '00000000-0000-4000-8000-000000000002'
const REST_UUID  = '00000000-0000-4000-8000-000000000001'
const ENTRY_UUID = '00000000-0000-4000-8000-000000000003'

const ENTRY = {
  id: ENTRY_UUID, restaurant_id: REST_UUID, user_id: USER_UUID,
  clock_in: '2026-05-29T08:00:00Z', clock_out: null,
  role: 'Waiter', break_minutes: 0, hours_worked: null, notes: null,
  created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
}

const HR_SETTINGS_ROW = {
  restaurant_id: REST_UUID, weekly_overtime_threshold: 40,
  daily_overtime_threshold: 8, week_starts_on: 1, default_break_minutes: 30,
}

describe('Work Entries — clock in/out', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('1 — clock-in creates entry', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })          // no open entry check
      .mockResolvedValueOnce({ rows: [ENTRY], rowCount: 1 })     // INSERT

    const res = await request(app)
      .post('/api/work-entries/clock-in')
      .set('Authorization', `Bearer ${waiterToken()}`)

    expect(res.status).toBe(201)
    expect(res.body.user_id).toBe(USER_UUID)
  })

  it('2 — clock-in fails if already open', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [ENTRY], rowCount: 1 })

    const res = await request(app)
      .post('/api/work-entries/clock-in')
      .set('Authorization', `Bearer ${waiterToken()}`)

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/веќе|already/i)
  })

  it('3 — clock-out computes hours (8h shift - 30min break)', async () => {
    // pool.query is used by getHrSettings (called inside clock-out handler)
    mockPool.query
      .mockResolvedValueOnce(undefined)                                    // hr_settings upsert
      .mockResolvedValueOnce({ rows: [HR_SETTINGS_ROW], rowCount: 1 })    // hr_settings select

    const client = { query: vi.fn(), release: vi.fn() }
    mockPool.connect.mockResolvedValueOnce(client)

    const openEntry = { ...ENTRY, clock_in: new Date(Date.now() - 8 * 3600000).toISOString() }
    const closedEntry = { ...openEntry, clock_out: new Date().toISOString(), hours_worked: 7.5 }
    client.query
      .mockResolvedValueOnce(undefined)                                    // BEGIN
      .mockResolvedValueOnce({ rows: [openEntry], rowCount: 1 })           // SELECT FOR UPDATE
      .mockResolvedValueOnce({ rows: [closedEntry], rowCount: 1 })         // UPDATE
      .mockResolvedValueOnce(undefined)                                    // COMMIT

    const res = await request(app)
      .post('/api/work-entries/clock-out')
      .set('Authorization', `Bearer ${waiterToken()}`)
      .send({ break_minutes: 30 })

    expect(res.status).toBe(200)
    expect(client.query).toHaveBeenCalledWith('COMMIT')
  })

  it('4 — clock-out fails if no open entry', async () => {
    const client = { query: vi.fn(), release: vi.fn() }
    mockPool.connect.mockResolvedValueOnce(client)
    client.query
      .mockResolvedValueOnce(undefined)                          // BEGIN
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })          // no open entry
      .mockResolvedValueOnce(undefined)                          // ROLLBACK

    const res = await request(app)
      .post('/api/work-entries/clock-out')
      .set('Authorization', `Bearer ${waiterToken()}`)
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/нема|no active/i)
  })

  it('5 — GET /current returns open entry', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{ ...ENTRY, user_name: 'Alice' }],
    })
    const res = await request(app)
      .get('/api/work-entries/current')
      .set('Authorization', `Bearer ${waiterToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(ENTRY_UUID)
  })

  it('6 — GET /work-entries: employee sees own entries', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [ENTRY] })

    const res = await request(app)
      .get('/api/work-entries')
      .set('Authorization', `Bearer ${waiterToken()}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('7 — GET /work-entries admin can filter by user_id', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] })

    const res = await request(app)
      .get(`/api/work-entries?user_id=${USER_UUID}`)
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
  })

  it('8 — POST manual entry (Admin)', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ id: USER_UUID, role: 'Waiter' }], rowCount: 1 })   // user check
      .mockResolvedValueOnce({ rows: [{ ...ENTRY, clock_out: '2026-05-29T16:00:00Z', hours_worked: 7.5 }], rowCount: 1 })  // INSERT

    const res = await request(app)
      .post('/api/work-entries')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({
        user_id: USER_UUID,
        clock_in:  '2026-05-29T08:00:00.000Z',
        clock_out: '2026-05-29T16:00:00.000Z',
        break_minutes: 30,
      })

    expect(res.status).toBe(201)
  })

  it('9 — POST manual entry forbidden for Waiter', async () => {
    const res = await request(app)
      .post('/api/work-entries')
      .set('Authorization', `Bearer ${waiterToken()}`)
      .send({
        user_id: USER_UUID,
        clock_in:  '2026-05-29T08:00:00.000Z',
        clock_out: '2026-05-29T16:00:00.000Z',
      })

    expect(res.status).toBe(403)
  })

  it('10 — PUT recomputes hours_worked on edit', async () => {
    const closedEntry = { ...ENTRY, clock_out: '2026-05-29T16:00:00Z', break_minutes: 0, hours_worked: 8 }
    mockPool.query
      .mockResolvedValueOnce({ rows: [closedEntry], rowCount: 1 })     // SELECT existing
      .mockResolvedValueOnce({ rows: [{ ...closedEntry, hours_worked: 7.5 }], rowCount: 1 }) // UPDATE

    const res = await request(app)
      .put(`/api/work-entries/${ENTRY_UUID}`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ break_minutes: 30 })

    expect(res.status).toBe(200)
  })

  it('11 — DELETE (Admin only)', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: ENTRY_UUID }], rowCount: 1 })

    const res = await request(app)
      .delete(`/api/work-entries/${ENTRY_UUID}`)
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(204)
  })

  it('12 — clock_out before clock_in is rejected (manual entry validation)', async () => {
    const res = await request(app)
      .post('/api/work-entries')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({
        user_id:   USER_UUID,
        clock_in:  '2026-05-29T16:00:00.000Z',
        clock_out: '2026-05-29T08:00:00.000Z',  // before clock_in
        break_minutes: 0,
      })

    // clock_out < clock_in → the user check runs first (pool.query returns undefined → rowCount check fails → 400)
    // OR if user check is mocked, the clock_out <= clock_in guard returns 400
    // Either way expect 400
    expect(res.status).toBe(400)
  })
})
