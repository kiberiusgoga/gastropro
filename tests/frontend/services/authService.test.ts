// @vitest-environment jsdom
import { vi, describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'

vi.mock('../../../src/lib/apiClient', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
  },
}))

import { authService } from '../../../src/services/authService'
import apiClient from '../../../src/lib/apiClient'
import type { User } from '../../../src/types'

const mockPost = vi.mocked(apiClient.post)

const realUser: User = {
  id: 'u1', name: 'Test User', email: 'real@test.com',
  role: 'Manager', restaurantId: 'r1', active: true, createdAt: new Date().toISOString(),
}

// Vitest 4.x replaces localStorage with a custom file-backed implementation
// that doesn't expose all Storage methods. We stub it with a proper in-memory
// implementation so tests can call setItem/getItem/removeItem reliably.
const localStore: Record<string, string> = {}
const localStorageMock = {
  getItem: (key: string): string | null => localStore[key] ?? null,
  setItem: (key: string, value: string): void => { localStore[key] = value },
  removeItem: (key: string): void => { delete localStore[key] },
  clear: (): void => { Object.keys(localStore).forEach(k => delete localStore[k]) },
}

const AUTH_KEYS = ['gastropro_token', 'gastropro_refresh_token', 'gastropro_user', 'active_shift']

beforeAll(() => {
  vi.stubGlobal('localStorage', localStorageMock)
})

afterAll(() => {
  vi.unstubAllGlobals()
})

beforeEach(() => {
  AUTH_KEYS.forEach(k => localStorageMock.removeItem(k))
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// authService.login — alias redirect
// "demo" and "admin@storehouse.mk" are legacy aliases that resolve to
// admin@gastropro.mk / admin123 and go through the real API.
// ---------------------------------------------------------------------------

describe('authService.login — alias redirect', () => {
  it('redirects admin@storehouse.mk to admin@gastropro.mk credentials', async () => {
    mockPost.mockResolvedValueOnce({
      data: { accessToken: 'alias-acc', refreshToken: 'alias-ref', user: realUser },
    } as never)
    await authService.login('admin@storehouse.mk', 'any')
    expect(mockPost).toHaveBeenCalledWith('/auth/login', {
      email: 'admin@gastropro.mk',
      password: 'admin123',
    })
  })

  it('redirects "demo" alias to admin@gastropro.mk credentials', async () => {
    mockPost.mockResolvedValueOnce({
      data: { accessToken: 'alias-acc', refreshToken: 'alias-ref', user: realUser },
    } as never)
    await authService.login('demo', 'any')
    expect(mockPost).toHaveBeenCalledWith('/auth/login', {
      email: 'admin@gastropro.mk',
      password: 'admin123',
    })
  })

  it('alias login stores tokens returned by the API in localStorage', async () => {
    mockPost.mockResolvedValueOnce({
      data: { accessToken: 'alias-acc', refreshToken: 'alias-ref', user: realUser },
    } as never)
    await authService.login('admin@storehouse.mk', 'any')
    expect(localStorage.getItem('gastropro_token')).toBe('alias-acc')
    expect(localStorage.getItem('gastropro_refresh_token')).toBe('alias-ref')
  })
})

// ---------------------------------------------------------------------------
// authService.login — real API
// ---------------------------------------------------------------------------

describe('authService.login — real API', () => {
  it('calls POST /auth/login with credentials', async () => {
    mockPost.mockResolvedValueOnce({
      data: { accessToken: 'acc', refreshToken: 'ref', user: realUser },
    } as never)
    await authService.login('real@test.com', 'password123')
    expect(mockPost).toHaveBeenCalledWith('/auth/login', {
      email: 'real@test.com',
      password: 'password123',
    })
  })

  it('stores accessToken and refreshToken in localStorage', async () => {
    mockPost.mockResolvedValueOnce({
      data: { accessToken: 'tok-abc', refreshToken: 'ref-xyz', user: realUser },
    } as never)
    await authService.login('real@test.com', 'password123')
    expect(localStorage.getItem('gastropro_token')).toBe('tok-abc')
    expect(localStorage.getItem('gastropro_refresh_token')).toBe('ref-xyz')
  })

  it('returns the user object from the API response', async () => {
    mockPost.mockResolvedValueOnce({
      data: { accessToken: 'tok', refreshToken: 'ref', user: realUser },
    } as never)
    const user = await authService.login('real@test.com', 'password123')
    expect(user.email).toBe('real@test.com')
    expect(user.role).toBe('Manager')
  })

  it('throws the error message from the API response body', async () => {
    const apiError = Object.assign(new Error('Invalid credentials'), {
      response: { data: { error: 'Invalid credentials' } },
    })
    mockPost.mockRejectedValueOnce(apiError)
    await expect(authService.login('bad@test.com', 'wrong')).rejects.toThrow('Invalid credentials')
  })

  it('rethrows non-API errors as-is', async () => {
    mockPost.mockRejectedValueOnce(new Error('Network timeout'))
    await expect(authService.login('x@test.com', 'pass123')).rejects.toThrow('Network timeout')
  })
})

// ---------------------------------------------------------------------------
// authService.logout
// ---------------------------------------------------------------------------

describe('authService.logout', () => {
  it('removes all auth-related keys from localStorage', async () => {
    localStorage.setItem('gastropro_token', 'tok')
    localStorage.setItem('gastropro_refresh_token', 'ref')
    localStorage.setItem('gastropro_user', JSON.stringify(realUser))
    localStorage.setItem('active_shift', JSON.stringify({ id: 's1' }))

    await authService.logout()

    expect(localStorage.getItem('gastropro_token')).toBeNull()
    expect(localStorage.getItem('gastropro_refresh_token')).toBeNull()
    expect(localStorage.getItem('gastropro_user')).toBeNull()
    expect(localStorage.getItem('active_shift')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// authService.getCurrentUser
// ---------------------------------------------------------------------------

describe('authService.getCurrentUser', () => {
  it('returns the parsed user from localStorage when present', () => {
    localStorage.setItem('gastropro_user', JSON.stringify(realUser))
    const user = authService.getCurrentUser()
    expect(user?.email).toBe('real@test.com')
    expect(user?.role).toBe('Manager')
  })

  it('returns null when localStorage is empty', () => {
    const user = authService.getCurrentUser()
    expect(user).toBeNull()
  })

  it('returns null for corrupted JSON in localStorage', () => {
    localStorage.setItem('gastropro_user', 'not-valid-json{{')
    expect(authService.getCurrentUser()).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Disabled methods
// ---------------------------------------------------------------------------

describe('authService.loginWithGoogle', () => {
  it('throws a disabled error', async () => {
    await expect(authService.loginWithGoogle()).rejects.toThrow()
  })
})

describe('authService.register', () => {
  it('throws a disabled error', async () => {
    await expect(authService.register('Test', 'test@test.com', 'pass123')).rejects.toThrow()
  })
})
