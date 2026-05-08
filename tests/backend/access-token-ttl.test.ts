import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

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
import { generateAccessToken, verifyAccessToken } from '../../src/auth'
import pool from '../../src/db'

const app = express()
app.use(express.json())
app.use('/api', router)
app.use(errorMiddleware as express.ErrorRequestHandler)

const mockPool = pool as unknown as { query: ReturnType<typeof vi.fn>; connect: ReturnType<typeof vi.fn> }

const MOCK_USER = { id: 'user-1', email: 'admin@test.com', role: 'Admin', restaurantId: 'rest-1' }

// ─────────────────────────────────────────────────────────────────────────────

describe('Access token TTL — 15 minutes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPool.query.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── 1. exp claim is exactly 900 seconds ahead of iat ─────────────────────

  it('1. newly issued token has exp − iat = 900s (15 minutes)', () => {
    const token = generateAccessToken(MOCK_USER)
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString()
    ) as { iat: number; exp: number }
    expect(payload.exp - payload.iat).toBe(900)
  })

  // ── 2. token is valid immediately after issuance ──────────────────────────

  it('2. token is valid immediately after issuance', () => {
    const token = generateAccessToken(MOCK_USER)
    expect(verifyAccessToken(token)).not.toBeNull()
  })

  // ── 3. token is valid at the 14-minute mark ───────────────────────────────

  it('3. token is still valid at t+14min (within TTL)', () => {
    vi.useFakeTimers()
    const token = generateAccessToken(MOCK_USER)
    vi.advanceTimersByTime(14 * 60 * 1000)
    expect(verifyAccessToken(token)).not.toBeNull()
  })

  // ── 4. token is expired at the 16-minute mark ────────────────────────────
  // (1 minute past TTL — no clock-skew tolerance at that margin)

  it('4. token is expired at t+16min (past TTL)', () => {
    vi.useFakeTimers()
    const token = generateAccessToken(MOCK_USER)
    vi.advanceTimersByTime(16 * 60 * 1000)
    expect(verifyAccessToken(token)).toBeNull()
  })

  // ── 5. Expired token → /auth/me returns 401; rotation returns valid token ─

  it('5. expired token → 401 on protected route; new token from rotation is valid', async () => {
    // ── 5a. issue and expire the token ─────────────────────────────────────
    vi.useFakeTimers()
    const expiredToken = generateAccessToken(MOCK_USER)
    vi.advanceTimersByTime(16 * 60 * 1000)

    // GET /auth/me with expired token → 401
    const mockClient = { query: vi.fn(), release: vi.fn() }
    mockPool.connect.mockResolvedValue(mockClient)
    // /auth/me queries DB for user; set up a row so it doesn't 404 if auth passes
    mockPool.query.mockResolvedValue({ rows: [{ id: 'user-1', name: 'Admin', email: 'admin@test.com', role: 'Admin', restaurant_id: 'rest-1', must_change_password: false, active: true }], rowCount: 1 })

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`)

    expect(meRes.status).toBe(401)

    // ── 5b. simulate rotation (real timers for jwt.sign) ───────────────────
    // Restore real timers so generateAccessToken in rotateToken uses real now
    vi.useRealTimers()
    const freshToken = generateAccessToken(MOCK_USER)

    // The fresh token must be valid and have correct TTL
    expect(verifyAccessToken(freshToken)).not.toBeNull()
    const payload = JSON.parse(
      Buffer.from(freshToken.split('.')[1], 'base64url').toString()
    ) as { iat: number; exp: number }
    expect(payload.exp - payload.iat).toBe(900)
  })
})
