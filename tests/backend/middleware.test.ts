import { describe, it, expect, vi } from 'vitest'
import type { Request, Response, NextFunction } from 'express'
import { z, ZodError } from 'zod'
import { AppError, ValidationError, AuthenticationError } from '../../src/lib/errors'

vi.mock('../../src/lib/logger', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

import { errorMiddleware, asyncHandler } from '../../src/middleware/errorMiddleware'

const mockReq = {
  method: 'GET',
  url: '/test',
  ip: '127.0.0.1',
  get: vi.fn().mockReturnValue('test-agent'),
} as unknown as Request

function makeMockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  }
  return res as unknown as Response
}

function makeZodError(): ZodError {
  try {
    z.object({ name: z.string().min(2) }).parse({ name: '' })
  } catch (e) {
    return e as ZodError
  }
  throw new Error('Expected ZodError')
}

describe('errorMiddleware', () => {
  it('returns correct status and message for AppError', () => {
    const res = makeMockRes()
    errorMiddleware(new AppError('Not allowed', 403), mockReq, res, vi.fn() as NextFunction)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error', message: 'Not allowed' })
    )
  })

  it('returns 401 for AuthenticationError', () => {
    const res = makeMockRes()
    errorMiddleware(new AuthenticationError('Unauthorized'), mockReq, res, vi.fn() as NextFunction)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('includes validation errors for ValidationError', () => {
    const res = makeMockRes()
    const errors = [{ field: 'email', msg: 'Required' }]
    errorMiddleware(new ValidationError('Validation failed', errors), mockReq, res, vi.fn() as NextFunction)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ errors }))
  })

  it('returns 400 with formatted errors for ZodError', () => {
    const res = makeMockRes()
    errorMiddleware(makeZodError(), mockReq, res, vi.fn() as NextFunction)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
        message: 'Validation failed',
        errors: expect.arrayContaining([expect.objectContaining({ path: 'name' })]),
      })
    )
  })

  it('returns 500 for unexpected errors in non-production', () => {
    const res = makeMockRes()
    errorMiddleware(new Error('Unexpected crash'), mockReq, res, vi.fn() as NextFunction)
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error', message: 'Unexpected crash' })
    )
  })
})

describe('asyncHandler', () => {
  it('calls the wrapped handler with req, res, next', async () => {
    const handler = vi.fn().mockResolvedValue(undefined)
    const wrapped = asyncHandler(handler)
    const res = makeMockRes()
    const next = vi.fn()
    await wrapped(mockReq, res, next)
    expect(handler).toHaveBeenCalledWith(mockReq, res, next)
  })

  it('passes rejected errors to next()', async () => {
    const error = new Error('Async failure')
    const handler = vi.fn().mockRejectedValue(error)
    const wrapped = asyncHandler(handler)
    const next = vi.fn()
    await wrapped(mockReq, makeMockRes(), next)
    expect(next).toHaveBeenCalledWith(error)
  })

  it('does not call next() when handler resolves successfully', async () => {
    const handler = vi.fn().mockResolvedValue(undefined)
    const next = vi.fn()
    await asyncHandler(handler)(mockReq, makeMockRes(), next)
    expect(next).not.toHaveBeenCalled()
  })
})
