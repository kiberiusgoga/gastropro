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

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
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

const mockPool = pool as unknown as { query: ReturnType<typeof vi.fn>; connect: ReturnType<typeof vi.fn> }
const mockBcryptCompare = vi.mocked(bcrypt.compare)

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------

describe('POST /api/auth/login', () => {
  it('returns 400 when email is missing', async () => {
    const res = await request(app).post('/api/auth/login').send({ password: 'secret123' })
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid email format', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'notanemail', password: 'secret123' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when password is too short (< 6 chars)', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.com', password: 'abc' })
    expect(res.status).toBe(400)
  })

  it('returns 401 when user is not found', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 })
    const res = await request(app).post('/api/auth/login').send({ email: 'ghost@test.com', password: 'password123' })
    expect(res.status).toBe(401)
  })

  it('returns 401 when password does not match', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{ id: 'u1', email: 'a@b.com', role: 'Admin', restaurant_id: 'r1', password_hash: '$hash' }],
      rowCount: 1,
    })
    mockBcryptCompare.mockResolvedValueOnce(false as never)
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.com', password: 'wrongpass' })
    expect(res.status).toBe(401)
  })

  it('returns 200 with accessToken, refreshToken, and user on success', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{
        id: 'u1', name: 'Ana', email: 'ana@gastropro.mk',
        role: 'Admin', restaurant_id: 'r1', password_hash: '$hash',
      }],
      rowCount: 1,
    })
    mockBcryptCompare.mockResolvedValueOnce(true as never)

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ana@gastropro.mk', password: 'correct123' })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('accessToken')
    expect(res.body).toHaveProperty('refreshToken')
    expect(res.body.user).toMatchObject({ email: 'ana@gastropro.mk', role: 'Admin' })
  })
})

// ---------------------------------------------------------------------------
// POST /api/auth/refresh
// ---------------------------------------------------------------------------

describe('POST /api/auth/refresh', () => {
  // Rotation is DB-backed; set up a client that returns no rows (token not found → 401)
  const refreshMockClient = { query: vi.fn(), release: vi.fn() }

  beforeEach(() => {
    refreshMockClient.query.mockReset()
    refreshMockClient.release.mockReset()
    mockPool.connect.mockResolvedValue(refreshMockClient)
    // BEGIN / SELECT (empty) / ROLLBACK
    refreshMockClient.query.mockResolvedValue({ rows: [], rowCount: 0 })
  })

  it('returns 401 when refresh token is missing', async () => {
    const res = await request(app).post('/api/auth/refresh').send({})
    expect(res.status).toBe(401)
  })

  it('returns 401 for an invalid refresh token', async () => {
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: 'garbage.token' })
    expect(res.status).toBe(401)
  })

  it('returns 401 when an access token is used as refresh token', async () => {
    const accessToken = generateAccessToken({ id: 'u1', email: 'a@b.com', role: 'Admin', restaurantId: 'r1' })
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: accessToken })
    expect(res.status).toBe(401)
  })

  // Full rotation success path is covered by tests/backend/refresh-rotation.test.ts test 1.
})

// ---------------------------------------------------------------------------
// Protected routes — no auth header
// ---------------------------------------------------------------------------

describe('Protected routes without authentication', () => {
  const protectedRoutes = [
    { method: 'get', path: '/api/categories' },
    { method: 'get', path: '/api/products' },
    { method: 'get', path: '/api/orders' },
    { method: 'get', path: '/api/users' },
    { method: 'get', path: '/api/bundles' },
    { method: 'get', path: '/api/menu-items' },
    { method: 'get', path: '/api/tables' },
    { method: 'get', path: '/api/shifts/active' },
  ] as const

  for (const route of protectedRoutes) {
    it(`${route.method.toUpperCase()} ${route.path} → 401`, async () => {
      const res = await (request(app) as any)[route.method](route.path)
      expect(res.status).toBe(401)
    })
  }
})

// ---------------------------------------------------------------------------
// Protected routes — authenticated requests
// ---------------------------------------------------------------------------

describe('Authenticated GET /api/categories', () => {
  it('returns 200 with category list', async () => {
    const token = generateAccessToken({ id: 'u1', email: 'a@b.com', role: 'Admin', restaurantId: 'r1' })
    mockPool.query.mockResolvedValueOnce({
      rows: [{ id: 'c1', name: 'Drinks', restaurant_id: 'r1', active: true }],
      rowCount: 1,
    })
    const res = await request(app)
      .get('/api/categories')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })
})

describe('Authenticated GET /api/products', () => {
  it('returns 200 with product list', async () => {
    const token = generateAccessToken({ id: 'u1', email: 'a@b.com', role: 'Admin', restaurantId: 'r1' })
    mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 })
    const res = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
  })
})
