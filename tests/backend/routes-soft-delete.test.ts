/**
 * Regression tests for the 6 new CRUD routes added in the soft-delete pass:
 *   DELETE /orders/:id
 *   DELETE /customers/:id
 *   DELETE /reservations/:id
 *   PUT    /suppliers/:id
 *   DELETE /suppliers/:id
 *   DELETE /purchase-orders/:id
 *
 * Each test group covers:
 *   - Happy path (204 / 200)
 *   - Cross-tenant protection (404 via assertOwns)
 *   - Business rule guard (409 ConflictError where applicable)
 *   - Idempotency / edge cases
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('../../src/db', () => ({
  default: { query: vi.fn(), connect: vi.fn() },
}))
vi.mock('../../src/lib/logger', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))
vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn(), compare: vi.fn() },
  hash: vi.fn(),
  compare: vi.fn(),
}))
vi.mock('../../src/services/inventoryDeductionService', () => ({
  deductForOrderItem: vi.fn().mockResolvedValue([]),
  restoreForOrderItem: vi.fn().mockResolvedValue(undefined),
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
import { generateAccessToken } from '../../src/auth'

const app = express()
app.use(express.json())
app.use('/api', router)
app.use(errorMiddleware as express.ErrorRequestHandler)

const mockPool = pool as unknown as {
  query: ReturnType<typeof vi.fn>
  connect: ReturnType<typeof vi.fn>
}

function makeClient(responses: Array<{ rows?: any[]; rowCount?: number }>) {
  const client = { query: vi.fn(), release: vi.fn() }
  for (const r of responses) {
    client.query.mockResolvedValueOnce({
      rows: r.rows ?? [],
      rowCount: r.rowCount ?? (r.rows?.length ?? 0),
    })
  }
  return client
}

const tokenA = () =>
  generateAccessToken({ id: 'user-a', email: 'a@r1.com', role: 'Admin', restaurantId: 'r1' })

beforeEach(() => vi.clearAllMocks())

// ─────────────────────────────────────────────
// DELETE /orders/:id
// ─────────────────────────────────────────────

describe('DELETE /orders/:id', () => {
  it('204 — cancels an open order, restores inventory, frees table', async () => {
    // assertOwns
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'ord-1' }], rowCount: 1 })
    // SELECT status + table_id
    mockPool.query.mockResolvedValueOnce({ rows: [{ status: 'open', table_id: 'tbl-1' }], rowCount: 1 })

    const client = makeClient([
      { rows: [], rowCount: 0 },                        // BEGIN
      { rows: [{ id: 'item-1' }], rowCount: 1 },        // SELECT ready items
      { rows: [], rowCount: 0 },                        // UPDATE orders (cancel)
      { rows: [], rowCount: 0 },                        // SELECT open orders on table
      { rows: [], rowCount: 0 },                        // UPDATE restaurant_tables free
      { rows: [], rowCount: 0 },                        // COMMIT
    ])
    mockPool.connect.mockResolvedValueOnce(client)

    const res = await request(app)
      .delete('/api/orders/ord-1')
      .set('Authorization', `Bearer ${tokenA()}`)
      .send({ reason: 'Customer left' })

    expect(res.status).toBe(204)
  })

  it('404 — cross-tenant order (assertOwns returns 0 rows)', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }) // assertOwns fails

    const res = await request(app)
      .delete('/api/orders/ord-r2')
      .set('Authorization', `Bearer ${tokenA()}`)
      .send({ reason: 'test' })

    expect(res.status).toBe(404)
  })

  it('409 — cannot cancel a paid order', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'ord-1' }], rowCount: 1 }) // assertOwns
    mockPool.query.mockResolvedValueOnce({ rows: [{ status: 'paid', table_id: null }], rowCount: 1 }) // status fetch

    const res = await request(app)
      .delete('/api/orders/ord-1')
      .set('Authorization', `Bearer ${tokenA()}`)
      .send({ reason: 'test' })

    expect(res.status).toBe(409)
  })

  it('204 — idempotent: already-cancelled order returns 204 without hitting transaction', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'ord-1' }], rowCount: 1 }) // assertOwns
    mockPool.query.mockResolvedValueOnce({ rows: [{ status: 'cancelled', table_id: null }], rowCount: 1 })

    const res = await request(app)
      .delete('/api/orders/ord-1')
      .set('Authorization', `Bearer ${tokenA()}`)
      .send({ reason: 'already done' })

    expect(res.status).toBe(204)
    expect(mockPool.connect).not.toHaveBeenCalled()
  })

  it('400 — missing reason fails Zod validation', async () => {
    const res = await request(app)
      .delete('/api/orders/ord-1')
      .set('Authorization', `Bearer ${tokenA()}`)
      .send({})

    expect(res.status).toBe(400)
  })
})

// ─────────────────────────────────────────────
// DELETE /customers/:id
// ─────────────────────────────────────────────

describe('DELETE /customers/:id', () => {
  it('204 — soft-deletes and anonymises customer PII', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'cust-1' }], rowCount: 1 }) // assertOwns
    mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 })                  // UPDATE (anonymise)

    const res = await request(app)
      .delete('/api/customers/cust-1')
      .set('Authorization', `Bearer ${tokenA()}`)

    expect(res.status).toBe(204)

    const updateCall = mockPool.query.mock.calls.find(
      ([sql]: [string]) => typeof sql === 'string' && sql.includes('UPDATE customers'),
    )
    expect(updateCall).toBeDefined()
    const sql: string = updateCall![0]
    expect(sql).toContain('deleted_at')
    expect(sql).toContain('Deleted Customer #')
    expect(sql).toContain('phone = NULL')
  })

  it('404 — cross-tenant customer', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }) // assertOwns fails

    const res = await request(app)
      .delete('/api/customers/cust-r2')
      .set('Authorization', `Bearer ${tokenA()}`)

    expect(res.status).toBe(404)
  })
})

// ─────────────────────────────────────────────
// DELETE /reservations/:id
// ─────────────────────────────────────────────

describe('DELETE /reservations/:id', () => {
  it('204 — cancels a reserved reservation', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'res-1' }], rowCount: 1 })                          // assertOwns
    mockPool.query.mockResolvedValueOnce({ rows: [{ status: 'reserved', table_id: null }], rowCount: 1 })   // status fetch
    mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 })                                          // UPDATE

    const res = await request(app)
      .delete('/api/reservations/res-1')
      .set('Authorization', `Bearer ${tokenA()}`)

    expect(res.status).toBe(204)
  })

  it('404 — cross-tenant reservation', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 })

    const res = await request(app)
      .delete('/api/reservations/res-r2')
      .set('Authorization', `Bearer ${tokenA()}`)

    expect(res.status).toBe(404)
  })

  it('409 — cannot cancel an arrived reservation', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'res-1' }], rowCount: 1 })                         // assertOwns
    mockPool.query.mockResolvedValueOnce({ rows: [{ status: 'arrived', table_id: null }], rowCount: 1 })   // status fetch

    const res = await request(app)
      .delete('/api/reservations/res-1')
      .set('Authorization', `Bearer ${tokenA()}`)

    expect(res.status).toBe(409)
  })

  it('409 — cannot cancel a completed reservation', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'res-1' }], rowCount: 1 })
    mockPool.query.mockResolvedValueOnce({ rows: [{ status: 'completed', table_id: null }], rowCount: 1 })

    const res = await request(app)
      .delete('/api/reservations/res-1')
      .set('Authorization', `Bearer ${tokenA()}`)

    expect(res.status).toBe(409)
  })

  it('204 — idempotent: already-cancelled returns 204 without second UPDATE', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'res-1' }], rowCount: 1 })
    mockPool.query.mockResolvedValueOnce({ rows: [{ status: 'cancelled', table_id: null }], rowCount: 1 })

    const res = await request(app)
      .delete('/api/reservations/res-1')
      .set('Authorization', `Bearer ${tokenA()}`)

    expect(res.status).toBe(204)
    expect(mockPool.query).toHaveBeenCalledTimes(2) // assertOwns + status, no UPDATE
  })
})

// ─────────────────────────────────────────────
// PUT /suppliers/:id
// ─────────────────────────────────────────────

describe('PUT /suppliers/:id', () => {
  it('200 — updates supplier fields', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'sup-1' }], rowCount: 1 })                 // assertOwns
    mockPool.query.mockResolvedValueOnce({ rows: [{ deleted_at: null }], rowCount: 1 })             // deleted_at check
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'sup-1', name: 'NewName' }], rowCount: 1 }) // UPDATE

    const res = await request(app)
      .put('/api/suppliers/sup-1')
      .set('Authorization', `Bearer ${tokenA()}`)
      .send({ name: 'NewName', active: true })

    expect(res.status).toBe(200)
    expect(res.body.name).toBe('NewName')
  })

  it('404 — cross-tenant supplier', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }) // assertOwns fails

    const res = await request(app)
      .put('/api/suppliers/sup-r2')
      .set('Authorization', `Bearer ${tokenA()}`)
      .send({ name: 'X' })

    expect(res.status).toBe(404)
  })

  it('404 — soft-deleted supplier', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'sup-1' }], rowCount: 1 })
    mockPool.query.mockResolvedValueOnce({ rows: [{ deleted_at: '2025-01-01T00:00:00Z' }], rowCount: 1 })

    const res = await request(app)
      .put('/api/suppliers/sup-1')
      .set('Authorization', `Bearer ${tokenA()}`)
      .send({ name: 'Ghost' })

    expect(res.status).toBe(404)
  })
})

// ─────────────────────────────────────────────
// DELETE /suppliers/:id
// ─────────────────────────────────────────────

describe('DELETE /suppliers/:id', () => {
  it('204 — soft-deletes supplier with no pending POs', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'sup-1' }], rowCount: 1 }) // assertOwns
    mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 })                  // pending POs check
    mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 })                  // UPDATE soft-delete

    const res = await request(app)
      .delete('/api/suppliers/sup-1')
      .set('Authorization', `Bearer ${tokenA()}`)

    expect(res.status).toBe(204)
  })

  it('404 — cross-tenant supplier', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 })

    const res = await request(app)
      .delete('/api/suppliers/sup-r2')
      .set('Authorization', `Bearer ${tokenA()}`)

    expect(res.status).toBe(404)
  })

  it('409 — supplier has pending purchase orders', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'sup-1' }], rowCount: 1 })   // assertOwns
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'po-1' }], rowCount: 1 })    // pending POs → 1 found

    const res = await request(app)
      .delete('/api/suppliers/sup-1')
      .set('Authorization', `Bearer ${tokenA()}`)

    expect(res.status).toBe(409)
  })
})

// ─────────────────────────────────────────────
// DELETE /purchase-orders/:id
// ─────────────────────────────────────────────

describe('DELETE /purchase-orders/:id', () => {
  it('204 — cancels a draft purchase order', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'po-1' }], rowCount: 1 })            // assertOwns
    mockPool.query.mockResolvedValueOnce({ rows: [{ status: 'draft' }], rowCount: 1 })        // status fetch
    mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 })                            // UPDATE cancel

    const res = await request(app)
      .delete('/api/purchase-orders/po-1')
      .set('Authorization', `Bearer ${tokenA()}`)

    expect(res.status).toBe(204)
  })

  it('404 — cross-tenant purchase order', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 })

    const res = await request(app)
      .delete('/api/purchase-orders/po-r2')
      .set('Authorization', `Bearer ${tokenA()}`)

    expect(res.status).toBe(404)
  })

  it('409 — cannot cancel a received purchase order', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'po-1' }], rowCount: 1 })
    mockPool.query.mockResolvedValueOnce({ rows: [{ status: 'received' }], rowCount: 1 })

    const res = await request(app)
      .delete('/api/purchase-orders/po-1')
      .set('Authorization', `Bearer ${tokenA()}`)

    expect(res.status).toBe(409)
  })

  it('204 — can cancel an ordered purchase order', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'po-1' }], rowCount: 1 })
    mockPool.query.mockResolvedValueOnce({ rows: [{ status: 'ordered' }], rowCount: 1 })
    mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 })

    const res = await request(app)
      .delete('/api/purchase-orders/po-1')
      .set('Authorization', `Bearer ${tokenA()}`)

    expect(res.status).toBe(204)
  })
})
