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

const mockPool = pool as unknown as { query: ReturnType<typeof vi.fn> }
const mockBcryptHash = vi.mocked(bcrypt.hash)
const mockBcryptCompare = vi.mocked(bcrypt.compare)

const adminUser = {
  id: 'admin-1',
  email: 'admin@test.com',
  role: 'Admin',
  restaurantId: 'rest-1',
}

const adminToken = generateAccessToken(adminUser)
const mustChangeToken = generateAccessToken({ ...adminUser, mustChangePassword: true })
const normalToken = generateAccessToken({ ...adminUser, mustChangePassword: false })

beforeEach(() => {
  vi.clearAllMocks()
  // mockReset clears the mockResolvedValueOnce queue (clearAllMocks only clears calls/results).
  // Without this, unconsumed queue items from a failed test bleed into the next test.
  mockPool.query.mockReset()
  mockBcryptHash.mockResolvedValue('$2b$10$hashedpassword' as never)
})

// ---------------------------------------------------------------------------
// 1-3. POST /api/users
// ---------------------------------------------------------------------------

describe('POST /api/users', () => {
  it('1. generates temp_password when no password is provided', async () => {
    mockPool.query
      .mockResolvedValueOnce({  // INSERT user
        rows: [{
          id: 'new-1', name: 'Alice', email: 'alice@test.com',
          role: 'Waiter', must_change_password: true,
          createdAt: new Date().toISOString(),
        }],
      })
      .mockResolvedValueOnce({ rows: [] }) // audit log

    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Alice', email: 'alice@test.com', role: 'Waiter' })

    expect(res.status).toBe(201)
    expect(res.body.temp_password).toBeDefined()
    expect(typeof res.body.temp_password).toBe('string')
    expect(res.body.temp_password).toHaveLength(16)
    expect(res.body.temp_password_warning).toBeDefined()
    expect(res.body.must_change_password).toBe(true)
  })

  it('2. rejects password shorter than 8 chars with 400', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Bob', email: 'bob@test.com', role: 'Waiter', password: 'short' })

    expect(res.status).toBe(400)
    expect(mockPool.query).not.toHaveBeenCalled()
  })

  it('3. does NOT include temp_password when admin provides a strong password', async () => {
    mockPool.query
      .mockResolvedValueOnce({  // INSERT user
        rows: [{
          id: 'new-2', name: 'Carol', email: 'carol@test.com',
          role: 'Chef', must_change_password: false,
          createdAt: new Date().toISOString(),
        }],
      })
      .mockResolvedValueOnce({ rows: [] }) // audit log

    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Carol', email: 'carol@test.com', role: 'Chef', password: 'StrongPass1!' })

    expect(res.status).toBe(201)
    expect(res.body.temp_password).toBeUndefined()
    expect(res.body.must_change_password).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 4-5, 14. POST /api/employees
// ---------------------------------------------------------------------------

describe('POST /api/employees', () => {
  it('4. always generates temp_password regardless of request body', async () => {
    mockPool.query
      .mockResolvedValueOnce({  // INSERT employee
        rows: [{
          id: 'emp-1', name: 'Dave', email: 'dave@test.com',
          role: 'Waiter', must_change_password: true,
          created_at: new Date().toISOString(),
        }],
      })
      .mockResolvedValueOnce({ rows: [] }) // audit log

    const res = await request(app)
      .post('/api/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Dave', email: 'dave@test.com', role: 'Waiter' })

    expect(res.status).toBe(201)
    expect(res.body.temp_password).toBeDefined()
    expect(res.body.temp_password).toHaveLength(16)
    expect(res.body.temp_password_warning).toBeDefined()
  })

  it('5. INSERT includes must_change_password = TRUE in SQL', async () => {
    mockPool.query
      .mockResolvedValueOnce({
        rows: [{
          id: 'emp-2', name: 'Eve', email: 'eve@test.com',
          role: 'Chef', must_change_password: true,
          created_at: new Date().toISOString(),
        }],
      })
      .mockResolvedValueOnce({ rows: [] })

    await request(app)
      .post('/api/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Eve', email: 'eve@test.com', role: 'Chef' })

    const insertSql = mockPool.query.mock.calls[0]?.[0] as string
    expect(insertSql).toMatch(/must_change_password/i)
    expect(insertSql).toMatch(/TRUE/i)
  })

  it('14. returns 403 when called with Waiter role (RBAC enforcement)', async () => {
    const waiterToken = generateAccessToken({ ...adminUser, role: 'Waiter' })

    const res = await request(app)
      .post('/api/employees')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ name: 'Frank', email: 'frank@test.com', role: 'Waiter' })

    expect(res.status).toBe(403)
    expect(mockPool.query).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// 6. POST /api/auth/login carries mustChangePassword in JWT and response
// ---------------------------------------------------------------------------

describe('POST /api/auth/login with must_change_password user', () => {
  it('6. returns mustChangePassword=true in response when user has the flag', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{
        id: 'u-1', name: 'Alice', email: 'alice@test.com',
        role: 'Waiter', restaurant_id: 'rest-1',
        password_hash: '$2b$10$existing',
        active: true, must_change_password: true,
      }],
      rowCount: 1,
    })
    mockBcryptCompare.mockResolvedValueOnce(true as never)

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@test.com', password: 'anyValidPassword' })

    expect(res.status).toBe(200)
    expect(res.body.accessToken).toBeDefined()
    expect(res.body.user.mustChangePassword).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 7-10. checkPasswordChangeRequired enforcement
// ---------------------------------------------------------------------------

describe('checkPasswordChangeRequired enforcement', () => {
  it('7. returns 403 MUST_CHANGE_PASSWORD on GET /menu-items when flag is true', async () => {
    const res = await request(app)
      .get('/api/menu-items')
      .set('Authorization', `Bearer ${mustChangeToken}`)

    expect(res.status).toBe(403)
    expect(res.body.code).toBe('MUST_CHANGE_PASSWORD')
    // Blocked before any DB access
    expect(mockPool.query).not.toHaveBeenCalled()
  })

  it('8. allows PUT /auth/change-password when must_change_password=TRUE', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ id: adminUser.id, password_hash: '$2b$10$old' }], rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })  // UPDATE
      .mockResolvedValueOnce({ rows: [] })      // audit log

    mockBcryptCompare.mockResolvedValueOnce(true as never)

    const res = await request(app)
      .put('/api/auth/change-password')
      .set('Authorization', `Bearer ${mustChangeToken}`)
      .send({ currentPassword: 'OldPass123!', newPassword: 'NewPass456!!' })

    expect(res.status).toBe(200)
    expect(res.body.message).toBe('Password updated')
  })

  it('9. UPDATE query sets must_change_password=FALSE after password change', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ id: adminUser.id, password_hash: '$2b$10$old' }], rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rows: [] })

    mockBcryptCompare.mockResolvedValueOnce(true as never)

    await request(app)
      .put('/api/auth/change-password')
      .set('Authorization', `Bearer ${mustChangeToken}`)
      .send({ currentPassword: 'OldPass123!', newPassword: 'NewPass456!!' })

    const updateCall = mockPool.query.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].includes('must_change_password=FALSE')
    )
    expect(updateCall).toBeDefined()
  })

  it('10. allows GET /menu-items when mustChangePassword=false in token', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 })

    const res = await request(app)
      .get('/api/menu-items')
      .set('Authorization', `Bearer ${normalToken}`)

    expect(res.status).toBe(200)
  })
})

