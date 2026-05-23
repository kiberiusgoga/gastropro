import { describe, it, expect } from 'vitest'
import { computeMarginPercent, getProductType, getMarginTier } from '../../src/lib/productMetrics'

describe('computeMarginPercent', () => {
  it('1 — returns null when selling_price is 0 (ingredient)', () => {
    expect(computeMarginPercent(0, 50)).toBeNull()
  })

  it('2 — returns null when selling_price is negative', () => {
    expect(computeMarginPercent(-1, 50)).toBeNull()
  })

  it('3 — computes 50% margin (buy 100, sell 200)', () => {
    expect(computeMarginPercent(200, 100)).toBe(50)
  })

  it('4 — computes 70% margin (buy 30, sell 100)', () => {
    expect(computeMarginPercent(100, 30)).toBe(70)
  })

  it('5 — computes negative margin when cost exceeds price (buy 110, sell 100)', () => {
    const result = computeMarginPercent(100, 110)
    expect(result).not.toBeNull()
    expect(result!).toBeLessThan(0)
  })
})

describe('getProductType', () => {
  it('6 — returns ingredient when selling_price is 0', () => {
    expect(getProductType(0)).toBe('ingredient')
  })

  it('7 — returns sellable when selling_price > 0', () => {
    expect(getProductType(100)).toBe('sellable')
  })
})

describe('getMarginTier', () => {
  it('8 — tier high when percent >= 60', () => {
    expect(getMarginTier(65)).toBe('high')
    expect(getMarginTier(60)).toBe('high')
  })

  it('9 — tier medium when 30 <= percent < 60', () => {
    expect(getMarginTier(45)).toBe('medium')
    expect(getMarginTier(30)).toBe('medium')
  })

  it('10 — tier low when 10 <= percent < 30', () => {
    expect(getMarginTier(15)).toBe('low')
    expect(getMarginTier(10)).toBe('low')
  })

  it('11 — tier critical when percent < 10 (including negative)', () => {
    expect(getMarginTier(5)).toBe('critical')
    expect(getMarginTier(-10)).toBe('critical')
  })

  it('12 — returns null when percent is null', () => {
    expect(getMarginTier(null)).toBeNull()
  })
})
