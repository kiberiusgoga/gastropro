import apiClient from '../lib/apiClient';
import { Order, OrderItem } from '../types';

// ─── Order fetcher ─────────────────────────────────────────────────────────────

const fetchKitchenOrders = async (): Promise<Order[]> => {
  const response = await apiClient.get('/orders');
  return response.data
    .filter((row: any) => row.status === 'open')
    .map((row: any) => {
      const items: OrderItem[] = (row.items || []).map((i: any) => ({
        id: i.id,
        restaurantId: row.restaurant_id,
        orderId: row.id,
        productId: i.menu_item_id,
        name: i.name,
        quantity: i.quantity,
        price: Number(i.price),
        status: i.status,
        preparationStation: i.preparation_station,
        isBundle: i.is_bundle,
        note: i.note,
      }));
      return {
        id: row.id,
        restaurantId: row.restaurant_id,
        tableId: row.table_id,
        userId: row.user_id,
        shiftId: row.shift_id,
        orderType: row.order_type,
        status: row.status,
        priority: row.priority || 'normal',
        guestCount: row.guest_count,
        totalAmount: Number(row.total_amount),
        subtotal: Number(row.subtotal),
        discountAmount: Number(row.discount_amount || 0),
        createdAt: row.created_at,
        items,
      } as Order;
    })
    .filter((o: Order) =>
      o.items.some(i => ['pending', 'preparing', 'ready'].includes(i.status))
    );
};

// ─── KDS Service ───────────────────────────────────────────────────────────────

export const kdsService = {
  subscribeToKitchenOrders: (callback: (orders: Order[]) => void) => {
    let evtSource: EventSource | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let destroyed = false;

    const refresh = async () => {
      if (destroyed) return;
      try {
        const orders = await fetchKitchenOrders();
        if (!destroyed) callback(orders);
      } catch (err) {
        console.error('[KDS] Fetch error', err);
      }
    };

    const startPollingFallback = () => {
      if (pollInterval) return;
      console.warn('[KDS] SSE unavailable — falling back to 10s polling');
      pollInterval = setInterval(refresh, 10000);
    };

    const connectSSE = () => {
      if (destroyed) return;
      const token = localStorage.getItem('gastropro_token');
      if (!token) { startPollingFallback(); return; }

      evtSource = new EventSource(`/api/events?token=${encodeURIComponent(token)}`);

      evtSource.addEventListener('orders_updated', () => refresh());

      evtSource.onopen = () => {
        // Clear polling fallback if SSE reconnected
        if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
      };

      evtSource.onerror = () => {
        evtSource?.close();
        evtSource = null;
        if (!destroyed) {
          startPollingFallback();
          // Attempt SSE reconnect after 5s
          setTimeout(connectSSE, 5000);
        }
      };
    };

    // Initial data load + SSE connection
    refresh();
    connectSSE();

    return () => {
      destroyed = true;
      evtSource?.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  },

  // ─── Item & order actions ──────────────────────────────────────────────────

  startPreparing: async (orderId: string, itemId: string) => {
    await apiClient.put(`/orders/${orderId}/items/${itemId}`, { status: 'preparing' });
  },

  markItemReady: async (orderId: string, itemId: string) => {
    await apiClient.put(`/orders/${orderId}/items/${itemId}`, { status: 'ready' });
  },
};
