import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import http from 'http'
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

import express from 'express'
import request from 'supertest'
import router from '../../src/api'
import { errorMiddleware } from '../../src/middleware/errorMiddleware'
import { generateAccessToken } from '../../src/auth'
import pool from '../../src/db'

const app = express()
app.use(express.json())
app.use('/api', router)
app.use(errorMiddleware as express.ErrorRequestHandler)

const mockPool = pool as unknown as { query: ReturnType<typeof vi.fn>; connect: ReturnType<typeof vi.fn> }

const ADMIN = { id: 'user-1', email: 'admin@test.com', role: 'Admin', restaurantId: 'rest-1' }
const adminToken = generateAccessToken(ADMIN)

// A syntactically valid (64-char hex) plaintext ticket value for use in tests
const FAKE_TICKET = 'a'.repeat(64)
const FAKE_TICKET_HASH = createHash('sha256').update(FAKE_TICKET).digest('hex')

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Start a real HTTP server on a random port, return { server, port, close }. */
async function startServer() {
  const server = http.createServer(app)
  await new Promise<void>(r => server.listen(0, r))
  const { port } = server.address() as { port: number }
  const close = () => new Promise<void>(r => server.close(() => r()))
  return { server, port, close }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPool.query.mockReset()
  // Default: any pool.query returns safely
  mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 })
})

