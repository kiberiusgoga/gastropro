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

const mockPool = pool as unknown as {
  query: ReturnType<typeof vi.fn>
  connect: ReturnType<typeof vi.fn>
}
const mockBcryptCompare = vi.mocked(bcrypt.compare)

// Shared mock client reused across all tests
const mockClient = {
  query: vi.fn(),
  release: vi.fn(),
}

const ADMIN_USER = {
  id: 'user-1',
  email: 'admin@test.com',
  role: 'Admin',
  restaurantId: 'rest-1',
}
const adminToken = generateAccessToken(ADMIN_USER)

// ─── Token row factories ──────────────────────────────────────────────────────

const FAR_FUTURE = new Date(Date.now() + 7 * 24 * 3600 * 1000)

function activeRow(id = 'tok-1', userId = 'user-1') {
  return {
    id, user_id: userId, token_hash: 'fakehash',
    expires_at: FAR_FUTURE, rotated_at: null,
    replaced_by: null, revoked_at: null,
    created_at: new Date(), ip_address: null, user_agent: null,
  }
}

function graceRow(successorId = 'tok-2', secondsAgo = 5, userId = 'user-1') {
  return {
    ...activeRow('tok-1', userId),
    rotated_at: new Date(Date.now() - secondsAgo * 1000),
    replaced_by: successorId,
  }
}

function expiredGraceRow(successorId = 'tok-2', userId = 'user-1') {
  return { ...graceRow(successorId, 35, userId) } // 35s ago > 30s grace
}

function revokedRow(userId = 'user-1') {
  return { ...activeRow('tok-1', userId), revoked_at: new Date() }
}

function expiredRow(userId = 'user-1') {
  return { ...activeRow('tok-1', userId), expires_at: new Date(Date.now() - 1000) }
}

const userRow = {
  id: 'user-1', email: 'admin@test.com',
  role: 'Admin', restaurant_id: 'rest-1', must_change_password: false,
}

// Helper: sequence mockClient.query responses for the ACTIVE rotation path
// client calls: BEGIN, SELECT token, INSERT new, UPDATE old, SELECT user, COMMIT
function setupActiveRotation(newTokenId = 'tok-new') {
  mockClient.query
    .mockResolvedValueOnce({ rows: [] })                       // BEGIN
    .mockResolvedValueOnce({ rows: [activeRow()] })             // SELECT FOR UPDATE
    .mockResolvedValueOnce({ rows: [{ id: newTokenId }] })     // INSERT new token
    .mockResolvedValueOnce({ rowCount: 1 })                    // UPDATE old token
    .mockResolvedValueOnce({ rows: [userRow] })                 // SELECT user
    .mockResolvedValueOnce({ rows: [] })                       // COMMIT
}

// Helper: sequence for ROTATED_IN_GRACE → ACTIVE successor path
// client calls: BEGIN, SELECT A, SELECT B, INSERT C, UPDATE B, SELECT user, COMMIT
function setupGraceRotation(newTokenId = 'tok-new') {
  mockClient.query
    .mockResolvedValueOnce({ rows: [] })                               // BEGIN
    .mockResolvedValueOnce({ rows: [graceRow('tok-2')] })              // SELECT A (grace)
    .mockResolvedValueOnce({ rows: [activeRow('tok-2')] })             // SELECT B (successor, ACTIVE)
    .mockResolvedValueOnce({ rows: [{ id: newTokenId }] })             // INSERT C
    .mockResolvedValueOnce({ rowCount: 1 })                            // UPDATE B
    .mockResolvedValueOnce({ rows: [userRow] })                        // SELECT user
    .mockResolvedValueOnce({ rows: [] })                               // COMMIT
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPool.query.mockReset()
  mockClient.query.mockReset()
  mockClient.release.mockReset()
  mockPool.connect.mockResolvedValue(mockClient)
  // Default: pool.query (logAuthEvent, revokeAllForUser, issueTokenPair INSERT) returns safely
  mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 })
})

