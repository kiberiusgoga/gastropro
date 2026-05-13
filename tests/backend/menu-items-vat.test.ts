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

import express from 'express'
import request from 'supertest'
import router from '../../src/api'
import { errorMiddleware } from '../../src/middleware/errorMiddleware'
import pool from '../../src/db'
import { generateAccessToken } from '../../src/auth'

const app = express()
app.use(express.json())
app.use('/api', router)
app.use(errorMiddleware as express.ErrorRequestHandler)

const mockPool = pool as unknown as { query: ReturnType<typeof vi.fn>; connect: ReturnType<typeof vi.fn> }

const adminToken = generateAccessToken({ id: 'u1', email: 'admin@test.com', restaurantId: 'r1', role: 'Admin' })
const auth = { Authorization: `Bearer ${adminToken}` }

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// POST /api/menu-items — vat_rate handling
// ---------------------------------------------------------------------------

describe('POST /api/menu-items — vat_rate', () => {
  it('1. defaults to 0.10 when vat_rate is omitted', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{ id: 'mi1', restaurant_id: 'r1', name: 'Burger', price: 350, vat_rate: 0.10 }],
      rowCount: 1,
    })

    const res = await request(app)
      .post('/api/menu-items')
      .set(auth)
      .send({ menu_category_id: 'cat1', name: 'Burger', price: 350 })

    expect(res.status).toBe(201)
    // Verify vat_rate defaulted to 0.10 in the INSERT call
    const call = mockPool.query.mock.calls[0]
    const params = call[1] as unknown[]
    // Last numeric param before RETURNING is vat_rate (index 7 = value at params[7])
    expect(params[7]).toBe(0.10)
  })

  it('2. stores vat_rate=0.18 when explicitly provided', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{ id: 'mi2', restaurant_id: 'r1', name: 'Вино', price: 200, vat_rate: 0.18 }],
      rowCount: 1,
    })

    const res = await request(app)
      .post('/api/menu-items')
      .set(auth)
      .send({ menu_category_id: 'cat1', name: 'Вино', price: 200, vat_rate: 0.18 })

    expect(res.status).toBe(201)
    const params = mockPool.query.mock.calls[0][1] as unknown[]
    expect(params[7]).toBe(0.18)
  })

  it('3. returns 400 when vat_rate=2.0 (out of range)', async () => {
    const res = await request(app)
      .post('/api/menu-items')
      .set(auth)
      .send({ menu_category_id: 'cat1', name: 'Item', price: 100, vat_rate: 2.0 })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/vat_rate/)
  })

  it('4. returns 400 when vat_rate=-0.1 (negative)', async () => {
    const res = await request(app)
      .post('/api/menu-items')
      .set(auth)
      .send({ menu_category_id: 'cat1', name: 'Item', price: 100, vat_rate: -0.1 })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/vat_rate/)
  })
})

// ---------------------------------------------------------------------------
// PUT /api/menu-items/:id — vat_rate update
// ---------------------------------------------------------------------------

describe('PUT /api/menu-items/:id — vat_rate', () => {
  it('5. can update vat_rate on an existing item', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{ id: 'mi1', restaurant_id: 'r1', name: 'Burger', price: 350, vat_rate: 0.18 }],
      rowCount: 1,
    })

    const res = await request(app)
      .put('/api/menu-items/mi1')
      .set(auth)
      .send({ menu_category_id: 'cat1', name: 'Burger', price: 350, active: true, available: true, vat_rate: 0.18 })

    expect(res.status).toBe(200)
    // The UPDATE query params should include 0.18
    const params = mockPool.query.mock.calls[0][1] as unknown[]
    expect(params).toContain(0.18)
  })

  it('5b. returns 400 on invalid vat_rate in PUT', async () => {
    const res = await request(app)
      .put('/api/menu-items/mi1')
      .set(auth)
      .send({ name: 'Burger', price: 350, vat_rate: 1.5 })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/vat_rate/)
  })
})

// ---------------------------------------------------------------------------
// GET /api/menu-items — vat_rate returned
// ---------------------------------------------------------------------------

