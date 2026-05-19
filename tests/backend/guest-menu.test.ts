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

vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn(), compare: vi.fn() },
  hash: vi.fn(),
  compare: vi.fn(),
}))

vi.mock('../../src/lib/sse', () => ({
  sseAdd: vi.fn(),
  sseRemove: vi.fn(),
  sseBroadcast: vi.fn(),
}))

import express from 'express'
import request from 'supertest'
import router from '../../src/api'
import { errorMiddleware } from '../../src/middleware/errorMiddleware'
import pool from '../../src/db'
import { sseBroadcast } from '../../src/lib/sse'

const app = express()
app.use(express.json())
app.use('/api', router)
app.use(errorMiddleware as express.ErrorRequestHandler)

const mockPool = pool as unknown as { query: ReturnType<typeof vi.fn> }
const mockSseBroadcast = vi.mocked(sseBroadcast)

const VALID_UUID = '11111111-2222-3333-4444-555555555555'
const INVALID_ID = 'not-a-uuid'
const TABLE_NUMBER = '5'

const menuItems = [
  { id: 'item-1', name: 'Pizza', price: '650', description: 'Classic', image_url: null,
    menu_category_id: 'cat-1', category_name: 'Main' },
]

beforeEach(() => {
  vi.clearAllMocks()
  mockPool.query.mockReset()
})

// ---------------------------------------------------------------------------
// GET /api/public/menu/:restaurantId
// ---------------------------------------------------------------------------

describe('GET /api/public/menu/:restaurantId', () => {
  it('1. returns menu items and restaurant name for valid restaurant', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: menuItems, rowCount: 1 })          // menu_items join
      .mockResolvedValueOnce({ rows: [{ name: 'My Restaurant' }], rowCount: 1 }) // restaurants

    const res = await request(app).get(`/api/public/menu/${VALID_UUID}`)

    expect(res.status).toBe(200)
    expect(res.body.restaurant.name).toBe('My Restaurant')
    expect(res.body.items).toHaveLength(1)
    expect(res.body.items[0].name).toBe('Pizza')
  })

  it('2. returns 404 when restaurant does not exist', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: menuItems, rowCount: 1 })  // menu query still runs
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })         // restaurants — not found

    const res = await request(app).get(`/api/public/menu/${VALID_UUID}`)

    expect(res.status).toBe(404)
  })

  it('3. returns 400 for non-UUID restaurant ID', async () => {
    const res = await request(app).get(`/api/public/menu/${INVALID_ID}`)

    expect(res.status).toBe(400)
    expect(mockPool.query).not.toHaveBeenCalled()
  })

  it('4. sets Cache-Control: public, max-age=60 header', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [{ name: 'Cafe' }], rowCount: 1 })

    const res = await request(app).get(`/api/public/menu/${VALID_UUID}`)

    expect(res.headers['cache-control']).toBe('public, max-age=60')
  })

  it('5. only returns active=true AND available=true items (SQL check)', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [{ name: 'Test' }], rowCount: 1 })

    await request(app).get(`/api/public/menu/${VALID_UUID}`)

    const sql = mockPool.query.mock.calls[0]?.[0] as string
    expect(sql).toMatch(/active\s*=\s*TRUE/i)
    expect(sql).toMatch(/available\s*=\s*TRUE/i)
  })
})

// ---------------------------------------------------------------------------
// POST /api/public/notify/:restaurantId
// ---------------------------------------------------------------------------

