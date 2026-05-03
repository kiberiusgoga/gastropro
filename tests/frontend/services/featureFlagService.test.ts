// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { featureFlagService, DEFAULT_FEATURE_FLAGS } from '../../../src/services/featureFlagService'
import type { Subscription } from '../../../src/types'

function makeSub(plan: 'starter' | 'professional' | 'enterprise'): Subscription {
  return {
    id: 'sub-1',
    restaurantId: 'r1',
    plan,
    price: 29,
    billingCycle: 'monthly',
    status: 'active',
    startDate: new Date().toISOString(),
    endDate: new Date().toISOString(),
    trialEndDate: new Date().toISOString(),
  }
}

describe('DEFAULT_FEATURE_FLAGS', () => {
  it('starter: has inventory, no analytics, no delivery, no multi-restaurant', () => {
    const f = DEFAULT_FEATURE_FLAGS.starter
    expect(f.inventory_enabled).toBe(true)
    expect(f.analytics_enabled).toBe(false)
    expect(f.delivery_enabled).toBe(false)
    expect(f.multi_restaurant_enabled).toBe(false)
  })

  it('professional: has inventory, analytics, delivery but no multi-restaurant', () => {
    const f = DEFAULT_FEATURE_FLAGS.professional
    expect(f.inventory_enabled).toBe(true)
    expect(f.analytics_enabled).toBe(true)
    expect(f.delivery_enabled).toBe(true)
    expect(f.multi_restaurant_enabled).toBe(false)
  })

  it('enterprise: all features enabled', () => {
    const f = DEFAULT_FEATURE_FLAGS.enterprise
    expect(f.inventory_enabled).toBe(true)
    expect(f.analytics_enabled).toBe(true)
    expect(f.delivery_enabled).toBe(true)
    expect(f.multi_restaurant_enabled).toBe(true)
  })
})

describe('featureFlagService.getFeatureFlags', () => {
  it('returns starter flags for starter plan', async () => {
    const flags = await featureFlagService.getFeatureFlags('starter')
    expect(flags).toEqual(DEFAULT_FEATURE_FLAGS.starter)
  })

  it('returns professional flags for professional plan', async () => {
    const flags = await featureFlagService.getFeatureFlags('professional')
    expect(flags).toEqual(DEFAULT_FEATURE_FLAGS.professional)
  })

  it('returns enterprise flags for enterprise plan', async () => {
    const flags = await featureFlagService.getFeatureFlags('enterprise')
    expect(flags).toEqual(DEFAULT_FEATURE_FLAGS.enterprise)
  })

  it('falls back to starter flags for unknown plan ID', async () => {
    const flags = await featureFlagService.getFeatureFlags('unknown' as never)
    expect(flags).toEqual(DEFAULT_FEATURE_FLAGS.starter)
  })
})

describe('featureFlagService.isFeatureEnabled', () => {
  it('returns false when subscription is null', () => {
    const flags = DEFAULT_FEATURE_FLAGS.professional
    expect(featureFlagService.isFeatureEnabled(null, flags, 'analytics_enabled')).toBe(false)
  })

  it('returns the flag value from provided flags object', () => {
    const sub = makeSub('starter')
    const flags = DEFAULT_FEATURE_FLAGS.starter
    expect(featureFlagService.isFeatureEnabled(sub, flags, 'inventory_enabled')).toBe(true)
    expect(featureFlagService.isFeatureEnabled(sub, flags, 'analytics_enabled')).toBe(false)
  })

  it('falls back to DEFAULT_FEATURE_FLAGS when flags param is null', () => {
    const sub = makeSub('professional')
    expect(featureFlagService.isFeatureEnabled(sub, null, 'analytics_enabled')).toBe(true)
    expect(featureFlagService.isFeatureEnabled(sub, null, 'delivery_enabled')).toBe(true)
  })

  it('uses correct plan defaults when flags is null and plan is starter', () => {
    const sub = makeSub('starter')
    expect(featureFlagService.isFeatureEnabled(sub, null, 'analytics_enabled')).toBe(false)
  })
})

describe('featureFlagService.getAllFlags', () => {
  it('returns flags for all three plans', async () => {
    const all = await featureFlagService.getAllFlags()
    expect(all).toHaveProperty('starter')
    expect(all).toHaveProperty('professional')
    expect(all).toHaveProperty('enterprise')
  })

  it('returns an object equal to DEFAULT_FEATURE_FLAGS', async () => {
    expect(await featureFlagService.getAllFlags()).toEqual(DEFAULT_FEATURE_FLAGS)
  })
})

describe('featureFlagService.seedFeatureFlags', () => {
  it('resolves without throwing (no-op)', async () => {
    await expect(
      featureFlagService.seedFeatureFlags('starter', DEFAULT_FEATURE_FLAGS.starter)
    ).resolves.toBeUndefined()
  })
})