afterEach(() => {
  vi.useRealTimers()
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/sse-ticket
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/auth/sse-ticket', () => {
  it('1. authenticated user receives a 64-char hex ticket', async () => {
    const res = await request(app)
      .post('/api/auth/sse-ticket')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(typeof res.body.ticket).toBe('string')
    expect(res.body.ticket).toHaveLength(64)
    expect(/^[0-9a-f]{64}$/.test(res.body.ticket)).toBe(true)
    expect(res.body.expires_in).toBe(60)
  })

  it('2. unauthenticated request returns 401', async () => {
    const res = await request(app).post('/api/auth/sse-ticket')
    expect(res.status).toBe(401)
  })

  it('3. DB stores the hash, never the plaintext ticket', async () => {
    await request(app)
      .post('/api/auth/sse-ticket')
      .set('Authorization', `Bearer ${adminToken}`)

    // Find the INSERT into sse_tickets (the audit INSERT goes to auth_audit_log)
    const insertCall = mockPool.query.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('sse_tickets'),
    )
    expect(insertCall).toBeDefined()
    const params = insertCall![1] as string[]

    // $3 = ticket_hash, returned ticket is plaintext
    const storedHash = params[2]
    // storedHash must not equal the plaintext (first response body ticket)
    const ticketRes = await request(app)
      .post('/api/auth/sse-ticket')
      .set('Authorization', `Bearer ${adminToken}`)
    const plaintext = ticketRes.body.ticket as string

    // Verify: stored value IS the SHA-256 of the plaintext
    const expectedHash = createHash('sha256').update(plaintext).digest('hex')
    // storedHash from this second call
    const insertCall2 = mockPool.query.mock.calls
      .filter((c) => typeof c[0] === 'string' && c[0].includes('sse_tickets'))
      .at(-1)!
    const storedHash2 = (insertCall2[1] as string[])[2]

    expect(storedHash2).toBe(expectedHash)
    expect(storedHash2).not.toBe(plaintext)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/events — ticket authentication
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/events — ticket authentication', () => {
  it('4. no ticket → 401', async () => {
    const res = await request(app).get('/api/events')
    expect(res.status).toBe(401)
  })

  it('5. wrong-length ticket (not 64 chars) → 401', async () => {
    const res = await request(app).get('/api/events?ticket=tooshort')
    expect(res.status).toBe(401)
  })

  it('6. expired or not-found ticket (DB returns 0 rows) → 401', async () => {
    mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 }) // no ticket found
    const res = await request(app).get(`/api/events?ticket=${FAKE_TICKET}`)
    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/invalid|expired|already used/i)
  })

  it('7. tampered ticket (correct length, wrong hash) → 401', async () => {
    // DB returns no rows because hash of tampered ticket != stored hash
    mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 })
    const tampered = 'b'.repeat(64) // different from FAKE_TICKET
    const res = await request(app).get(`/api/events?ticket=${tampered}`)
    expect(res.status).toBe(401)
  })

  it('8. replay: ticket already used (used_at IS NOT NULL) → 401', async () => {
    // Simulate: first use succeeds, second use returns empty (used_at already set)
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ user_id: 'u1', restaurant_id: 'r1' }], rowCount: 1 })
      .mockResolvedValue({ rows: [], rowCount: 0 })

    const { port, close } = await startServer()
    try {
      // First connection (succeeds, consumes ticket)
      await new Promise<void>((resolve, reject) => {
        const req = http.get(
          `http://localhost:${port}/api/events?ticket=${FAKE_TICKET}`,
          (res) => { res.destroy(); resolve() },
        )
        req.on('error', (e) => {
          if (/ECONNRESET|hang up/.test(e.message)) resolve(); else reject(e)
        })
      })

      // Second connection (replay attempt)
      const secondRes = await request(app).get(`/api/events?ticket=${FAKE_TICKET}`)
      expect(secondRes.status).toBe(401)
    } finally {
      await close()
    }
  })

  it('9. valid ticket → 200, text/event-stream, initial :connected ping', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ user_id: 'u1', restaurant_id: 'r1' }], rowCount: 1 })
      .mockResolvedValue({ rows: [{ active: true }] }) // validation interval

    const { port, close } = await startServer()
    try {
      const received = await new Promise<{ status: number; contentType: string; data: string }>(
        (resolve, reject) => {
          const chunks: string[] = []
          const req = http.get(
            `http://localhost:${port}/api/events?ticket=${FAKE_TICKET}`,
            (res) => {
              const status = res.statusCode ?? 0
              const contentType = res.headers['content-type'] ?? ''
              res.on('data', (chunk: Buffer) => {
                chunks.push(chunk.toString())
                // We have the initial ping — destroy and resolve
                if (chunks.join('').includes(': connected')) {
                  req.destroy()
                  resolve({ status, contentType, data: chunks.join('') })
                }
              })
              res.on('error', () => { /* socket closed on destroy */ })
            },
          )
          req.on('error', (e) => {
            if (/ECONNRESET|hang up/.test(e.message)) return
            reject(e)
          })
          setTimeout(() => reject(new Error('timeout waiting for SSE ping')), 3000)
        },
      )

      expect(received.status).toBe(200)
      expect(received.contentType).toContain('text/event-stream')
      expect(received.data).toContain(': connected')
    } finally {
      await close()
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SSE re-validation — forced_logout
// ─────────────────────────────────────────────────────────────────────────────

describe('SSE re-validation', () => {
  it('10. forced_logout event fires when user is deactivated mid-session', async () => {
    // Only fake setInterval/clearInterval (what the handler uses).
    // Leaving setTimeout and setImmediate real keeps Node.js HTTP internals working.
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })

    mockPool.query
      .mockResolvedValueOnce({ rows: [{ user_id: 'u1', restaurant_id: 'r1' }], rowCount: 1 })
      .mockResolvedValue({ rows: [{ active: false }] }) // deactivated on validation

    const { port, close } = await startServer()
    try {
      const outputP = new Promise<string>((resolve, reject) => {
        const chunks: string[] = []
        const req = http.get(
          `http://localhost:${port}/api/events?ticket=${FAKE_TICKET}`,
          (res) => {
            res.on('data', (chunk: Buffer) => {
              chunks.push(chunk.toString())
              if (chunks.join('').includes('forced_logout')) resolve(chunks.join(''))
            })
            res.on('end', () => resolve(chunks.join('')))
            res.on('error', () => { /* socket closed on end() */ })
          },
        )
        req.on('error', (e) => {
          if (/ECONNRESET|hang up/.test(e.message)) return
          reject(e)
        })
      })

      // Allow real I/O to establish the SSE connection before advancing faked intervals
      await new Promise<void>(r => setTimeout(r, 200))

      // Fire the 60-second re-validation interval and let its async callback complete
      await vi.advanceTimersByTimeAsync(60000)

      const output = await outputP
      expect(output).toContain('forced_logout')
      expect(output).toContain('account_deactivated')

      // Two audit events are emitted: sse_connection_opened and sse_forced_logout.
      // Find the one specifically carrying the forced-logout action.
      const logoutAudit = mockPool.query.mock.calls.find(
        (c) =>
          typeof c[0] === 'string' &&
          c[0].includes('auth_audit_log') &&
          Array.isArray(c[1]) &&
          (c[1] as unknown[]).includes('sse_forced_logout'),
      )
      expect(logoutAudit).toBeDefined()
    } finally {
      await close()
    }
  }, 10000)
})
