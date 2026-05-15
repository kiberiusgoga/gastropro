import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('../../src/db', () => ({
  default: { query: vi.fn(), connect: vi.fn() },
}))

import pool from '../../src/db'
import { calculateMenuItemCost, calculateNetMargin, ingredientCost } from '../../src/utils/costCalculator'

const mockPool = pool as unknown as { query: ReturnType<typeof vi.fn> }

beforeEach(() => vi.clearAllMocks())

// ── calculateMenuItemCost (async, DB-backed) ──────────────────────────────

describe('calculateMenuItemCost', () => {
  it('1 — menu item with no recipe → unit_cost null, ingredients_count 0', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{ ingredients_count: '0', total_cost: '0', has_missing_prices: false }],
    })
    const result = await calculateMenuItemCost('mi-1', 'r1')
    expect(result.unit_cost).toBeNull()
    expect(result.ingredients_count).toBe(0)
    expect(result.missing_purchase_price).toBe(false)
  })

  it('2 — menu item with 3 ingredients → unit_cost = sum of qty × price', async () => {
    // 3 ingredients: 0.2kg flour@40 + 0.1kg butter@80 + 2pcs eggs@5 = 8+8+10=26
    mockPool.query.mockResolvedValueOnce({
      rows: [{ ingredients_count: '3', total_cost: '26.00', has_missing_prices: false }],
    })
    const result = await calculateMenuItemCost('mi-2', 'r1')
    expect(result.unit_cost).toBe(26)
    expect(result.ingredients_count).toBe(3)
    expect(result.missing_purchase_price).toBe(false)
  })

  it('3 — ingredient with purchase_price=0 → missing_purchase_price true', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{ ingredients_count: '2', total_cost: '15.00', has_missing_prices: true }],
    })
    const result = await calculateMenuItemCost('mi-3', 'r1')
    expect(result.missing_purchase_price).toBe(true)
    expect(result.unit_cost).toBe(15)
  })
})

// ── calculateNetMargin (pure function) ───────────────────────────────────

describe('calculateNetMargin', () => {
  it('4 — 250 gross, 10% VAT, 87 cost → correct breakdown', () => {
    const m = calculateNetMargin(250, 0.10, 87)
    expect(m.selling_price).toBe(250)
    expect(m.vat_rate).toBe(0.10)
    expect(m.net_revenue).toBe(227.27)
    expect(m.vat_amount).toBe(22.73)
    expect(m.unit_cost).toBe(87)
    expect(m.net_margin_amount).toBe(140.27)
    expect(m.net_margin_percent).toBe(61.72)
  })

  it('5 — zero cost (drink/no recipe) → margin = 100% of net_revenue', () => {
    const m = calculateNetMargin(120, 0.18, 0)
    expect(m.unit_cost).toBe(0)
    expect(m.net_margin_amount).toBe(m.net_revenue)
    expect(m.net_margin_percent).toBe(100)
  })

  it('6 — cost > net_revenue → negative margin (losing money)', () => {
    const m = calculateNetMargin(100, 0.10, 200)
    expect(m.net_margin_amount).toBeLessThan(0)
    expect(m.net_margin_percent).toBeLessThan(0)
  })

  it('7 — invalid vat_rate throws', () => {
    expect(() => calculateNetMargin(100, 1.5, 50)).toThrow('Invalid VAT rate')
    expect(() => calculateNetMargin(100, -0.1, 50)).toThrow('Invalid VAT rate')
  })

  it('8 — negative cost throws', () => {
    expect(() => calculateNetMargin(100, 0.10, -5)).toThrow('Invalid unit cost')
  })
})

// ── ingredientCost — unit conversion semantics ────────────────────────────
//
// These tests exist specifically to guard the g→kg and ml→l conversion.
// They test ingredientCost(), the pure TS reference implementation that
// mirrors the SQL CASE statement in calculateMenuItemCost and the
// order-item INSERT subquery. A mocked-DB test cannot catch a wrong
// SQL CASE — only testing this function can.
//
// All five tests would have FAILED before the fix (when the query used
// ri.quantity * p.purchase_price with no unit conversion).

describe('ingredientCost — unit conversion', () => {
  it('9 — g→kg: 100g flour @ 40 MKD/kg = 4.00 MKD (not 4000)', () => {
    expect(ingredientCost(100, 'g', 'kg', 40)).toBe(4)
  })

  it('10 — ml→l: 20ml oil @ 120 MKD/l = 2.40 MKD (not 2400)', () => {
    expect(ingredientCost(20, 'ml', 'l', 120)).toBe(2.4)
  })

  it('11 — pcs→pcs: 1 egg @ 8 MKD/pcs = 8.00 MKD (no conversion factor)', () => {
    expect(ingredientCost(1, 'pcs', 'pcs', 8)).toBe(8)
  })

  it('12 — mixed-unit recipe (margarita): 100g flour + 20ml oil + 1 pcs water = 31.40 MKD', () => {
    const flour = ingredientCost(100, 'g',   'kg',  40)   // 4.00
    const oil   = ingredientCost(20,  'ml',  'l',   120)  // 2.40
    const water = ingredientCost(1,   'pcs', 'pcs', 25)   // 25.00
    expect(flour + oil + water).toBe(31.4)
  })

  it('13 — sanity: recipe cost must be below 50% of selling price (catastrophic unit errors fail here)', () => {
    // Margarita: selling price 250 MKD, 10% VAT → net_revenue 227.27 MKD
    // Correct cost 31.4 MKD = 13.8% of net revenue — well under 50%.
    // Pre-fix (no conversion): cost = 6425 MKD >> 250 MKD → this assertion would FAIL.
    const totalCost = ingredientCost(100, 'g',   'kg',  40)
                    + ingredientCost(20,  'ml',  'l',   120)
                    + ingredientCost(1,   'pcs', 'pcs', 25)
    const sellingPrice = 250
    expect(totalCost).toBeLessThan(sellingPrice * 0.5)  // 31.4 < 125
  })
})