describe('GET /api/menu-items — vat_rate included in response', () => {
  it('6. GET returns vat_rate for every item', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [
        { id: 'mi1', restaurant_id: 'r1', name: 'Pizza', price: 500, vat_rate: 0.10, menu_category_id: 'cat1' },
        { id: 'mi2', restaurant_id: 'r1', name: 'Beer', price: 120, vat_rate: 0.18, menu_category_id: 'cat2' },
      ],
      rowCount: 2,
    })

    const res = await request(app)
      .get('/api/menu-items')
      .set(auth)

    expect(res.status).toBe(200)
    expect(res.body[0]).toHaveProperty('vat_rate', 0.10)
    expect(res.body[1]).toHaveProperty('vat_rate', 0.18)
  })
})

// ---------------------------------------------------------------------------
// POST /api/orders — vat_rate snapshot in order_items
// ---------------------------------------------------------------------------

describe('POST /api/orders — vat_rate snapshot', () => {
  const mockClient = { query: vi.fn(), release: vi.fn() }

  beforeEach(() => {
    mockClient.query.mockReset()
    mockClient.release.mockReset()
    mockPool.connect.mockResolvedValue(mockClient)
  })

  it('7. order_item INSERT uses COALESCE subquery to snapshot vat_rate from menu_items', async () => {
    // requireActiveShift (pool.query, not client.query)
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'shift1' }] })
    // BEGIN
    mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 })
    // INSERT INTO orders
    mockClient.query.mockResolvedValueOnce({
      rows: [{ id: 'ord1', restaurant_id: 'r1', status: 'open', total_amount: 0 }],
      rowCount: 1,
    })
    // INSERT INTO order_items (includes vat_rate snapshot subquery)
    mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 1 })
    // UPDATE orders total
    mockClient.query.mockResolvedValueOnce({
      rows: [{ id: 'ord1', total_amount: 350, subtotal: 350 }],
      rowCount: 1,
    })
    // COMMIT
    mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 })

    const res = await request(app)
      .post('/api/orders')
      .set(auth)
      .send({
        order_type: 'dine_in',
        items: [{ menu_item_id: 'mi1', name: 'Pizza', quantity: 1, price: 350, is_bundle: false }],
      })

    expect(res.status).toBe(201)

    // Find the order_items INSERT call
    const insertItemCall = mockClient.query.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('INSERT INTO order_items'),
    )
    expect(insertItemCall).toBeDefined()
    const sql = insertItemCall![0] as string
    // Must use COALESCE subquery, not a client-supplied value
    expect(sql).toMatch(/COALESCE\s*\(\s*\(?SELECT vat_rate FROM menu_items/i)
  })

  it('8. historical immutability: changing menu_item vat_rate does not change params count in order_items INSERT', async () => {
    // requireActiveShift (pool.query)
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'shift1' }] })
    // BEGIN
    mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 })
    // INSERT INTO orders
    mockClient.query.mockResolvedValueOnce({
      rows: [{ id: 'ord2', restaurant_id: 'r1', status: 'open', total_amount: 0 }],
      rowCount: 1,
    })
    // INSERT INTO order_items
    mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 1 })
    // UPDATE orders total
    mockClient.query.mockResolvedValueOnce({
      rows: [{ id: 'ord2', total_amount: 200, subtotal: 200 }],
      rowCount: 1,
    })
    // COMMIT
    mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 })

    await request(app)
      .post('/api/orders')
      .set(auth)
      .send({
        order_type: 'takeaway',
        items: [{ menu_item_id: 'mi2', name: 'Beer', quantity: 1, price: 200, is_bundle: false }],
      })

    const insertItemCall = mockClient.query.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('INSERT INTO order_items'),
    )
    // vat_rate is NOT in params array — it comes from the DB subquery
    const params = insertItemCall![1] as unknown[]
    expect(params).toHaveLength(8) // order_id, menu_item_id, name, quantity, price, station, note, is_bundle
    // vat_rate is resolved by the DB, never passed from the client
    expect(params.every((p) => p !== 0.18 && p !== 0.10)).toBe(true)
  })
})
