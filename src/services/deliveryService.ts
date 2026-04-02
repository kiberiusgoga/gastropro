import apiClient from '../lib/apiClient';
import { Driver, Order } from '../types';

export const deliveryService = {
  // Driver management
  getDrivers: async (): Promise<Driver[]> => {
    try {
      const response = await apiClient.get('/drivers');
      return response.data.map((row: any) => ({
        id: row.id,
        restaurantId: row.restaurant_id,
        name: row.name,
        phone: row.phone,
        status: row.status,
        currentOrderId: row.current_order_id,
        active: row.active
      })) as Driver[];
    } catch (error) {
      console.error(error);
      return [];
    }
  },

  createDriver: async (data: Omit<Driver, 'id' | 'restaurantId'>): Promise<Driver> => {
    try {
      const response = await apiClient.post('/drivers', {
        name: data.name,
        phone: data.phone
      });
      const row = response.data;
      return {
        id: row.id,
        restaurantId: row.restaurant_id,
        name: row.name,
        phone: row.phone,
        status: row.status,
        currentOrderId: row.current_order_id,
        active: row.active
      } as Driver;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  updateDriver: async (id: string, data: Partial<Driver>): Promise<void> => {
    try {
      await apiClient.put(`/drivers/${id}`, {
        status: data.status,
        current_order_id: data.currentOrderId,
        active: data.active
      });
    } catch (error) {
      console.error(error);
    }
  },

  // Delivery order management
  getDeliveryOrders: async (): Promise<Order[]> => {
    try {
      // In a real scenario we'd query /orders?type=delivery
      const response = await apiClient.get('/orders');
      if (!response.data) return [];
      
      // Filter out only delivery orders
      const orders = response.data.map((row: any) => ({
        id: row.id,
        orderType: row.order_type,
        status: row.status,
        deliveryStatus: row.deliveryStatus, // Assume API maps this or we infer
        driverId: row.driver_id,
        totalAmount: row.total_amount,
        createdAt: row.created_at,
        deliveryAddress: row.deliveryAddress || '',
        deliveryPhone: row.deliveryPhone || '',
        deliveryFee: row.deliveryFee || 0
      })) as Order[];
      return orders.filter(o => o.orderType === 'delivery');
    } catch (error) {
      console.error(error);
      return [];
    }
  },

  assignDriver: async (orderId: string, driverId: string): Promise<void> => {
    try {
      // 1. Create delivery record
      await apiClient.post('/deliveries', {
        order_id: orderId,
        address: 'N/A', // Normally get from order
        phone: 'N/A',
        fee: 0,
        estimated_time: new Date(Date.now() + 30 * 60000).toISOString()
      });

      // 2. Update order status
      await apiClient.put(`/orders/${orderId}`, {
        deliveryStatus: 'out_for_delivery',
        driver_id: driverId
      });

      // 3. Update driver status
      await apiClient.put(`/drivers/${driverId}`, {
        status: 'busy',
        current_order_id: orderId
      });
    } catch (error) {
      console.error('Error assigning driver', error);
    }
  },

  updateDeliveryStatus: async (orderId: string, status: Order['deliveryStatus']): Promise<void> => {
    try {
      // 1. Update Order
      await apiClient.put(`/orders/${orderId}`, {
        deliveryStatus: status,
        status: status === 'delivered' ? 'paid' : status
      });

      // 2. Fetch driver to reset if delivered
      if (status === 'delivered') {
        const drivers = await deliveryService.getDrivers();
        const driver = drivers.find(d => d.currentOrderId === orderId);
        if (driver) {
          await apiClient.put(`/drivers/${driver.id}`, {
            status: 'available',
            current_order_id: null
          });
        }
      }

      // 3. We might also want to update the delivery record, assuming an endpoint exists or backend triggers it
    } catch (error) {
      console.error('Error updating delivery status', error);
    }
  }
};
