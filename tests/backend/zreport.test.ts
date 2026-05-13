import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('../../src/db', () => ({
  default: {
    query: vi.fn(),
    connect: vi.fn(),
  },
}))

vi.mock('../../src/lib/logger', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

// Partially mock zreportService so endpoint tests can override computeZReport
// while still allowing service unit tests to use real implementation
vi.mock('../../src/services/zreportService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/zreportService')>()
  return { ...actual, computeZReport: vi.fn(actual.computeZReport) }
})

import express from 'express'
import request from 'supertest'
import router from '../../src/api'
import { errorMiddleware } from '../../src/middleware/errorMiddleware'
import pool from '../../src/db'
import { generateAccessToken } from '../../src/auth'
import { computeZReport } from '../../src/services/zreportService'

const app = express()
app.use(express.json())
app.use('/api', router)
app.use(errorMiddleware as express.ErrorRequestHandler)

const mockPool = pool as unknown as { query: ReturnType<typeof vi.fn>; connect: ReturnType<typeof vi.fn> }
const mockCompute = computeZReport as ReturnType<typeof vi.fn>

const adminToken = generateAccessToken({ id: 'u1', email: 'admin@test.com', restaurantId: 'r1', role: 'Admin' })
const waiterToken = generateAccessToken({ id: 'w1', email: 'waiter@test.com', restaurantId: 'r1', role: 'Waiter' })
const auth = { Authorization: `Bearer ${adminToken}` }
const waiterAuth = { Authorization: `Bearer ${waiterToken}` }

const mockClient = { query: vi.fn(), release: vi.fn() }

// Minimal ZReportData stub for endpoint tests
const stubZReport = {
  shift_id: 's1',
  restaurant: { id: 'r1', name: 'Test', price_includes_vat: true },
  opened_at: new Date(Date.now() - 3600000).toISOString(),
  closed_at: new Date().toISOString(),
  duration_minutes: 60,
  opened_by: { id: 'u1', name: 'Admin' },
  closed_by: { id: 'u1', name: 'Admin' },
  initial_cash: 1000,
  expected_cash: 1350,
  actual_cash: 1350,
  cash_difference: 0,
  totals: { gross_revenue: 350, net_revenue: 318.18, total_vat: 31.82, order_count: 1, item_count: 2, average_order_value: 350, guest_count: 2 },
  vat_breakdown: [{ rate: 0.10, gross: 350, net: 318.18, vat: 31.82, item_count: 2 }],
  payment_breakdown: [{ method: 'cash', count: 1, total: 350 }],
  order_type_breakdown: [{ type: 'dine_in', count: 1, total: 350 }],
  hourly_revenue: Array.from({ length: 24 }, (_, h) => ({ hour: h, order_count: h === 12 ? 1 : 0, revenue: h === 12 ? 350 : 0 })),
  top_items: [{ menu_item_id: 'mi1', name: 'Burger', quantity_sold: 2, revenue: 350 }],
  category_breakdown: [{ category_id: 'c1', category_name: 'Food', order_count: 1, revenue: 350, percentage: 100 }],
  discounts: { total_amount: 0, application_count: 0, by_type: [] },
  cancellations: { cancelled_order_count: 0, cancelled_value: 0 },
}

// ── Helpers to build the 4-query mock sequence for computeZReport ──────────

function mockShiftQuery(overrides: Partial<{
  initial_cash: string; price_includes_vat: boolean
}> = {}) {
  return {
    rows: [{
      id: 's1',
      start_time: new Date(Date.now() - 3600000).toISOString(),
      end_time: null,
      initial_cash: overrides.initial_cash ?? '1000',
      user_id: 'u1',
      opener_name: 'Admin',
      restaurant_name: 'Test Restaurant',
      restaurant_address: 'Test St 1',
      vat_number: null,
      price_includes_vat: overrides.price_includes_vat ?? true,
    }],
  }
}

function mockOrderAggQuery(rows: Array<{
  status: string; payment_method: string; order_type: string; hour: string; order_count: string; revenue: string; guest_count: string;
}>) {
  return { rows }
}

function mockItemQuery(rows: Array<{
  menu_item_id: string | null; name: string; quantity: string; line_total: string; vat_rate: string;
  category_id: string | null; category_name: string | null; order_id: string;
}>) {
  return { rows }
}

function mockDiscountQuery(rows: Array<{ applied_name: string; applied_type: string; total: string; cnt: string }>) {
  return { rows }
}

