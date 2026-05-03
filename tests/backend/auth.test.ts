import { describe, it, expect, vi, beforeEach } from 'vitest'
import jwt from 'jsonwebtoken'
import type { Response, NextFunction } from 'express'
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  authenticateToken,
  authorizeRole,
} from '../../src/auth'
import type { AuthRequest } from '../../src/auth'
import { ForbiddenError, AuthenticationError } from '../../src/lib/errors'

const testUser = {
  id: 'user-1',
  email: 'test@gastropro.mk',
  role: 'Admin',
  restaurantId: 'rest-1',
}

const mockRes = {} as Response

describe('generateAccessToken', () => {
  it('returns a three-part JWT string', () => {
    const token = generateAccessToken(testUser)
    expect(token.split('.')).toHaveLength(3)
  })

  it('encodes user payload correctly', () => {
    const token = generateAccessToken(testUser)
    const decoded = jwt.decode(token) as Record<string, unknown>
    expect(decoded.id).toBe(testUser.id)
    expect(decoded.email).toBe(testUser.email)
    expect(decoded.role).toBe(testUser.role)
    expect(decoded.restaurantId).toBe(testUser.restaurantId)
  })

  it('expires in approximately 15 minutes', () => {
    const token = generateAccessToken(testUser)
    const decoded = jwt.decode(token) as Record<string, number>
    const nowSeconds = Math.floor(Date.now() / 1000)
    const diff = decoded.exp - nowSeconds
    expect(diff).toBeGreaterThan(14 * 60)
    expect(diff).toBeLessThanOrEqual(15 * 60)
  })
})

describe('generateRefreshToken', () => {
  it('returns a JWT string', () => {
    const token = generateRefreshToken(testUser)
    expect(typeof token).toBe('string')
    expect(token.split('.')).toHaveLength(3)
  })

  it('expires in approximately 7 days', () => {
    const token = generateRefreshToken(testUser)
    const decoded = jwt.decode(token) as Record<string, number>
    const nowSeconds = Math.floor(Date.now() / 1000)
    const diff = decoded.exp - nowSeconds
    expect(diff).toBeGreaterThan(6 * 24 * 60 * 60)
    expect(diff).toBeLessThanOrEqual(7 * 24 * 60 * 60)
  })

  it('produces different tokens from access tokens (different secret)', () => {
    const access = generateAccessToken(testUser)
    const refresh = generateRefreshToken(testUser)
    expect(access).not.toBe(refresh)
  })
})

describe('verifyRefreshToken', () => {
  it('decodes a valid refresh token', () => {
    const token = generateRefreshToken(testUser)
    const result = verifyRefreshToken(token)
    expect(result).not.toBeNull()
    expect(result?.id).toBe(testUser.id)
    expect(result?.email).toBe(testUser.email)
    expect(result?.restaurantId).toBe(testUser.restaurantId)
  })

  it('returns null for an invalid token string', () => {
    expect(verifyRefreshToken('not.a.token')).toBeNull()
  })

  it('returns null for an empty string', () => {
    expect(verifyRefreshToken('')).toBeNull()
  })

  it('returns null for an access token (signed with wrong secret)', () => {
    const accessToken = generateAccessToken(testUser)
    expect(verifyRefreshToken(accessToken)).toBeNull()
  })
})

describe('authenticateToken middleware', () => {
  let mockNext: NextFunction

  beforeEach(() => {
    mockNext = vi.fn() as unknown as NextFunction
  })

  it('throws AuthenticationError when no Authorization header', () => {
    const req = { headers: {} } as AuthRequest
    expect(() => authenticateToken(req, mockRes, mockNext)).toThrow(AuthenticationError)
  })

  it('sets req.user and calls next() for a valid access token', () => {
    const token = generateAccessToken(testUser)
    const req = { headers: { authorization: `Bearer ${token}` } } as AuthRequest
    authenticateToken(req, mockRes, mockNext)
    expect(mockNext).toHaveBeenCalledWith()
    expect(req.user).toMatchObject({
      id: testUser.id,
      email: testUser.email,
      role: testUser.role,
    })
  })

  it('calls next(error) for a malformed token', () => {
    const req = { headers: { authorization: 'Bearer bad.token.xyz' } } as AuthRequest
    authenticateToken(req, mockRes, mockNext)
    expect(mockNext).toHaveBeenCalledWith(expect.any(Error))
  })

  it('calls next(error) for a refresh token used as access token', () => {
    const refreshToken = generateRefreshToken(testUser)
    const req = { headers: { authorization: `Bearer ${refreshToken}` } } as AuthRequest
    authenticateToken(req, mockRes, mockNext)
    expect(mockNext).toHaveBeenCalledWith(expect.any(Error))
  })
})

describe('authorizeRole middleware', () => {
  let mockNext: NextFunction

  beforeEach(() => {
    mockNext = vi.fn() as unknown as NextFunction
  })

  it('calls next() when user has a required role', () => {
    const req = { user: { ...testUser, role: 'Admin' } } as AuthRequest
    authorizeRole(['Admin', 'Manager'])(req, mockRes, mockNext)
    expect(mockNext).toHaveBeenCalledWith()
  })

  it('throws ForbiddenError when user role is not in allowed list', () => {
    const req = { user: { ...testUser, role: 'Waiter' } } as AuthRequest
    expect(() => authorizeRole(['Admin', 'Manager'])(req, mockRes, mockNext)).toThrow(ForbiddenError)
  })

  it('throws ForbiddenError when req.user is undefined', () => {
    const req = {} as AuthRequest
    expect(() => authorizeRole(['Admin'])(req, mockRes, mockNext)).toThrow(ForbiddenError)
  })

  it('allows all listed roles', () => {
    const roles = ['Admin', 'Manager', 'Chef'] as const
    for (const role of roles) {
      const mockN = vi.fn()
      const req = { user: { ...testUser, role } } as AuthRequest
      authorizeRole([...roles])(req, mockRes, mockN)
      expect(mockN).toHaveBeenCalledWith()
    }
  })
})
