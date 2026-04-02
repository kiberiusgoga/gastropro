import apiClient from '../lib/apiClient';
import { Customer } from '../types';

export const crmService = {
  getAll: async (restaurantId?: string): Promise<Customer[]> => {
    try {
      const response = await apiClient.get('/customers');
      return response.data.map((row: any) => ({
        id: row.id,
        restaurantId: row.restaurant_id,
        name: row.name,
        phone: row.phone,
        email: row.email,
        notes: row.notes,
        totalSpent: Number(row.total_spent || 0),
        orderHistory: [], // Postgres currently stores orders_count, actual history is from orders table
        createdAt: row.created_at
      })) as Customer[];
    } catch (error) {
      console.error(error);
      return [];
    }
  },

  create: async (data: Partial<Customer> & { restaurantId?: string }): Promise<Customer | null> => {
    try {
      const response = await apiClient.post('/customers', {
        name: data.name,
        phone: data.phone,
        email: data.email,
        notes: data.notes
      });
      const row = response.data;
      return {
        id: row.id,
        restaurantId: row.restaurant_id,
        name: row.name,
        phone: row.phone,
        email: row.email,
        notes: row.notes,
        totalSpent: Number(row.total_spent || 0),
        orderHistory: [],
        createdAt: row.created_at
      } as Customer;
    } catch (error) {
      console.error(error);
      return null;
    }
  },

  update: async (id: string, data: Partial<Customer>): Promise<void> => {
    try {
      await apiClient.put(`/customers/${id}`, {
        name: data.name,
        phone: data.phone,
        email: data.email,
        notes: data.notes
      });
    } catch (error) {
      console.error(error);
    }
  },

  addOrderToHistory: async (customerId: string, orderId: string, amount: number): Promise<void> => {
    try {
      // Fetch current stats to increment 
      // (a robust backend would do `total_spent = total_spent + $1`, but here we can just do this if necessary)
      // Since order history is just a link in Postgres, we don't strictly need to do this from frontend anymore 
      // if the SQL queries `orders` table. 
      // However, if we maintain `total_spent` cache in customers table:
      const allCustomers = await crmService.getAll();
      const customer = allCustomers.find(c => c.id === customerId);
      if (customer) {
        await apiClient.put(`/customers/${customerId}`, {
          total_spent: customer.totalSpent + amount,
          // orderHistory needs to be managed separately or calculated dynamically
        });
      }
    } catch (error) {
      console.error(error);
    }
  }
};