function setupComputeMocks(opts: {
  orderRows?: ReturnType<typeof mockOrderAggQuery>['rows'];
  itemRows?: ReturnType<typeof mockItemQuery>['rows'];
  discountRows?: ReturnType<typeof mockDiscountQuery>['rows'];
  shiftOverrides?: Parameters<typeof mockShiftQuery>[0];
} = {}) {
  mockPool.query
    .mockResolvedValueOnce(mockShiftQuery(opts.shiftOverrides))
    .mockResolvedValueOnce(mockOrderAggQuery(opts.orderRows ?? []))
    .mockResolvedValueOnce(mockItemQuery(opts.itemRows ?? []))
    .mockResolvedValueOnce(mockDiscountQuery(opts.discountRows ?? []))
}

beforeEach(() => {
  vi.clearAllMocks()
  mockClient.query.mockReset()
  mockClient.release.mockReset()
  mockPool.connect.mockResolvedValue(mockClient)
})

// ===========================================================================
// COMPUTATION TESTS (service-level)
// ===========================================================================

describe('computeZReport — empty shift', () => {
  it('1. empty shift: zero revenue, zero orders, zero VAT', async () => {
    setupComputeMocks()
    const report = await computeZReport('s1', 'r1', { id: 'u1', name: 'Admin' }, 1000)
    expect(report.totals.gross_revenue).toBe(0)
    expect(report.totals.order_count).toBe(0)
    expect(report.totals.total_vat).toBe(0)
    expect(report.vat_breakdown).toHaveLength(0)
  })

  it('2. empty shift: expected_cash equals initial_cash when no cash sales', async () => {
    setupComputeMocks()
    const report = await computeZReport('s1', 'r1', { id: 'u1', name: 'Admin' }, 1000)
    expect(report.expected_cash).toBe(1000)
    expect(report.cash_difference).toBe(0)
  })
})

describe('computeZReport — cash vs card expected_cash', () => {
  it('3. cash payment: expected_cash = initial_cash + cash_sales', async () => {
    setupComputeMocks({
      orderRows: [{ status: 'paid', payment_method: 'cash', order_type: 'dine_in', hour: '12', order_count: '1', revenue: '500', guest_count: '2' }],
    })
    const report = await computeZReport('s1', 'r1', { id: 'u1', name: 'Admin' }, 1500)
    expect(report.expected_cash).toBe(1500) // 1000 initial + 500 cash
    expect(report.cash_difference).toBe(0)
  })

  it('4. card payment only: expected_cash = initial_cash (no cash revenue added)', async () => {
    setupComputeMocks({
      orderRows: [{ status: 'paid', payment_method: 'card', order_type: 'dine_in', hour: '14', order_count: '2', revenue: '800', guest_count: '4' }],
    })
    const report = await computeZReport('s1', 'r1', { id: 'u1', name: 'Admin' }, 1000)
    expect(report.expected_cash).toBe(1000) // only initial, no cash
    expect(report.totals.gross_revenue).toBe(800)
  })
})

describe('computeZReport — cancelled orders', () => {
  it('5. cancelled orders excluded from gross_revenue and order_count', async () => {
    setupComputeMocks({
      orderRows: [
        { status: 'paid', payment_method: 'cash', order_type: 'dine_in', hour: '12', order_count: '1', revenue: '300', guest_count: '2' },
        { status: 'cancelled', payment_method: 'cash', order_type: 'dine_in', hour: '13', order_count: '2', revenue: '150', guest_count: '3' },
      ],
    })
    const report = await computeZReport('s1', 'r1', { id: 'u1', name: 'Admin' }, 1300)
    expect(report.totals.gross_revenue).toBe(300)
    expect(report.totals.order_count).toBe(1)
    expect(report.cancellations.cancelled_order_count).toBe(2)
    expect(report.cancellations.cancelled_value).toBe(150)
  })
})

describe('computeZReport — VAT breakdown', () => {
  it('6. single VAT rate 10% (price_includes_vat=true): net = gross / 1.10', async () => {
    setupComputeMocks({
      orderRows: [{ status: 'paid', payment_method: 'cash', order_type: 'dine_in', hour: '12', order_count: '1', revenue: '110', guest_count: '1' }],
      itemRows: [{ menu_item_id: 'mi1', name: 'Food', quantity: '1', line_total: '110', vat_rate: '0.10', category_id: 'c1', category_name: 'Food', order_id: 'o1' }],
    })
    const report = await computeZReport('s1', 'r1', { id: 'u1', name: 'Admin' }, 1110)
    expect(report.vat_breakdown).toHaveLength(1)
    expect(report.vat_breakdown[0].rate).toBe(0.10)
    expect(report.vat_breakdown[0].gross).toBeCloseTo(110, 1)
    expect(report.vat_breakdown[0].net).toBeCloseTo(100, 1)
    expect(report.vat_breakdown[0].vat).toBeCloseTo(10, 1)
  })

  it('7. mixed VAT rates: two entries in vat_breakdown', async () => {
    setupComputeMocks({
      orderRows: [{ status: 'paid', payment_method: 'cash', order_type: 'dine_in', hour: '12', order_count: '1', revenue: '350', guest_count: '2' }],
      itemRows: [
        { menu_item_id: 'mi1', name: 'Food', quantity: '1', line_total: '200', vat_rate: '0.10', category_id: 'c1', category_name: 'Food', order_id: 'o1' },
        { menu_item_id: 'mi2', name: 'Beer', quantity: '1', line_total: '150', vat_rate: '0.18', category_id: 'c2', category_name: 'Drinks', order_id: 'o1' },
      ],
    })
    const report = await computeZReport('s1', 'r1', { id: 'u1', name: 'Admin' }, 1350)
    expect(report.vat_breakdown).toHaveLength(2)
    const rates = report.vat_breakdown.map(v => v.rate).sort()
    expect(rates).toEqual([0.10, 0.18])
  })
})

