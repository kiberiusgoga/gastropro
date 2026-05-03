import { describe, it, expect } from 'vitest'
import {
  AppError,
  ValidationError,
  AuthenticationError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from '../../src/lib/errors'

describe('AppError', () => {
  it('stores message and statusCode', () => {
    const err = new AppError('Something broke', 500)
    expect(err.message).toBe('Something broke')
    expect(err.statusCode).toBe(500)
    expect(err.isOperational).toBe(true)
  })

  it('is an instance of Error', () => {
    expect(new AppError('x', 500)).toBeInstanceOf(Error)
  })

  it('can be non-operational', () => {
    expect(new AppError('x', 500, false).isOperational).toBe(false)
  })
})

describe('ValidationError', () => {
  it('has statusCode 400', () => {
    expect(new ValidationError('bad input').statusCode).toBe(400)
  })

  it('stores error details', () => {
    const details = [{ field: 'email', msg: 'Invalid' }]
    expect(new ValidationError('bad input', details).errors).toEqual(details)
  })

  it('errors is undefined when not provided', () => {
    expect(new ValidationError('bad input').errors).toBeUndefined()
  })
})

describe('AuthenticationError', () => {
  it('has statusCode 401', () => {
    expect(new AuthenticationError().statusCode).toBe(401)
  })

  it('uses default message', () => {
    expect(new AuthenticationError().message).toBe('Authentication failed')
  })

  it('accepts custom message', () => {
    expect(new AuthenticationError('Unauthorized').message).toBe('Unauthorized')
  })
})

describe('ForbiddenError', () => {
  it('has statusCode 403', () => {
    expect(new ForbiddenError().statusCode).toBe(403)
  })

  it('uses default message', () => {
    expect(new ForbiddenError().message).toBe('Access denied')
  })
})

describe('NotFoundError', () => {
  it('has statusCode 404', () => {
    expect(new NotFoundError().statusCode).toBe(404)
  })

  it('uses default message', () => {
    expect(new NotFoundError().message).toBe('Resource not found')
  })
})

describe('ConflictError', () => {
  it('has statusCode 409', () => {
    expect(new ConflictError('Already exists').statusCode).toBe(409)
  })

  it('stores custom message', () => {
    expect(new ConflictError('Duplicate email').message).toBe('Duplicate email')
  })
})

describe('Error inheritance', () => {
  it('all error types extend AppError', () => {
    expect(new ValidationError('x')).toBeInstanceOf(AppError)
    expect(new AuthenticationError()).toBeInstanceOf(AppError)
    expect(new ForbiddenError()).toBeInstanceOf(AppError)
    expect(new NotFoundError()).toBeInstanceOf(AppError)
    expect(new ConflictError('x')).toBeInstanceOf(AppError)
  })

  it('all error types extend Error', () => {
    expect(new ValidationError('x')).toBeInstanceOf(Error)
    expect(new AuthenticationError()).toBeInstanceOf(Error)
  })
})
