import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('../../src/db', () => ({
  default: { query: vi.fn(), connect: vi.fn() },
}))
vi.mock('../../src/lib/logger', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

import pool from '../../src/db'
import { computeZReport } from '../../src/services/zreportService'

const mockPool = pool as unknown as { query: ReturnType<typeof vi.fn> }

// Shared shift mock
const shiftRow = {
  id: 's1', start_time: new Date(Date.now() - 3600000).toISOString(),
  end_time: null, initial_cash: '1000', user_id: 'u1',
  opener_name: 'Admin', restaurant_name: 'Test', restaurant_address: null,
  vat_number: null, price_includes_vat: true,
}

// Warehouse rows used in per_warehouse Q5
const mainWarehouseRow = {
  warehouse_id: 'wh1', warehouse_name: 'Главен магацин', is_main: true,
  order_count: '2', subtotal: '550', vat_amount: '50', net_revenue: '500',
}
const teraceWarehouseRow = {
  warehouse_id: 'wh2', warehouse_name: 'Тераса', is_main: false,
  order_count: '1', subtotal: '220', vat_amount: '20', net_revenue: '200',
}
const takeawayRow = {
  warehouse_id: 'no_table', warehouse_name: 'Takeaway/Delivery', is_main: false,
  order_count: '1', subtotal: '110', vat_amount: '10', net_revenue: '100',
}

// Helpers
function mockQ1() { mockPool.query.mockResolvedValueOnce({ rows: [shiftRow] }) }
function mockQ2(orderRows: unknown[] = []) { mockPool.query.mockResolvedValueOnce({ rows: orderRows }) }
function mockQ3(itemRows: unknown[] = []) { mockPool.query.mockResolvedValueOnce({ rows: itemRows }) }
function mockQ4() { mockPool.query.mockResolvedValueOnce({ rows: [] }) }
function mockQ5(whRows: unknown[] = []) { mockPool.query.mockResolvedValueOnce({ rows: whRows }) }
function mockQ6() { mockPool.query.mockResolvedValueOnce({ rows: [{ count: '0', total_amount: '0', total_vat: '0', total_subtotal: '0' }] }) }
function mockQ7() { mockPool.query.mockResolvedValueOnce({ rows: [{ count: '0', total_amount: '0' }] }) }

function setupAll(whRows: unknown[] = []) {
  mockQ1()
  mockQ2()
  mockQ3()
  mockQ4()
  mockQ5(whRows)
  mockQ6()
  mockQ7()
}

beforeEach(() => { vi.clearAllMocks() })

describe('computeZReport — per_warehouse', () => {
  it('1 — per_warehouse key exists in return value (backward-compat key present)', async () => {
    setupAll([mainWarehouseRow])
    const report = await computeZReport('s1', 'r1', { id: 'u1', name: 'Admin' }, 1000)
    expect(report).toHaveProperty('per_warehouse')
    expect(Array.isArray(report.per_warehouse)).toBe(true)
  })

  it('2 — Orders on table with warehouse are aggregated under that warehouse', async () => {
    setupAll([mainWarehouseRow])
    const report = await computeZReport('s1', 'r1', { id: 'u1', name: 'Admin' }, 1000)
    expect(report.per_warehouse).toHaveLength(1)
    const wh = report.per_warehouse![0]
    expect(wh.warehouse_id).toBe('wh1')
    expect(wh.warehouse_name).toBe('Главен магацин')
    expect(wh.is_main).toBe(true)
    expect(wh.order_count).toBe(2)
    expect(wh.subtotal).toBe(550)
    expect(wh.net_revenue).toBe(500)
  })

  it('3 — Takeaway/delivery orders appear as no_table row with Takeaway/Delivery name', async () => {
    setupAll([takeawayRow])
    const report = await computeZReport('s1', 'r1', { id: 'u1', name: 'Admin' }, 1000)
    const tw = report.per_warehouse![0]
    expect(tw.warehouse_id).toBe('no_table')
    expect(tw.warehouse_name).toBe('Takeaway/Delivery')
    expect(tw.is_main).toBe(false)
  })

  it('4 — Sum of per_warehouse subtotals matches when DB returns aggregated rows', async () => {
    setupAll([mainWarehouseRow, teraceWarehouseRow, takeawayRow])
    const report = await computeZReport('s1', 'r1', { id: 'u1', name: 'Admin' }, 1000)
    const totalSubtotal = report.per_warehouse!.reduce((s, w) => s + w.subtotal, 0)
    expect(totalSubtotal).toBeCloseTo(880, 1) // 550 + 220 + 110
  })

  it('5 — Sum of per_warehouse VAT amounts matches aggregated rows', async () => {
    setupAll([mainWarehouseRow, teraceWarehouseRow])
    const report = await computeZReport('s1', 'r1', { id: 'u1', name: 'Admin' }, 1000)
    const totalVat = report.per_warehouse!.reduce((s, w) => s + w.vat_amount, 0)
    expect(totalVat).toBeCloseTo(70, 1) // 50 + 20
  })

  it('6 — Multiple warehouses: main warehouse comes first in the array', async () => {
    // DB returns in ORDER BY is_main DESC, name ASC — main first
    setupAll([mainWarehouseRow, teraceWarehouseRow, takeawayRow])
    const report = await computeZReport('s1', 'r1', { id: 'u1', name: 'Admin' }, 1000)
    expect(report.per_warehouse).toHaveLength(3)
    expect(report.per_warehouse![0].is_main).toBe(true)
    expect(report.per_warehouse![0].warehouse_id).toBe('wh1')
  })

  it('7 — Shift with no paid orders → empty per_warehouse array', async () => {
    setupAll([]) // Q5 returns empty rows
    const report = await computeZReport('s1', 'r1', { id: 'u1', name: 'Admin' }, 1000)
    expect(report.per_warehouse).toHaveLength(0)
  })
})