describe('computeZReport — discounts', () => {
  it('8. discounts: total_amount sums applied amounts, application_count counts rows', async () => {
    setupComputeMocks({
      orderRows: [{ status: 'paid', payment_method: 'cash', order_type: 'dine_in', hour: '12', order_count: '1', revenue: '450', guest_count: '2' }],
      discountRows: [
        { applied_name: 'Happy Hour', applied_type: 'percentage', total: '30.00', cnt: '1' },
        { applied_name: 'Manager', applied_type: 'fixed', total: '20.00', cnt: '2' },
      ],
    })
    const report = await computeZReport('s1', 'r1', { id: 'u1', name: 'Admin' }, 1450)
    expect(report.discounts.total_amount).toBe(50)
    expect(report.discounts.application_count).toBe(3)
    expect(report.discounts.by_type).toHaveLength(2)
  })
})

describe('computeZReport — top_items', () => {
  it('9. top_items sorted by quantity_sold desc, max 10', async () => {
    // 11 items with different quantities
    const itemRows = Array.from({ length: 11 }, (_, i) => ({
      menu_item_id: `mi${i}`,
      name: `Item ${i}`,
      quantity: String(11 - i), // 11, 10, 9, ... 1
      line_total: String((11 - i) * 100),
      vat_rate: '0.10',
      category_id: 'c1',
      category_name: 'Food',
      order_id: 'o1',
    }))
    setupComputeMocks({
      orderRows: [{ status: 'paid', payment_method: 'cash', order_type: 'dine_in', hour: '12', order_count: '1', revenue: '6600', guest_count: '1' }],
      itemRows,
    })
    const report = await computeZReport('s1', 'r1', { id: 'u1', name: 'Admin' }, 7600)
    expect(report.top_items).toHaveLength(10)
    expect(report.top_items[0].quantity_sold).toBeGreaterThanOrEqual(report.top_items[1].quantity_sold)
  })
})

describe('computeZReport — hourly_revenue', () => {
  it('10. hourly_revenue: exactly 24 elements, revenue at correct hour', async () => {
    setupComputeMocks({
      orderRows: [
        { status: 'paid', payment_method: 'cash', order_type: 'dine_in', hour: '19', order_count: '3', revenue: '750', guest_count: '6' },
      ],
    })
    const report = await computeZReport('s1', 'r1', { id: 'u1', name: 'Admin' }, 1750)
    expect(report.hourly_revenue).toHaveLength(24)
    expect(report.hourly_revenue[19].revenue).toBe(750)
    expect(report.hourly_revenue[19].order_count).toBe(3)
    expect(report.hourly_revenue[0].revenue).toBe(0)
  })
})

// ===========================================================================
// ENDPOINT TESTS (HTTP-level)
// ===========================================================================

