import apiClient from '../lib/apiClient';
import { Order, OrderItem } from '../types';
import { notificationService } from './notificationService';

// Mock WebSocket implementation
const emitWebSocketEvent = (event: string, data: Record<string, unknown>) => {
  console.log(`[WebSocket] Emitting ${event}:`, data);
  // In a real app, this would use socket.io or similar
  window.dispatchEvent(new CustomEvent(event, { detail: data }));
};

export const kdsService = {
  // Listen for active orders for the kitchen
  subscribeToKitchenOrders: (callback: (orders: Order[]) => void) => {
    
    const fetchOrders = async () => {
      try {
        const response = await apiClient.get('/orders');
        // Filter orders that are in kitchen states
        const activeStates = ['sent_to_kitchen', 'preparing', 'ready'];
        
        let kitchenOrders = response.data.filter((row: any) => activeStates.includes(row.status));
        
        kitchenOrders = kitchenOrders.map((row: any) => ({
          id: row.id,
          restaurantId: row.restaurant_id,
          tableId: row.table_id,
          userId: row.user_id,
          orderType: row.order_type,
          status: row.status,
          items: [] // In a real API, /orders should return items or we make another call
        }));

        // Fetch items for each order
        for (const order of kitchenOrders) {
          const itemsRes = await apiClient.get(`/orders/${order.id}/items`);
          order.items = itemsRes.data.map((i: any) => ({
            id: i.id,
            menuItemId: i.menu_item_id,
            name: i.name,
            quantity: i.quantity,
            price: i.price,
            status: i.status,
            preparationStation: i.preparation_station,
            note: i.note
          })) as OrderItem[];
        }

        callback(kitchenOrders);
      } catch (error) {
        console.error('Error fetching kitchen orders', error);
      }
    };

    fetchOrders();
    const interval = setInterval(fetchOrders, 10000); // Poll every 10 seconds
    return () => clearInterval(interval);
  },

  startPreparing: async (orderId: string) => {
    try {
      // We can update order status via API
      await apiClient.put(`/orders/${orderId}`, { 
        status: 'preparing'
      });

      // Update order items. Our backend might not have bulk item update, so we update the order 
      // and assume backend or frontend handles items if needed.
      // Wait, we do have PUT /orders/:id/items/:itemId from Phase 3. 
      const itemsRes = await apiClient.get(`/orders/${orderId}/items`);
      for (const item of itemsRes.data) {
        if (item.status === 'sent_to_kitchen') {
          await apiClient.put(`/orders/${orderId}/items/${item.id}`, { status: 'preparing' });
        }
      }

      emitWebSocketEvent('order:preparing', { orderId });
    } catch (error) {
      console.error(error);
    }
  },

  markAsReady: async (orderId: string) => {
    try {
      await apiClient.put(`/orders/${orderId}`, { 
        status: 'ready'
      });

      const itemsRes = await apiClient.get(`/orders/${orderId}/items`);
      for (const item of itemsRes.data) {
        if (item.status === 'preparing') {
          await apiClient.put(`/orders/${orderId}/items/${item.id}`, { status: 'ready' });
        }
      }

      // We should ideally fetch the order to get userId/tableId to construct a notification
      // Mocking notification for now:
      await notificationService.create({
        title: 'Нарачката е готова!',
        message: `Нарачката ${orderId.slice(-4)} е подготвена.`,
        type: 'success',
        category: 'new_order',
        link: `/pos/order/${orderId}`
      });

      emitWebSocketEvent('order:ready', { orderId });
    } catch (error) {
      console.error(error);
    }
  }
};