// ---------------------------------------------------------------------------
// 11-13. Audit log assertions
// ---------------------------------------------------------------------------

describe('auth audit log', () => {
  it('11. creates account_created audit entry on POST /api/users', async () => {
    mockPool.query
      .mockResolvedValueOnce({  // INSERT user
        rows: [{
          id: 'new-3', name: 'Gail', email: 'gail@test.com',
          role: 'Manager', must_change_password: true,
          createdAt: new Date().toISOString(),
        }],
      })
      .mockResolvedValueOnce({ rows: [] }) // audit log

    await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Gail', email: 'gail@test.com', role: 'Manager' })

    const auditCall = mockPool.query.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].includes('auth_audit_log')
    )
    expect(auditCall).toBeDefined()
    expect(auditCall![1]).toContain('account_created')
  })

  it('12. creates password_changed audit entry on PUT /auth/change-password', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ id: adminUser.id, password_hash: '$2b$10$old' }], rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rows: [] }) // audit log

    mockBcryptCompare.mockResolvedValueOnce(true as never)

    await request(app)
      .put('/api/auth/change-password')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ currentPassword: 'OldPass123!', newPassword: 'NewPass456!!' })

    const auditCall = mockPool.query.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].includes('auth_audit_log')
    )
    expect(auditCall).toBeDefined()
    expect(auditCall![1]).toContain('password_changed')
  })

  it('13. audit log metadata for account_created never contains temp_password or password_hash', async () => {
    mockPool.query
      .mockResolvedValueOnce({  // INSERT user
        rows: [{
          id: 'new-4', name: 'Hank', email: 'hank@test.com',
          role: 'Chef', must_change_password: true,
          createdAt: new Date().toISOString(),
        }],
      })
      .mockResolvedValueOnce({ rows: [] }) // audit log

    await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Hank', email: 'hank@test.com', role: 'Chef' })

    const auditCall = mockPool.query.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].includes('auth_audit_log')
    )
    expect(auditCall).toBeDefined()
    // 6th param ($6) is the metadata JSON
    const metadataStr = JSON.stringify(auditCall![1][5])
    expect(metadataStr).not.toContain('temp_password')
    expect(metadataStr).not.toContain('password_hash')
  })
})

// ---------------------------------------------------------------------------
// 15. JWT backward compatibility — old tokens without mustChangePassword
// ---------------------------------------------------------------------------

describe('JWT backward compatibility', () => {
  it('15. old JWT without mustChangePassword field is NOT blocked (treated as false)', async () => {
    // Simulate a token issued before mustChangePassword was added to the payload.
    // generateAccessToken called without the field produces a JWT where the claim is absent —
    // this is exactly what every existing user in production has in their localStorage.
    const legacyToken = generateAccessToken({
      id: adminUser.id,
      email: adminUser.email,
      role: adminUser.role,
      restaurantId: adminUser.restaurantId,
      // mustChangePassword intentionally omitted
    })

    mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 })

    const res = await request(app)
      .get('/api/menu-items')
      .set('Authorization', `Bearer ${legacyToken}`)

    expect(res.status).toBe(200)
    expect(res.body.code).not.toBe('MUST_CHANGE_PASSWORD')
  })
})
