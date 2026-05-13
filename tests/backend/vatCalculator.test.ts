import { describe, it, expect } from 'vitest'
import { calculateVat, aggregateVatByRate } from '../../src/utils/vatCalculator'

describe('calculateVat', () => {
  it('1. gross price with 10% VAT: 110 → { gross:110, net:100, vat:10 }', () => {
    const r = calculateVat(110, 0.10, true)
    expect(r.gross).toBe(110)
    expect(r.net).toBe(100)
    expect(r.vat).toBe(10)
    expect(r.vat_rate).toBe(0.10)
  })

  it('2. net price with 10% VAT: 100 → { gross:110, net:100, vat:10 }', () => {
    const r = calculateVat(100, 0.10, false)
    expect(r.gross).toBe(110)
    expect(r.net).toBe(100)
    expect(r.vat).toBe(10)
  })

  it('3. gross with 18% VAT: 118 → { gross:118, net:100, vat:18 }', () => {
    const r = calculateVat(118, 0.18, true)
    expect(r.gross).toBe(118)
    expect(r.net).toBe(100)
    expect(r.vat).toBe(18)
  })

  it('4. 0% VAT (exempt): 100 → { gross:100, net:100, vat:0 }', () => {
    const r = calculateVat(100, 0.00, true)
    expect(r.gross).toBe(100)
    expect(r.net).toBe(100)
    expect(r.vat).toBe(0)
  })

  it('5. rounding: gross 100 with 10% → net rounds to 90.91', () => {
    // 100 / 1.10 = 90.9090... → rounds to 90.91
    const r = calculateVat(100, 0.10, true)
    expect(r.net).toBe(90.91)
    expect(r.vat).toBe(9.09)
    expect(r.gross).toBe(100)
  })

  it('6. invalid rate < 0 throws', () => {
    expect(() => calculateVat(100, -0.1, true)).toThrow(/Invalid VAT rate/)
  })

  it('6b. invalid rate > 1 throws', () => {
    expect(() => calculateVat(100, 1.5, true)).toThrow(/Invalid VAT rate/)
  })
})

describe('aggregateVatByRate', () => {
  it('7. mix of 10% and 18% items returns Map with 2 entries', () => {
    const items = [
      { price: 110, vat_rate: 0.10, quantity: 1 },
      { price: 118, vat_rate: 0.18, quantity: 1 },
      { price: 110, vat_rate: 0.10, quantity: 2 },
    ]
    const result = aggregateVatByRate(items, true)
    expect(result.size).toBe(2)

    const at10 = result.get(0.10)!
    expect(at10).toBeDefined()
    // 110*1 + 110*2 = 330 gross at 10%
    expect(at10.gross).toBe(330)
    expect(at10.count).toBe(3)

    const at18 = result.get(0.18)!
    expect(at18).toBeDefined()
    expect(at18.gross).toBe(118)
    expect(at18.count).toBe(1)
  })

  it('8. empty array returns empty Map', () => {
    const result = aggregateVatByRate([], true)
    expect(result.size).toBe(0)
  })
})
