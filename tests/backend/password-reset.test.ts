import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createHash } from 'crypto'

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

vi.mock('../../src/services/emailService', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('nodemailer', () => ({
  default: { createTransport: vi.fn(() => ({ sendMail: vi.fn() })) },
  createTransport: vi.fn(() => ({ sendMail: vi.fn() })),
}))

import express from 'express'
import request from 'supertest'
import router from '../../src/api'
import { errorMiddleware } from '../../src/middleware/errorMiddleware'
import pool from '../../src/db'
import { sendEmail } from '../../src/services/emailService'

const app = express()
app.use(express.json())
app.use('/api', router)
app.use(errorMiddleware as express.ErrorRequestHandler)

const mockPool = pool as unknown as { query: ReturnType<typeof vi.fn>; connect: ReturnType<typeof vi.fn> }
const mockSendEmail = sendEmail as ReturnType<typeof vi.fn>

const VALID_TOKEN = 'a'.repeat(64)
const TOKEN_HASH = createHash('sha256').update(VALID_TOKEN).digest('hex')

beforeEach(() => {
  vi.clearAllMocks()
  mockPool.query.mockReset()
  mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 })
  mockSendEmail.mockResolvedValue(undefined)
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/forgot-password
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/auth/forgot-password', () => {
  it('1. returns 200 when email exists', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ id: 'u1', email: 'user@test.com' }], rowCount: 1 }) // user lookup
      .mockResolvedValue({ rows: [], rowCount: 0 }) // INSERT token + audit

    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'user@test.com' })

    expect(res.status).toBe(200)
  })

  it('2. returns 200 when email does NOT exist (anti-enumeration)', async () => {
    mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 }) // user not found

    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nobody@test.com' })

    expect(res.status).toBe(200)
  })

  it('3. response body is identical regardless of whether user exists', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'u1', email: 'user@test.com' }], rowCount: 1 })
    const res1 = await request(app).post('/api/auth/forgot-password').send({ email: 'user@test.com' })

    mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 })
    const res2 = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@test.com' })

    expect(res1.body).toEqual(res2.body)
  })

  it('4. sends email when user exists', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ id: 'u1', email: 'user@test.com' }], rowCount: 1 })
      .mockResolvedValue({ rows: [], rowCount: 0 })

    await request(app).post('/api/auth/forgot-password').send({ email: 'user@test.com' })

    expect(mockSendEmail).toHaveBeenCalledOnce()
    expect(mockSendEmail.mock.calls[0][0].to).toBe('user@test.com')
  })

  it('5. does NOT send email when user does not exist', async () => {
    mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 })

    await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@test.com' })

    expect(mockSendEmail).not.toHaveBeenCalled()
  })

  it('6. DB stores the token hash, not the plaintext token', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ id: 'u1', email: 'user@test.com' }], rowCount: 1 })
      .mockResolvedValue({ rows: [], rowCount: 0 })

    await request(app).post('/api/auth/forgot-password').send({ email: 'user@test.com' })

    // Find the INSERT into password_reset_tokens
    const insertCall = mockPool.query.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('password_reset_tokens'),
    )
    expect(insertCall).toBeDefined()

    // The email body contains the plaintext token; the DB call must NOT contain it
    const emailBody = mockSendEmail.mock.calls[0][0].text as string
    const plaintextTokenMatch = emailBody.match(/token=([0-9a-f]{64})/)
    expect(plaintextTokenMatch).toBeTruthy()
    const plaintext = plaintextTokenMatch![1]

    const params = insertCall![1] as string[]
    const expectedHash = createHash('sha256').update(plaintext).digest('hex')

    // hash is stored, not plaintext
    expect(params).toContain(expectedHash)
    expect(params).not.toContain(plaintext)
  })

  it('7. missing email → 400', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({})
    expect(res.status).toBe(400)
  })

  it('8. invalid email format → 400', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'not-an-email' })
    expect(res.status).toBe(400)
  })

  it('9. audit log entry is written with correct action', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ id: 'u1', email: 'user@test.com' }], rowCount: 1 })
      .mockResolvedValue({ rows: [], rowCount: 0 })

    await request(app).post('/api/auth/forgot-password').send({ email: 'user@test.com' })

    const auditCall = mockPool.query.mock.calls.find(
      (c) =>
        typeof c[0] === 'string' &&
        c[0].includes('auth_audit_log') &&
        Array.isArray(c[1]) &&
        (c[1] as unknown[]).includes('password_reset_requested'),
    )
    expect(auditCall).toBeDefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/reset-password
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/auth/reset-password', () => {
  it('10. valid token → 200, password updated', async () => {
    const bcrypt = await import('bcryptjs')
    ;(bcrypt.hash as ReturnType<typeof vi.fn>).mockResolvedValue('$2b$hashed')

    mockPool.query
      .mockResolvedValueOnce({ rows: [{ user_id: 'u1' }], rowCount: 1 }) // token claim
      .mockResolvedValue({ rows: [], rowCount: 0 }) // UPDATE password, revoke tokens, audit

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: VALID_TOKEN, newPassword: 'NewSecure1!' })

    expect(res.status).toBe(200)
  })

  it('11. invalid / expired / already-used token → 400 with INVALID_RESET_TOKEN', async () => {
    mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 }) // claim returns nothing

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: VALID_TOKEN, newPassword: 'NewSecure1!' })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('INVALID_RESET_TOKEN')
  })

  it('12. replay: token already used → 400', async () => {
    // First call consumes the token; second call gets empty rows
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ user_id: 'u1' }], rowCount: 1 })
      .mockResolvedValue({ rows: [], rowCount: 0 })

    const bcrypt = await import('bcryptjs')
    ;(bcrypt.hash as ReturnType<typeof vi.fn>).mockResolvedValue('$2b$hashed')

    await request(app)
      .post('/api/auth/reset-password')
      .send({ token: VALID_TOKEN, newPassword: 'NewSecure1!' })

    // Second attempt — DB returns no rows (token already used_at set)
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: VALID_TOKEN, newPassword: 'NewSecure1!' })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('INVALID_RESET_TOKEN')
  })

  it('13. all existing refresh tokens are revoked on success', async () => {
    const bcrypt = await import('bcryptjs')
    ;(bcrypt.hash as ReturnType<typeof vi.fn>).mockResolvedValue('$2b$hashed')

    mockPool.query
      .mockResolvedValueOnce({ rows: [{ user_id: 'u1' }], rowCount: 1 })
      .mockResolvedValue({ rows: [], rowCount: 0 })

    await request(app)
      .post('/api/auth/reset-password')
      .send({ token: VALID_TOKEN, newPassword: 'NewSecure1!' })

    const revokeCall = mockPool.query.mock.calls.find(
      (c) =>
        typeof c[0] === 'string' &&
        c[0].includes('refresh_tokens') &&
        c[0].includes('revoked_at'),
    )
    expect(revokeCall).toBeDefined()
  })

  it('14. audit log entry written with password_reset_completed action', async () => {
    const bcrypt = await import('bcryptjs')
    ;(bcrypt.hash as ReturnType<typeof vi.fn>).mockResolvedValue('$2b$hashed')

    mockPool.query
      .mockResolvedValueOnce({ rows: [{ user_id: 'u1' }], rowCount: 1 })
      .mockResolvedValue({ rows: [], rowCount: 0 })

    await request(app)
      .post('/api/auth/reset-password')
      .send({ token: VALID_TOKEN, newPassword: 'NewSecure1!' })

    const auditCall = mockPool.query.mock.calls.find(
      (c) =>
        typeof c[0] === 'string' &&
        c[0].includes('auth_audit_log') &&
        Array.isArray(c[1]) &&
        (c[1] as unknown[]).includes('password_reset_completed'),
    )
    expect(auditCall).toBeDefined()
  })

  it('15. missing token → 400', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ newPassword: 'NewSecure1!' })
    expect(res.status).toBe(400)
  })

  it('16. missing newPassword → 400', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: VALID_TOKEN })
    expect(res.status).toBe(400)
  })
})
