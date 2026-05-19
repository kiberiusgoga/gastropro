import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('../../src/db', () => ({
  default: { query: vi.fn(), connect: vi.fn() },
}))
vi.mock('../../src/lib/logger', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))
vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn(), compare: vi.fn() },
  hash: vi.fn(),
  compare: vi.fn(),
}))

import express from 'express'
import request from 'supertest'
import router from '../../src/api'
import { errorMiddleware } from '../../src/middleware/errorMiddleware'
import pool from '../../src/db'
import bcrypt from 'bcryptjs'
import { generateAccessToken } from '../../src/auth'

const app = express()
app.use(express.json())
app.use('/api', router)
app.use(errorMiddleware as express.ErrorRequestHandler)

const mockPool = pool as unknown as { query: ReturnType<typeof vi.fn> }
const mockBcryptHash = vi.mocked(bcrypt.hash)

const tokenAdmin  = () => generateAccessToken({ id: 'u1', email: 'admin@r1.com', role: 'Admin',   restaurantId: 'r1' })
const tokenWaiter = () => generateAccessToken({ id: 'u2', email: 'wait@r1.com',  role: 'Waiter',  restaurantId: 'r1' })

const validPayload = { name: 'Петар Петров', email: 'petar@r1.com', role: 'Waiter' }

const createdRow = {
  id: 'e1',
  restaurant_id: 'r1',
  name: 'Петар Петров',
  email: 'petar@r1.com',
  role: 'Waiter',
  active: true,
  must_change_password: true,
  created_at: '2026-01-01',
}

beforeEach(() => vi.clearAllMocks())

describe('POST /api/employees', () => {
  it('1 — successful creation → 201 with employee data and temp_password', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })          // email check
      .mockResolvedValueOnce({ rows: [createdRow], rowCount: 1 }) // INSERT users
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })           // logAuthEvent

    mockBcryptHash.mockResolvedValueOnce('hashed' as never)

    const res = await request(app)
      .post('/api/employees')
      .set('Authorization', `Bearer ${tokenAdmin()}`)
      .send(validPayload)

    expect(res.status).toBe(201)
    expect(res.body.email).toBe('petar@r1.com')
    expect(res.body.role).toBe('Waiter')
    expect(typeof res.body.temp_password).toBe('string')
    expect(res.body.temp_password.length).toBeGreaterThan(0)
  })

  it('2 — duplicate email → 409', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ id: 'existing' }], rowCount: 1 }) // email check finds match

    const res = await request(app)
      .post('/api/employees')
      .set('Authorization', `Bearer ${tokenAdmin()}`)
      .send(validPayload)

    expect(res.status).toBe(409)
    expect(res.body.message).toMatch(/email/i)
  })

  it('3 — invalid role → 400', async () => {
    const res = await request(app)
      .post('/api/employees')
      .set('Authorization', `Bearer ${tokenAdmin()}`)
      .send({ ...validPayload, role: 'Bartender' })

    expect(res.status).toBe(400)
  })

  it('4 — missing name → 400', async () => {
    const { name: _n, ...noName } = validPayload
    const res = await request(app)
      .post('/api/employees')
      .set('Authorization', `Bearer ${tokenAdmin()}`)
      .send(noName)

    expect(res.status).toBe(400)
  })

  it('5 — missing email → 400', async () => {
    const { email: _e, ...noEmail } = validPayload
    const res = await request(app)
      .post('/api/employees')
      .set('Authorization', `Bearer ${tokenAdmin()}`)
      .send(noEmail)

    expect(res.status).toBe(400)
  })

  it('6 — Waiter role → 403', async () => {
    const res = await request(app)
      .post('/api/employees')
      .set('Authorization', `Bearer ${tokenWaiter()}`)
      .send(validPayload)

    expect(res.status).toBe(403)
  })

  it('7 — unauthenticated → 401', async () => {
    const res = await request(app)
      .post('/api/employees')
      .send(validPayload)

    expect(res.status).toBe(401)
  })
})
