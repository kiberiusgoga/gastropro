import { describe, it, expect } from 'vitest'
import {
  computeInvoiceTotals,
  formatInvoiceNumber,
  computeDueDate,
  getDisplayStatus,
  validateTin,
} from '../../src/lib/nonFiscalInvoiceHelpers'

// ── computeInvoiceTotals ──────────────────────────────────────────────────────

describe('computeInvoiceTotals', () => {
  it('1 — basic 18% VAT: 100 * 1 = 100 + 18 = 118', () => {
    const result = computeInvoiceTotals([{ quantity: 1, unit_price: 100 }], 18)
    expect(result.subtotal).toBe(100)
    expect(result.vat_amount).toBe(18)
    expect(result.total_amount).toBe(118)
  })

  it('2 — multiple items: sum before VAT', () => {
    const items = [
      { quantity: 2, unit_price: 50 },
      { quantity: 3, unit_price: 20 },
    ]
    const result = computeInvoiceTotals(items, 18)
    expect(result.subtotal).toBe(160)
    expect(result.vat_amount).toBe(28.80)
    expect(result.total_amount).toBe(188.80)
  })

  it('3 — zero VAT rate: total equals subtotal', () => {
    const result = computeInvoiceTotals([{ quantity: 5, unit_price: 200 }], 0)
    expect(result.subtotal).toBe(1000)
    expect(result.vat_amount).toBe(0)
    expect(result.total_amount).toBe(1000)
  })

  it('4 — fractional quantities and prices are rounded to 2dp', () => {
    const result = computeInvoiceTotals([{ quantity: 1.5, unit_price: 33.33 }], 18)
    expect(result.subtotal).toBe(50)
    expect(result.total_amount).toBeLessThanOrEqual(result.subtotal * 1.18 + 0.01)
  })

  it('5 — empty items array yields zero totals', () => {
    const result = computeInvoiceTotals([], 18)
    expect(result.subtotal).toBe(0)
    expect(result.vat_amount).toBe(0)
    expect(result.total_amount).toBe(0)
  })
})

// ── formatInvoiceNumber ───────────────────────────────────────────────────────

describe('formatInvoiceNumber', () => {
  it('6 — first invoice of year: NF-2026-0001', () => {
    expect(formatInvoiceNumber(2026, 1)).toBe('NF-2026-0001')
  })

  it('7 — sequential 42: NF-2026-0042', () => {
    expect(formatInvoiceNumber(2026, 42)).toBe('NF-2026-0042')
  })

  it('8 — sequential 1000: NF-2026-1000 (no leading zero)', () => {
    expect(formatInvoiceNumber(2026, 1000)).toBe('NF-2026-1000')
  })

  it('9 — new year resets to NF-2027-0001', () => {
    expect(formatInvoiceNumber(2027, 1)).toBe('NF-2027-0001')
  })
})

// ── computeDueDate ────────────────────────────────────────────────────────────

describe('computeDueDate', () => {
  it('10 — 15 days from 2026-05-01 → 2026-05-16', () => {
    expect(computeDueDate('2026-05-01', 15)).toBe('2026-05-16')
  })

  it('11 — 30 days spanning month boundary', () => {
    expect(computeDueDate('2026-01-20', 30)).toBe('2026-02-19')
  })

  it('12 — 1 day: due tomorrow', () => {
    expect(computeDueDate('2026-06-01', 1)).toBe('2026-06-02')
  })

  it('13 — 0 days: due same day', () => {
    expect(computeDueDate('2026-06-15', 0)).toBe('2026-06-15')
  })
})

// ── getDisplayStatus ──────────────────────────────────────────────────────────

describe('getDisplayStatus', () => {
  const past = '2026-01-01'
  const future = '2099-12-31'

  it('14 — pending + past due_date → overdue', () => {
    expect(getDisplayStatus('pending', past)).toBe('overdue')
  })

  it('15 — pending + future due_date → pending', () => {
    expect(getDisplayStatus('pending', future)).toBe('pending')
  })

  it('16 — paid + past due_date stays paid (already settled)', () => {
    expect(getDisplayStatus('paid', past)).toBe('paid')
  })

  it('17 — cancelled is never overdue', () => {
    expect(getDisplayStatus('cancelled', past)).toBe('cancelled')
  })
})

// ── validateTin ───────────────────────────────────────────────────────────────

describe('validateTin', () => {
  it('18 — exactly 13 digits is valid', () => {
    expect(validateTin('4030000000001')).toBe(true)
  })

  it('19 — 12 digits is invalid (too short)', () => {
    expect(validateTin('403000000000')).toBe(false)
  })

  it('20 — 14 digits is invalid (too long)', () => {
    expect(validateTin('40300000000011')).toBe(false)
  })

  it('21 — non-numeric chars is invalid', () => {
    expect(validateTin('403000000000X')).toBe(false)
  })

  it('22 — empty string is invalid', () => {
    expect(validateTin('')).toBe(false)
  })
})
