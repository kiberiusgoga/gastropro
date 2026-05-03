// @vitest-environment jsdom
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('../../../src/lib/apiClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}))

import { billingService, DEFAULT_PLANS } from '../../../src/services/billingService'
import apiClient from '../../../src/lib/apiClient'
import type { Subscription } from '../../../src/types'

const mockGet = vi.mocked(apiClient.get)
const mockPost = vi.mocked(apiClient.post)
const mockPut = vi.mocked(apiClient.put)

function makeSub(plan: 'starter' | 'professional' | 'enterprise'): Subscription {
  return {
    id: 'sub-1', restaurantId: 'r1', plan,
    price: 29, billingCycle: 'monthly', status: 'active',
    startDate: '2024-01-01', endDate: '2024-12-31', trialEndDate: '',
  }
}

beforeEach(() => vi.clearAllMocks())

// ---------------------------------------------------------------------------
// DEFAULT_PLANS
// ---------------------------------------------------------------------------

describe('DEFAULT_PLANS', () => {
  it('contains exactly starter, professional, and enterprise', () => {
    const ids = DEFAULT_PLANS.map(p => p.id)
    expect(ids).toEqual(expect.arrayContaining(['starter', 'professional', 'enterprise']))
    expect(ids).toHaveLength(3)
  })

  it('starter is the cheapest plan', () => {
    const prices = DEFAULT_PLANS.map(p => p.price)
    const starter = DEFAULT_PLANS.find(p => p.id === 'starter')!
    expect(starter.price).toBe(Math.min(...prices))
  })

  it('enterprise has the most product capacity', () => {
    const enterprise = DEFAULT_PLANS.find(p => p.id === 'enterprise')!
    const professional = DEFAULT_PLANS.find(p => p.id === 'professional')!
    expect(enterprise.limits.maxProducts).toBeGreaterThan(professional.limits.maxProducts)
  })

  it('starter does not have analytics or delivery', () => {
    const starter = DEFAULT_PLANS.find(p => p.id === 'starter')!
    expect(starter.limits.hasAnalytics).toBe(false)
    expect(starter.limits.hasDelivery).toBe(false)
  })

  it('professional and enterprise have analytics and delivery', () => {
    for (const id of ['professional', 'enterprise'] as const) {
      const plan = DEFAULT_PLANS.find(p => p.id === id)!
      expect(plan.limits.hasAnalytics).toBe(true)
      expect(plan.limits.hasDelivery).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// billingService.getPlans
// ---------------------------------------------------------------------------

describe('billingService.getPlans', () => {
  it('returns all plans without calling the API', async () => {
    const plans = await billingService.getPlans()
    expect(plans).toHaveLength(DEFAULT_PLANS.length)
    expect(mockGet).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// billingService.checkFeatureAccess
// ---------------------------------------------------------------------------

describe('billingService.checkFeatureAccess', () => {
  it('returns false when subscription is null', () => {
    expect(billingService.checkFeatureAccess(null, 'hasAnalytics')).toBe(false)
  })

  it('starter cannot access analytics', () => {
    expect(billingService.checkFeatureAccess(makeSub('starter'), 'hasAnalytics')).toBe(false)
  })

  it('starter cannot access delivery', () => {
    expect(billingService.checkFeatureAccess(makeSub('starter'), 'hasDelivery')).toBe(false)
  })

  it('professional can access analytics', () => {
    expect(billingService.checkFeatureAccess(makeSub('professional'), 'hasAnalytics')).toBe(true)
  })

  it('enterprise can access delivery', () => {
    expect(billingService.checkFeatureAccess(makeSub('enterprise'), 'hasDelivery')).toBe(true)
  })

  it('returns false for unknown plan ID', () => {
    const sub = { ...makeSub('starter'), plan: 'unknown' as never }
    expect(billingService.checkFeatureAccess(sub, 'hasAnalytics')).toBe(false)
  })

  it('returns true for numeric limits (maxProducts, maxEmployees)', () => {
    expect(billingService.checkFeatureAccess(makeSub('starter'), 'maxProducts')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// billingService.getSubscription
// ---------------------------------------------------------------------------

describe('billingService.getSubscription', () => {
  it('returns null when the API returns an empty array', async () => {
    mockGet.mockResolvedValueOnce({ data: [] } as never)
    expect(await billingService.getSubscription()).toBeNull()
  })

  it('returns null when the API call fails', async () => {
    mockGet.mockRejectedValueOnce(new Error('Network error'))
    expect(await billingService.getSubscription()).toBeNull()
  })

  it('maps snake_case DB fields to camelCase subscription object', async () => {
    mockGet.mockResolvedValueOnce({
      data: [{
        id: 'sub-42', restaurant_id: 'r1', plan: 'professional',
        price: '79.00', billing_cycle: 'monthly', status: 'active',
        start_date: '2024-01-01', end_date: '2024-12-31', trial_end_date: null,
      }],
    } as never)
    const sub = await billingService.getSubscription()
    expect(sub?.id).toBe('sub-42')
    expect(sub?.plan).toBe('professional')
    expect(sub?.price).toBe(79)
    expect(sub?.billingCycle).toBe('monthly')
    expect(sub?.status).toBe('active')
  })
})

// ---------------------------------------------------------------------------
// billingService.createTrialSubscription
// ---------------------------------------------------------------------------

describe('billingService.createTrialSubscription', () => {
  it('returns a fallback subscription object when API fails', async () => {
    mockPost.mockRejectedValueOnce(new Error('API down'))
    const sub = await billingService.createTrialSubscription('r1')
    expect(sub.plan).toBe('starter')
    expect(sub.status).toBe('trialing')
    expect(sub.id).toMatch(/^trial_/)
  })

  it('uses provided planId for the trial', async () => {
    mockPost.mockRejectedValueOnce(new Error('fail'))
    const sub = await billingService.createTrialSubscription('r1', 'professional')
    expect(sub.plan).toBe('professional')
  })

  it('calls POST /subscriptions with trial data on success', async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        id: 'sub-new', restaurant_id: 'r1', plan: 'starter',
        price: '29.00', billing_cycle: 'monthly', status: 'trialing',
        start_date: '2024-01-01', end_date: '2024-01-15', trial_end_date: '2024-01-15',
      },
    } as never)
    const sub = await billingService.createTrialSubscription('r1')
    expect(mockPost).toHaveBeenCalledWith('/subscriptions', expect.objectContaining({
      plan: 'starter',
      status: 'trialing',
    }))
    expect(sub.status).toBe('trialing')
  })
})

// ---------------------------------------------------------------------------
// billingService.upgradePlan
// ---------------------------------------------------------------------------

describe('billingService.upgradePlan', () => {
  it('throws for an invalid plan ID', async () => {
    await expect(billingService.upgradePlan('sub-1', 'diamond' as never)).rejects.toThrow('Invalid plan ID')
  })

  it('calls PUT with the correct plan and active status', async () => {
    mockPut.mockResolvedValueOnce({ data: {} } as never)
    await billingService.upgradePlan('sub-1', 'professional')
    expect(mockPut).toHaveBeenCalledWith('/subscriptions/sub-1', expect.objectContaining({
      plan: 'professional',
      status: 'active',
    }))
  })

  it('rethrows API errors', async () => {
    mockPut.mockRejectedValueOnce(new Error('Payment failed'))
    await expect(billingService.upgradePlan('sub-1', 'enterprise')).rejects.toThrow('Payment failed')
  })
})

// ---------------------------------------------------------------------------
// billingService.cancelSubscription
// ---------------------------------------------------------------------------

describe('billingService.cancelSubscription', () => {
  it('calls PUT with status canceled', async () => {
    mockPut.mockResolvedValueOnce({ data: {} } as never)
    await billingService.cancelSubscription('sub-1')
    expect(mockPut).toHaveBeenCalledWith('/subscriptions/sub-1', { status: 'canceled' })
  })
})
