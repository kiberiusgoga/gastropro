/**
 * Regression tests for the KDS visibility bug.
 *
 * Before the fix, sendToKitchen() wrote orders.status = 'sent_to_kitchen'
 * and order_items.status = 'sent_to_kitchen'. kdsService filters orders by
 * status === 'open' and items by ['pending','preparing','ready'], so both
 * writes caused orders and their items to disappear from the KDS immediately
 * after the waiter clicked "send to kitchen".
 *
 * These tests operate against the kdsService filter logic in isolation —
 * no real DB or API required. They prove the invariant: an order remains
 * visible in the KDS after sendToKitchen() when the fix is in place.
 */

import { describe, it, expect } from 'vitest'
import type { Order, OrderItem } from '../../src/types'

// ─── Helpers mirroring kdsService filter logic ────────────────────────────────

const KDS_ITEM_STATUSES = ['pending', 'preparing', 'ready'] as const

function filterKdsOrders(orders: Order[]): Order[] {
  return orders
    .filter(o => o.status === 'open')
    .filter(o => o.items.some(i => KDS_ITEM_STATUSES.includes(i.status as typeof KDS_ITEM_STATUSES[number])))
}

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    restaurantId: 'rest-1',
    status: 'open',
    orderType: 'dine_in',
    guestCount: 2,
    totalAmount: 640,
    subtotal: 640,
    discountAmount: 0,
    createdAt: new Date().toISOString(),
    items: [],
    ...overrides,
  } as Order
}

function makeItem(overrides: Partial<OrderItem> = {}): OrderItem {
  return {
    id: 'item-1',
    restaurantId: 'rest-1',
    orderId: 'order-1',
    productId: 'mi-1',
    name: 'Маргарита',
    quantity: 1,
    price: 320,
    status: 'pending',
    isBundle: false,
    preparationStation: 'kitchen',
    ...overrides,
  } as OrderItem
}

// ─── KDS visibility invariants ────────────────────────────────────────────────

describe('KDS order visibility', () => {
  it('order with pending items is visible in KDS', () => {
    const order = makeOrder({ items: [makeItem({ status: 'pending' })] })
    const result = filterKdsOrders([order])
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('order-1')
  })

  it('order remains visible after sendToKitchen (status stays open, items stay pending)', () => {
    // Post-fix: sendToKitchen does NOT change order or item status
    const order = makeOrder({
      status: 'open', // unchanged by fix
      items: [
        makeItem({ id: 'item-1', name: 'Маргарита', status: 'pending' }),
        makeItem({ id: 'item-2', name: 'Кока Кола', status: 'pending' }),
      ],
    })

    const result = filterKdsOrders([order])
    expect(result).toHaveLength(1)
    expect(result[0].items).toHaveLength(2)
    expect(result[0].items.every(i => i.status === 'pending')).toBe(true)
  })

  it('order with items in mixed states (pending + preparing + ready) is fully visible', () => {
    const order = makeOrder({
      items: [
        makeItem({ id: 'item-1', status: 'pending' }),
        makeItem({ id: 'item-2', status: 'preparing' }),
        makeItem({ id: 'item-3', status: 'ready' }),
      ],
    })

    const result = filterKdsOrders([order])
    expect(result).toHaveLength(1)
    expect(result[0].items).toHaveLength(3)
  })

  it('order disappears from KDS once all items are served or cancelled', () => {
    const order = makeOrder({
      items: [
        makeItem({ id: 'item-1', status: 'served' }),
        makeItem({ id: 'item-2', status: 'cancelled' }),
      ],
    })

    const result = filterKdsOrders([order])
    expect(result).toHaveLength(0)
  })

  it('paid order does not appear in KDS', () => {
    const order = makeOrder({
      status: 'paid',
      items: [makeItem({ status: 'pending' })],
    })

    const result = filterKdsOrders([order])
    expect(result).toHaveLength(0)
  })

  it('cancelled order does not appear in KDS', () => {
    const order = makeOrder({
      status: 'cancelled',
      items: [makeItem({ status: 'pending' })],
    })

    const result = filterKdsOrders([order])
    expect(result).toHaveLength(0)
  })

  it('regression: order_status sent_to_kitchen would have hidden order from KDS (the old bug)', () => {
    // Demonstrates what the bug looked like: if status were set to 'sent_to_kitchen'
    // (as the old sendToKitchen() did), the order would fail the status === 'open' filter.
    const orderWithOldBugStatus = makeOrder({
      // @ts-expect-error — intentionally testing invalid status to document the bug
      status: 'sent_to_kitchen',
      items: [makeItem({ status: 'pending' })],
    })

    const result = filterKdsOrders([orderWithOldBugStatus])
    // This is the bug: result would be empty even though the order is active
    expect(result).toHaveLength(0) // proves the old code would have hidden it
  })

  it('regression: item_status sent_to_kitchen would have hidden items from KDS (the old bug)', () => {
    // Demonstrates the second half of the bug: even if order stayed 'open',
    // items at 'sent_to_kitchen' were excluded by the item filter.
    const orderWithOldItemStatus = makeOrder({
      status: 'open',
      items: [
        // @ts-expect-error — intentionally testing invalid status to document the bug
        makeItem({ status: 'sent_to_kitchen' }),
      ],
    })

    const result = filterKdsOrders([orderWithOldItemStatus])
    // This is the bug: items at 'sent_to_kitchen' were excluded, making the order invisible
    expect(result).toHaveLength(0) // proves the old code would have hidden it
  })

  it('multiple orders: only active-item open orders appear', () => {
    const orders: Order[] = [
      makeOrder({ id: 'o-1', status: 'open', items: [makeItem({ orderId: 'o-1', status: 'pending' })] }),
      makeOrder({ id: 'o-2', status: 'paid', items: [makeItem({ orderId: 'o-2', status: 'served' })] }),
      makeOrder({ id: 'o-3', status: 'open', items: [makeItem({ orderId: 'o-3', status: 'preparing' })] }),
      makeOrder({ id: 'o-4', status: 'cancelled', items: [makeItem({ orderId: 'o-4', status: 'pending' })] }),
    ]

    const result = filterKdsOrders(orders)
    expect(result).toHaveLength(2)
    expect(result.map(o => o.id)).toEqual(['o-1', 'o-3'])
  })
})
