import apiClient from '../lib/apiClient';
import { Table, Order, OrderItem, Payment } from '../types';
import { bundleService, inventoryService } from './inventoryService';
import { crmService } from './crmService';

export const tableService = {
  getAll: async (restaurantId?: string): Promise<Table[]> => {
    try {
      const response = await apiClient.get('/tables');
      return response.data;
    } catch (error) {
      console.error(error);
      return [];
    }
  },
  create: async (data: Partial<Table> & { restaurantId?: string }) => {
    try {
      const response = await apiClient.post('/tables', data);
      return response.data;
    } catch (error) {
      console.error(error);
    }
  },
  update: async (id: string, data: Partial<Table>) => {
    try {
      await apiClient.put(`/tables/${id}`, data);
    } catch (error) {
      console.error(error);
    }
  }
};

// Mappers for backend Order formats
const mapOrderItem = (row: any): OrderItem => ({
  id: row.id,
  restaurantId: row.restaurant_id,
  orderId: row.order_id,
  productId: row.menu_item_id,
  name: row.name,
  quantity: row.quantity,
  price: Number(row.price),
  status: row.status,
  preparationStation: row.preparation_station,
  isBundle: row.is_bundle,
  note: row.note
});

const mapOrder = (row: any): Order => ({
  id: row.id,
  restaurantId: row.restaurant_id,
  tableId: row.table_id,
  customerId: row.customer_id,
  userId: row.user_id,
  shiftId: row.shift_id,
  status: row.status,
  orderType: row.order_type,
  guestCount: row.guest_count,
  totalAmount: Number(row.total_amount || 0),
  subtotal: Number(row.subtotal || 0),
  discountAmount: Number(row.discount_amount || 0),
  createdAt: row.created_at,
  closedAt: row.closed_at,
  items: row.items ? row.items.map(mapOrderItem) : []
});

export const posService = {
  getOpenOrderForTable: async (tableId: string, restaurantId?: string): Promise<Order | null> => {
    try {
      const response = await apiClient.get('/orders?status=open');
      const orders = response.data.map(mapOrder);
      // Find order for table
      const order = orders.find((o: Order) => o.tableId === tableId);
      return order || null;
    } catch (error) {
      console.error(error);
      return null;
    }
  },

  createOrder: async (tableId: string | null, userId: string, restaurantId?: string, orderType: Order['orderType'] = 'dine_in', customerId?: string, shiftId?: string): Promise<Order | undefined> => {
    try {
      const payload = {
        table_id: tableId,
        customer_id: customerId,
        shift_id: shiftId,
        order_type: orderType,
        guest_count: 1
      };
      const response = await apiClient.post('/orders', payload);
      return mapOrder(response.data);
    } catch (error) {
      console.error(error);
    }
  },

  addItemToOrder: async (orderId: string, item: Omit<OrderItem, 'id'>) => {
    try {
      const payload = {
        menu_item_id: item.productId,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        preparation_station: item.preparationStation,
        note: item.note,
        is_bundle: item.isBundle
      };
      const response = await apiClient.post(`/orders/${orderId}/items`, payload);
      
      // The backend doesn't auto-update the order subtotal for individual adding
      // So we'll trigger an order update to fix subtotals on the server
      const orderResponse = await apiClient.get('/orders');
      const orders = orderResponse.data.map(mapOrder);
      const order = orders.find((o: Order) => o.id === orderId);
      if (order) {
         let subtotal = (order.subtotal || 0) + (item.price * item.quantity);
         await apiClient.put(`/orders/${orderId}`, { subtotal, total_amount: subtotal });
      }

      return mapOrderItem(response.data);
    } catch (error) {
      console.error(error);
    }
  },

  updateItemQuantity: async (orderId: string, itemId: string, newQuantity: number) => {
    try {
      await apiClient.put(`/orders/${orderId}/items/${itemId}`, { quantity: newQuantity });
      
      // Update order total
      const orderResponse = await apiClient.get('/orders');
      const orders = orderResponse.data.map(mapOrder);
      const order = orders.find((o: Order) => o.id === orderId);
      if (order) {
          // Recalculate
          const items = order.items;
          const subtotal = items.reduce((sum: number, i: OrderItem) => sum + (i.price * i.quantity), 0);
          await apiClient.put(`/orders/${orderId}`, { subtotal, total_amount: subtotal });
      }
    } catch (error) {
      console.error(error);
    }
  },

  updateOrderItemStatus: async (orderId: string, itemId: string, status: OrderItem['status']): Promise<{ deductionWarnings?: Array<{ ingredientName: string; inventoryUnit: string }> }> => {
    try {
      const res = await apiClient.put(`/orders/${orderId}/items/${itemId}`, { status });
      return res.data ?? {};
    } catch (error) {
      console.error(error);
      return {};
    }
  },

  sendToKitchen: async (orderId: string, restaurantId?: string) => {
    try {
      // Fetch order items for inventory deduction — order status stays 'open'
      const response = await apiClient.get('/orders');
      const orders = response.data.map(mapOrder);
      const order = orders.find((o: Order) => o.id === orderId);

      if (!order) throw new Error('Order not found');

      for (const item of order.items) {
        if (item.status === 'pending') {
          if (item.isBundle) {
            const ingredients = await bundleService.getBundleItems(item.productId);
            for (const ingredient of ingredients) {
              await inventoryService.recordMovement({
                productId: ingredient.productId,
                restaurantId: restaurantId || '',
                type: 'output',
                quantity: ingredient.quantity * item.quantity,
                previousStock: 0,
                newStock: 0,
                note: `Kitchen Order ${orderId} - ${item.name}`,
                userId: order.userId,
                referenceId: orderId
              });
            }
          } else {
            await inventoryService.recordMovement({
              productId: item.productId,
              restaurantId: restaurantId || '',
              type: 'output',
              quantity: item.quantity,
              previousStock: 0,
              newStock: 0,
              note: `Kitchen Order ${orderId} - ${item.name}`,
              userId: order.userId,
              referenceId: orderId
            });
          }
        }
      }

      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  },

  closeOrder: async (orderId: string, payments: Omit<Payment, 'id'>[], shiftId?: string) => {
    try {
      // We will map payments logic later in backend but for now just mark closed
      await apiClient.put(`/orders/${orderId}`, { status: 'paid' });
      
      // Update Customer history CRM integration
      const response = await apiClient.get('/orders');
      const orders = response.data.map(mapOrder);
      const order = orders.find((o: Order) => o.id === orderId);
      
      if (order && order.customerId) {
        await crmService.addOrderToHistory(order.customerId, orderId, order.totalAmount);
      }
      
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  },

  getAllOrders: async (restaurantId?: string): Promise<Order[]> => {
    try {
      const response = await apiClient.get('/orders');
      return response.data.map(mapOrder);
    } catch (error) {
      console.error(error);
      return [];
    }
  },

  updateOrder: async (orderId: string, data: Partial<Order>) => {
    try {
      await apiClient.put(`/orders/${orderId}`, data);
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  },

  updateOrderItem: async (orderId: string, itemId: string, data: Partial<OrderItem>) => {
    try {
      await apiClient.put(`/orders/${orderId}/items/${itemId}`, data);
      return true;
    } catch (error) {
       console.error(error);
       return false;
    }
  }
};