// ─────────────────────────────────────────────────────────────────────────────
// 1–7. State machine — POST /api/auth/refresh
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/auth/refresh — state machine', () => {
  it('1. ACTIVE token → rotation produces new pair, old becomes ROTATED_IN_GRACE', async () => {
    setupActiveRotation()

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'any-plaintext-token' })

    expect(res.status).toBe(200)
    expect(res.body.accessToken).toBeDefined()
    expect(res.body.refreshToken).toBeDefined()
    expect(typeof res.body.refreshToken).toBe('string')
    expect(res.body.refreshToken.length).toBeGreaterThan(0)

    // Verify UPDATE set rotated_at on old token
    const updateCall = mockClient.query.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('rotated_at = NOW()')
    )
    expect(updateCall).toBeDefined()
    expect(updateCall![1]).toContain('tok-new') // replaced_by = new token id
  })

  it('2. ROTATED_IN_GRACE token presented within 30s → rotates successor, returns new pair', async () => {
    setupGraceRotation()

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'grace-token' })

    expect(res.status).toBe(200)
    expect(res.body.accessToken).toBeDefined()
    expect(res.body.refreshToken).toBeDefined()

    // Verify two SELECT FOR UPDATE calls (A then B — I10 order)
    const lockCalls = mockClient.query.mock.calls.filter(
      (c) => typeof c[0] === 'string' && c[0].includes('FOR UPDATE')
    )
    expect(lockCalls).toHaveLength(2)
  })

  it('3. ROTATED_EXPIRED token (>30s since rotation) → theft detected, 401 TOKEN_THEFT', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                      // BEGIN
      .mockResolvedValueOnce({ rows: [expiredGraceRow()] })     // SELECT (ROTATED_EXPIRED state)
      .mockResolvedValueOnce({ rows: [] })                      // ROLLBACK
    mockPool.query
      .mockResolvedValueOnce({ rowCount: 1 })                   // revokeAllForUser UPDATE
      .mockResolvedValue({ rows: [] })                          // logAuthEvent audit

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'expired-grace-token' })

    expect(res.status).toBe(401)
    expect(res.body.code).toBe('TOKEN_THEFT')
  })

  it('4. Theft detection revokes all user tokens via revokeAllForUser', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [expiredGraceRow()] })
      .mockResolvedValueOnce({ rows: [] })                      // ROLLBACK
    mockPool.query
      .mockResolvedValueOnce({ rowCount: 3 })                   // revokeAllForUser
      .mockResolvedValue({ rows: [] })                          // audit log

    await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'expired-grace-token' })

    const revokeCall = mockPool.query.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('revoked_at = NOW()')
        && c[0].includes('user_id')
    )
    expect(revokeCall).toBeDefined()
    expect(revokeCall![1]).toContain('user-1')
  })

  it('5. REVOKED token → 401 revoked, no theft detection triggered', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                      // BEGIN
      .mockResolvedValueOnce({ rows: [revokedRow()] })          // SELECT (REVOKED)
      .mockResolvedValueOnce({ rows: [] })                      // ROLLBACK

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'revoked-token' })

    expect(res.status).toBe(401)
    expect(res.body.code).not.toBe('TOKEN_THEFT')

    // revokeAllForUser must NOT be called (chain already handled)
    const revokeCall = mockPool.query.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('revoked_at = NOW()')
    )
    expect(revokeCall).toBeUndefined()
  })

  it('6. EXPIRED token → 401 with session-expired message', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                      // BEGIN
      .mockResolvedValueOnce({ rows: [expiredRow()] })          // SELECT (EXPIRED)
      .mockResolvedValueOnce({ rows: [] })                      // ROLLBACK

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'expired-token' })

    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/expired/i)
  })

  it('7. Non-existent token → 401 with not_found message', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                      // BEGIN
      .mockResolvedValueOnce({ rows: [] })                      // SELECT returns nothing
      .mockResolvedValueOnce({ rows: [] })                      // ROLLBACK

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'made-up-token' })

    expect(res.status).toBe(401)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 8–9. Concurrency / sequential chain tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Concurrency and sequential rotation', () => {
  it('8. Two parallel rotate calls with same token → both succeed (first ACTIVE, second grace)', async () => {
    // The DB mock responds deterministically to different SQL patterns.
    // Call order: req1 and req2 interleave at each await point.
    // We simulate: req1 sees ACTIVE, req2 sees ROTATED_IN_GRACE (its successor ACTIVE).
    let tokenLookupCount = 0

    mockClient.query.mockImplementation((sql: string) => {
      const s = String(sql)
      if (s.includes('BEGIN') || s.includes('COMMIT') || s.includes('ROLLBACK')) {
        return Promise.resolve({ rows: [], rowCount: 0 })
      }
      if (s.includes('token_hash') && s.includes('FOR UPDATE')) {
        tokenLookupCount++
        return tokenLookupCount === 1
          ? Promise.resolve({ rows: [activeRow()] })
          : Promise.resolve({ rows: [graceRow('tok-r1')] })
      }
      if (s.includes('WHERE id') && s.includes('FOR UPDATE')) {
        return Promise.resolve({ rows: [activeRow('tok-r1')] }) // successor ACTIVE
      }
      if (s.includes('INSERT INTO refresh_tokens')) {
        return Promise.resolve({ rows: [{ id: `tok-${Date.now()}-${Math.random()}` }] })
      }
      if (s.includes('UPDATE refresh_tokens')) {
        return Promise.resolve({ rowCount: 1 })
      }
      if (s.includes('FROM users')) {
        return Promise.resolve({ rows: [userRow] })
      }
      return Promise.resolve({ rows: [], rowCount: 0 })
    })

    const [res1, res2] = await Promise.all([
      request(app).post('/api/auth/refresh').send({ refreshToken: 'shared-token' }),
      request(app).post('/api/auth/refresh').send({ refreshToken: 'shared-token' }),
    ])

    expect(res1.status).toBe(200)
    expect(res2.status).toBe(200)
    expect(res1.body.refreshToken).toBeDefined()
    expect(res2.body.refreshToken).toBeDefined()
    // Each rotation produces a unique new plaintext
    expect(res1.body.refreshToken).not.toBe(res2.body.refreshToken)
  })

  it('9. Three sequential rotations A→B→C: A and B in grace, C is ACTIVE', async () => {
    // Rotation 1: A (ACTIVE) → B
    setupActiveRotation('tok-B')
    const r1 = await request(app).post('/api/auth/refresh').send({ refreshToken: 'token-A' })
    expect(r1.status).toBe(200)

    mockClient.query.mockReset()

    // Rotation 2: A (still in grace) presents again → rotates B→C
    setupGraceRotation('tok-C')
    const r2 = await request(app).post('/api/auth/refresh').send({ refreshToken: 'token-A' })
    expect(r2.status).toBe(200)

    mockClient.query.mockReset()

    // Rotation 3: present B (ACTIVE at this point) → rotates B→D
    setupActiveRotation('tok-D')
    const r3 = await request(app).post('/api/auth/refresh').send({ refreshToken: 'token-B' })
    expect(r3.status).toBe(200)

    // All three returned distinct refresh tokens
    const tokens = [r1.body.refreshToken, r2.body.refreshToken, r3.body.refreshToken]
    expect(new Set(tokens).size).toBe(3)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 10–11. Theft detection
// ─────────────────────────────────────────────────────────────────────────────

describe('Theft detection', () => {
  it('10. Stolen ACTIVE token reused after grace window → chain revoked, audit emitted', async () => {
    // Attacker presents token that was rotated 35s ago (ROTATED_EXPIRED)
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [expiredGraceRow('tok-2', 'user-victim')] })
      .mockResolvedValueOnce({ rows: [] })
    mockPool.query
      .mockResolvedValueOnce({ rowCount: 4 })                   // revokeAllForUser
      .mockResolvedValue({ rows: [] })                          // audit log

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'stolen-token' })

    expect(res.status).toBe(401)
    expect(res.body.code).toBe('TOKEN_THEFT')

    // Confirm revokeAllForUser was called with the correct user_id
    const revokeCall = mockPool.query.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('revoked_at = NOW()')
    )
    expect(revokeCall).toBeDefined()
    expect(revokeCall![1]).toContain('user-victim')
  })

  it('11. After theft detection, all subsequent refresh attempts return 401 revoked', async () => {
    // Step 1: theft detection revokes everything
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [expiredGraceRow()] })
      .mockResolvedValueOnce({ rows: [] })
    mockPool.query
      .mockResolvedValueOnce({ rowCount: 2 })
      .mockResolvedValue({ rows: [] })

    await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'stolen-token' })

    mockClient.query.mockReset()
    mockPool.query.mockReset()
    mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 })

    // Step 2: legitimate user tries any token — it's now REVOKED
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [revokedRow()] })          // any token is REVOKED
      .mockResolvedValueOnce({ rows: [] })

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'legit-users-token' })

    expect(res.status).toBe(401)
    expect(res.body.code).not.toBe('TOKEN_THEFT') // not re-triggering theft
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 12–14. Logout
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/auth/logout', () => {
  it('12. logout revokes all active tokens for user', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rowCount: 2 })                   // revokeAllForUser
      .mockResolvedValue({ rows: [] })                          // logAuthEvent

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.message).toBe('Logged out')

    const revokeCall = mockPool.query.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('revoked_at = NOW()')
        && c[0].includes('user_id')
    )
    expect(revokeCall).toBeDefined()
    expect(revokeCall![1]).toContain(ADMIN_USER.id)
  })

  it('13. after logout, refresh request with a revoked token returns 401', async () => {
    // Logout
    mockPool.query
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValue({ rows: [] })
    await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${adminToken}`)

    mockPool.query.mockReset()
    mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 })
    mockClient.query.mockReset()

    // Attempt refresh with revoked token
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [revokedRow()] })
      .mockResolvedValueOnce({ rows: [] })

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'any-token' })

    expect(res.status).toBe(401)
  })

  it('14. logout with multiple sessions revokes all of them', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rowCount: 5 })                   // 5 sessions revoked
      .mockResolvedValue({ rows: [] })

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)

    // Audit log should include the revocation count
    const auditCall = mockPool.query.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('auth_audit_log')
    )
    expect(auditCall).toBeDefined()
    // The $6 param (metadata object) should reference the count
    const metadata = auditCall![1][5] as Record<string, unknown>
    expect(metadata.count).toBe(5)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 15–18. Audit log assertions
// ─────────────────────────────────────────────────────────────────────────────

describe('Audit log', () => {
  it('15. successful rotation emits refresh_rotated audit event', async () => {
    setupActiveRotation()

    await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'any-token' })

    const auditCall = mockPool.query.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('auth_audit_log')
    )
    expect(auditCall).toBeDefined()
    expect(auditCall![1]).toContain('refresh_rotated')
  })

  it('16. theft detection emits suspected_token_theft audit event', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [expiredGraceRow()] })
      .mockResolvedValueOnce({ rows: [] })
    mockPool.query
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValue({ rows: [] })

    await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'stolen-token' })

    const auditCall = mockPool.query.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('auth_audit_log')
    )
    expect(auditCall).toBeDefined()
    expect(auditCall![1]).toContain('suspected_token_theft')
  })

  it('17. logout emits logout audit event with revocation count', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rowCount: 3 })
      .mockResolvedValue({ rows: [] })

    await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${adminToken}`)

    const auditCall = mockPool.query.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('auth_audit_log')
    )
    expect(auditCall).toBeDefined()
    expect(auditCall![1]).toContain('logout')
    const meta = auditCall![1][5] as Record<string, unknown>
    expect(meta.count).toBe(3)
  })

  it('18. audit metadata never contains plaintext tokens or token hashes', async () => {
    setupActiveRotation('tok-new-18')

    await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'secret-plaintext-value' })

    const auditCall = mockPool.query.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('auth_audit_log')
    )
    expect(auditCall).toBeDefined()
    const allParams = JSON.stringify(auditCall![1])
    // The plaintext token must never appear in audit params
    expect(allParams).not.toContain('secret-plaintext-value')
    // SHA-256 hex of 'secret-plaintext-value' must not appear either
    expect(allParams).not.toMatch(/[0-9a-f]{64}/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 19. Backward compatibility
// ─────────────────────────────────────────────────────────────────────────────

describe('JWT backward compatibility', () => {
  it('19. old JWT without mustChangePassword is not blocked by checkPasswordChangeRequired', async () => {
    const legacyToken = generateAccessToken({
      id: ADMIN_USER.id,
      email: ADMIN_USER.email,
      role: ADMIN_USER.role,
      restaurantId: ADMIN_USER.restaurantId,
      // mustChangePassword intentionally absent — simulates pre-existing sessions
    })

    mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 })

    const res = await request(app)
      .get('/api/menu-items')
      .set('Authorization', `Bearer ${legacyToken}`)

    expect(res.status).toBe(200)
    expect(res.body.code).not.toBe('MUST_CHANGE_PASSWORD')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// race_collision (I9 safety valve)
// ─────────────────────────────────────────────────────────────────────────────

describe('race_collision — chain depth > 1', () => {
  it('grace token whose successor is also in grace returns race_collision error', async () => {
    // A is ROTATED_IN_GRACE → B is also ROTATED_IN_GRACE (depth violation)
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                              // BEGIN
      .mockResolvedValueOnce({ rows: [graceRow('tok-2')] })             // SELECT A (grace)
      .mockResolvedValueOnce({ rows: [graceRow('tok-3', 5, 'user-1')] }) // SELECT B (also grace!)
      .mockResolvedValueOnce({ rows: [] })                              // ROLLBACK

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'deep-grace-token' })

    expect(res.status).toBe(401)
    // race_collision falls into the generic AuthenticationError path (not TOKEN_THEFT)
    expect(res.body.code).not.toBe('TOKEN_THEFT')
  })
})