describe('POST /api/shifts/:id/close — auth & validation', () => {
  it('11. 401 when no auth token provided', async () => {
    const res = await request(app)
      .post('/api/shifts/s1/close')
      .send({ actual_cash: 1000 })
    expect(res.status).toBe(401)
  })

  it('12. 400 when actual_cash is missing (Zod validation)', async () => {
    // Zod parse runs before any DB call, so no pool.query mock needed
    const res = await request(app)
      .post('/api/shifts/s1/close')
      .set(auth)
      .send({}) // no actual_cash
    expect(res.status).toBe(400)
  })

  it('13. 409 SHIFT_ALREADY_CLOSED', async () => {
    // assertOwns
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 's1', restaurant_id: 'r1' }], rowCount: 1 })
    // SELECT shift
    mockPool.query.mockResolvedValueOnce({ rows: [{ status: 'closed', user_id: 'u1' }] })

    const res = await request(app)
      .post('/api/shifts/s1/close')
      .set(auth)
      .send({ actual_cash: 1000 })
    expect(res.status).toBe(409)
    expect(res.body.code).toBe('SHIFT_ALREADY_CLOSED')
  })

  it('14. 409 SHIFT_HAS_OPEN_ORDERS with open_order_count', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 's1', restaurant_id: 'r1' }], rowCount: 1 })
    mockPool.query.mockResolvedValueOnce({ rows: [{ status: 'open', user_id: 'u1' }] })
    // open orders count
    mockPool.query.mockResolvedValueOnce({ rows: [{ count: '3' }] })

    const res = await request(app)
      .post('/api/shifts/s1/close')
      .set(auth)
      .send({ actual_cash: 1000 })
    expect(res.status).toBe(409)
    expect(res.body.code).toBe('SHIFT_HAS_OPEN_ORDERS')
    expect(res.body.open_order_count).toBe(3)
  })

  it('15. 403 Waiter cannot close another waiter\'s shift', async () => {
    // assertOwns
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 's1', restaurant_id: 'r1' }], rowCount: 1 })
    // SELECT shift: belongs to different user
    mockPool.query.mockResolvedValueOnce({ rows: [{ status: 'open', user_id: 'OTHER_USER' }] })

    const res = await request(app)
      .post('/api/shifts/s1/close')
      .set(waiterAuth)
      .send({ actual_cash: 500 })
    expect(res.status).toBe(403)
  })
})

describe('POST /api/shifts/:id/close — success', () => {
  it('16. 200 success: response contains shift_id and zreport', async () => {
    mockCompute.mockResolvedValueOnce(stubZReport)
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 's1', restaurant_id: 'r1' }], rowCount: 1 })
    mockPool.query.mockResolvedValueOnce({ rows: [{ status: 'open', user_id: 'u1' }] })
    mockPool.query.mockResolvedValueOnce({ rows: [{ count: '0' }] })
    // client transaction
    mockClient.query.mockResolvedValue({ rows: [] })

    const res = await request(app)
      .post('/api/shifts/s1/close')
      .set(auth)
      .send({ actual_cash: 1350 })
    expect(res.status).toBe(200)
    expect(res.body.shift_id).toBe('s1')
    expect(res.body.zreport).toBeDefined()
    expect(res.body.zreport.totals.gross_revenue).toBe(350)
  })

  it('17. zreport_data persisted: client UPDATE called with JSON-stringified zreport', async () => {
    mockCompute.mockResolvedValueOnce(stubZReport)
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 's1', restaurant_id: 'r1' }], rowCount: 1 })
    mockPool.query.mockResolvedValueOnce({ rows: [{ status: 'open', user_id: 'u1' }] })
    mockPool.query.mockResolvedValueOnce({ rows: [{ count: '0' }] })
    mockClient.query.mockResolvedValue({ rows: [] })

    await request(app)
      .post('/api/shifts/s1/close')
      .set(auth)
      .send({ actual_cash: 1350 })

    // Find the UPDATE shifts query on the client
    const updateCall = mockClient.query.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('UPDATE shifts'),
    )
    expect(updateCall).toBeDefined()
    const params = updateCall![1] as unknown[]
    // param[3] is zreport_data = JSON.stringify(zreport)
    const persisted = JSON.parse(params[3] as string)
    expect(persisted.totals.gross_revenue).toBe(350)
  })
})

describe('GET /api/shifts/:id/zreport', () => {
  it('18. 200 returns frozen zreport_data for a closed shift', async () => {
    // assertOwns
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 's1', restaurant_id: 'r1' }], rowCount: 1 })
    // SELECT zreport_data
    mockPool.query.mockResolvedValueOnce({ rows: [{ zreport_data: stubZReport, status: 'closed', user_id: 'u1' }] })

    const res = await request(app)
      .get('/api/shifts/s1/zreport')
      .set(auth)
    expect(res.status).toBe(200)
    expect(res.body.totals.gross_revenue).toBe(350)
  })

  it('19. 404 when zreport_data is NULL (shift open or not yet closed)', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 's1', restaurant_id: 'r1' }], rowCount: 1 })
    mockPool.query.mockResolvedValueOnce({ rows: [{ zreport_data: null, status: 'open', user_id: 'u1' }] })

    const res = await request(app)
      .get('/api/shifts/s1/zreport')
      .set(auth)
    expect(res.status).toBe(404)
  })
})

describe('GET /api/shifts/:id/preview', () => {
  it('20. 409 SHIFT_ALREADY_CLOSED on preview of closed shift', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 's1', restaurant_id: 'r1' }], rowCount: 1 })
    mockPool.query.mockResolvedValueOnce({ rows: [{ status: 'closed', user_id: 'u1' }] })

    const res = await request(app)
      .get('/api/shifts/s1/preview')
      .set(auth)
    expect(res.status).toBe(409)
    expect(res.body.code).toBe('SHIFT_ALREADY_CLOSED')
  })
})
