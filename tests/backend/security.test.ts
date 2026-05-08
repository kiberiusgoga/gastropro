/**
 * Security middleware integration tests.
 * Each test builds a minimal Express app with the same middleware stack
 * as server.ts so we can verify behavior in isolation without starting
 * Vite or connecting to a database.
 */

import { describe, it, expect } from 'vitest'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import hpp from 'hpp'
import mongoSanitize from 'express-mongo-sanitize'
import request from 'supertest'

/** Builds a minimal app mirroring the server.ts security middleware stack. */
function buildSecurityApp(opts: { authMax?: number; forgotMax?: number } = {}) {
  const app = express()

  app.use(helmet({ contentSecurityPolicy: false }))

  const allowedOrigins = ['http://localhost:5173']
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true)
      if (allowedOrigins.includes(origin)) return callback(null, true)
      return callback(new Error(`CORS: origin ${origin} not allowed`))
    },
    credentials: true,
  }))

  app.use(express.json({ limit: '100kb' }))
  app.use(express.urlencoded({ extended: true, limit: '100kb' }))
  app.use((mongoSanitize as unknown as () => express.RequestHandler)())
  app.use(hpp())

  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
  })
  app.use('/api', globalLimiter)

  // login + reset-password: skipSuccessfulRequests=true, only failures count
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: opts.authMax ?? 5,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts, please try again in 15 minutes.' },
  })
  app.use('/api/auth/login', authLimiter)
  app.use('/api/auth/reset-password', authLimiter)

  // forgot-password always returns 200, so skipSuccessfulRequests would skip everything
  const forgotPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: opts.forgotMax ?? 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again in 15 minutes.' },
  })
  app.use('/api/auth/forgot-password', forgotPasswordLimiter)

  // Stub routes used by the tests below
  app.post('/api/auth/login', (_req, res) => res.status(401).json({ error: 'Invalid credentials' }))
  app.post('/api/auth/forgot-password', (_req, res) => res.status(200).json({ message: 'ok' }))
  app.post('/api/test-body', (req, res) => res.json({ received: true, keys: Object.keys(req.body) }))
  app.get('/api/test-headers', (_req, res) => res.json({ ok: true }))

  return app
}

// ─────────────────────────────────────────────
// Helmet headers
// ─────────────────────────────────────────────

describe('Helmet security headers', () => {
  const app = buildSecurityApp()

  it('sets X-DNS-Prefetch-Control: off', async () => {
    const res = await request(app).get('/api/test-headers')
    expect(res.headers['x-dns-prefetch-control']).toBe('off')
  })

  it('sets X-Frame-Options: SAMEORIGIN', async () => {
    const res = await request(app).get('/api/test-headers')
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN')
  })

  it('sets X-Content-Type-Options: nosniff', async () => {
    const res = await request(app).get('/api/test-headers')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
  })
})

// ─────────────────────────────────────────────
// Body size limit
// ─────────────────────────────────────────────

describe('Body size limit (100kb)', () => {
  const app = buildSecurityApp()

  it('accepts a request body under 100kb', async () => {
    const res = await request(app)
      .post('/api/test-body')
      .send({ data: 'x'.repeat(1000) })
    expect(res.status).toBe(200)
  })

  it('rejects a JSON body larger than 100kb with 413', async () => {
    // 110 * 1024 chars of payload comfortably exceeds the 100kb limit
    const bigBody = JSON.stringify({ data: 'x'.repeat(110 * 1024) })
    const res = await request(app)
      .post('/api/test-body')
      .set('Content-Type', 'application/json')
      .send(bigBody)
    expect(res.status).toBe(413)
  })
})

// ─────────────────────────────────────────────
// CORS origin enforcement
// ─────────────────────────────────────────────

describe('CORS origin enforcement', () => {
  const app = buildSecurityApp()

  it('allows whitelisted origin and echoes it in the header', async () => {
    const res = await request(app)
      .get('/api/test-headers')
      .set('Origin', 'http://localhost:5173')
    expect(res.status).toBe(200)
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173')
  })

  it('rejects requests from an unallowed origin (no ACAO header, non-2xx)', async () => {
    const res = await request(app)
      .get('/api/test-headers')
      .set('Origin', 'http://evil.com')
    expect(res.status).not.toBe(200)
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('allows requests with no Origin header (curl / same-origin / mobile)', async () => {
    const res = await request(app).get('/api/test-headers')
    expect(res.status).toBe(200)
  })
})

// ─────────────────────────────────────────────
// Auth rate limiting (anti brute-force)
// ─────────────────────────────────────────────

describe('Auth rate limiting', () => {
  it('blocks login after exactly 5 failed attempts; 6th is still 429', async () => {
    // Production limit is 5/15min with skipSuccessfulRequests=true.
    // Each 401 counts; the 6th request is blocked.
    const app = buildSecurityApp({ authMax: 5 })

    const fail = () =>
      request(app).post('/api/auth/login').send({ email: 'x@x.com', password: 'wrong' })

    for (let i = 0; i < 5; i++) {
      expect((await fail()).status).toBe(401)
    }
    // 6th attempt — limiter fires
    const blocked = await fail()
    expect(blocked.status).toBe(429)
    expect(blocked.body.error).toMatch(/Too many login attempts/i)

    // 7th attempt — still blocked (window not reset)
    expect((await fail()).status).toBe(429)
  })

  it('blocks forgot-password after 5 requests (all count — no skipSuccessfulRequests)', async () => {
    const app = buildSecurityApp({ forgotMax: 5 })

    const send = () =>
      request(app).post('/api/auth/forgot-password').send({ email: 'x@x.com' })

    for (let i = 0; i < 5; i++) {
      expect((await send()).status).toBe(200)
    }
    // 6th — limiter fires
    expect((await send()).status).toBe(429)
  })

  it('includes RateLimit headers on the login endpoint', async () => {
    const app = buildSecurityApp({ authMax: 10 })
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'x@x.com', password: 'wrong' })
    // standardHeaders: true → RateLimit-* headers (RFC draft)
    expect(res.headers['ratelimit-limit']).toBeDefined()
    expect(res.headers['ratelimit-remaining']).toBeDefined()
  })
})