describe('POST /api/public/notify/:restaurantId', () => {
  it('6. creates notification and broadcasts SSE for waiter call', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ id: 'tbl-1' }], rowCount: 1 })  // table check
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })                   // debounce check
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })                   // INSERT notification

    const res = await request(app)
      .post(`/api/public/notify/${VALID_UUID}`)
      .send({ table_number: TABLE_NUMBER, notification_type: 'waiter' })

    expect(res.status).toBe(201)
    expect(res.body.ok).toBe(true)
    expect(mockSseBroadcast).toHaveBeenCalledWith(
      VALID_UUID,
      'guest_notification',
      expect.objectContaining({ table_number: TABLE_NUMBER, notification_type: 'waiter' })
    )
  })

  it('7. returns 429 NOTIFICATION_DEBOUNCED when recent notification exists', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ id: 'tbl-1' }], rowCount: 1 })  // table check
      .mockResolvedValueOnce({ rows: [{ id: 'notif-1' }], rowCount: 1 }) // debounce hit

    const res = await request(app)
      .post(`/api/public/notify/${VALID_UUID}`)
      .send({ table_number: TABLE_NUMBER, notification_type: 'waiter' })

    expect(res.status).toBe(429)
    expect(res.body.code).toBe('NOTIFICATION_DEBOUNCED')
    expect(mockSseBroadcast).not.toHaveBeenCalled()
  })

  it('8. returns 404 when table_number does not belong to the restaurant', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // table not found

    const res = await request(app)
      .post(`/api/public/notify/${VALID_UUID}`)
      .send({ table_number: '99', notification_type: 'bill' })

    expect(res.status).toBe(404)
    expect(mockSseBroadcast).not.toHaveBeenCalled()
  })

  it('9. returns 400 for invalid notification_type', async () => {
    const res = await request(app)
      .post(`/api/public/notify/${VALID_UUID}`)
      .send({ table_number: TABLE_NUMBER, notification_type: 'invalid' })

    expect(res.status).toBe(400)
    expect(mockPool.query).not.toHaveBeenCalled()
  })

  it('10. returns 400 for non-UUID restaurant ID', async () => {
    const res = await request(app)
      .post(`/api/public/notify/${INVALID_ID}`)
      .send({ table_number: TABLE_NUMBER, notification_type: 'waiter' })

    expect(res.status).toBe(400)
    expect(mockPool.query).not.toHaveBeenCalled()
  })

  it('11. INSERT notification uses correct title and message for bill request', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ id: 'tbl-1' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })

    await request(app)
      .post(`/api/public/notify/${VALID_UUID}`)
      .send({ table_number: TABLE_NUMBER, notification_type: 'bill' })

    const insertCall = mockPool.query.mock.calls.find(
      (call) => typeof call[0] === 'string' && (call[0] as string).includes('INSERT INTO notifications')
    )
    expect(insertCall).toBeDefined()
    // $2 = title, $3 = message
    expect(insertCall![1][1]).toBe('Барање за сметка')
    expect(insertCall![1][2]).toContain(TABLE_NUMBER)
  })

  it('12. table validation queries restaurant_tables by restaurant_id AND number', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })

    await request(app)
      .post(`/api/public/notify/${VALID_UUID}`)
      .send({ table_number: TABLE_NUMBER, notification_type: 'waiter' })

    const tableCheckSql = mockPool.query.mock.calls[0]?.[0] as string
    expect(tableCheckSql).toMatch(/restaurant_tables/i)
    expect(tableCheckSql).toMatch(/restaurant_id/i)
    expect(tableCheckSql).toMatch(/number/i)
    const params = mockPool.query.mock.calls[0]?.[1] as unknown[]
    expect(params).toContain(VALID_UUID)
    expect(params).toContain(TABLE_NUMBER)
  })

  it('13. SSE broadcast payload includes table_number, notification_type, and timestamp', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ id: 'tbl-1' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })

    await request(app)
      .post(`/api/public/notify/${VALID_UUID}`)
      .send({ table_number: TABLE_NUMBER, notification_type: 'bill' })

    const payload = mockSseBroadcast.mock.calls[0]?.[2] as Record<string, unknown>
    expect(payload).toHaveProperty('table_number', TABLE_NUMBER)
    expect(payload).toHaveProperty('notification_type', 'bill')
    expect(payload).toHaveProperty('timestamp')
    expect(typeof payload.timestamp).toBe('string')
  })
})
