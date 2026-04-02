import apiClient from '../lib/apiClient';
import { Transaction, Invoice, InventoryCheck, Bundle, DashboardStats } from '../types';

export const inventoryService = {
  recordMovement: async (data: Omit<Transaction, 'id' | 'date'> & { restaurantId?: string }) => {
    try {
      const response = await apiClient.post('/inventory/movement', {
        product_id: data.productId,
        type: data.type,
        quantity: data.quantity,
        note: data.note
      });
      return response.data;
    } catch (error) {
      console.error('Error recording movement:', error);
      throw error;
    }
  },

  getTransactions: async (restaurantId?: string): Promise<Transaction[]> => {
    try {
      const response = await apiClient.get('/transactions');
      return response.data.map((row: any) => ({
        id: row.id,
        restaurantId: row.restaurant_id,
        productId: row.product_id,
        type: row.type,
        quantity: Number(row.quantity),
        previousStock: Number(row.previous_stock),
        newStock: Number(row.new_stock),
        date: row.date,
        userId: row.user_id,
        referenceId: row.reference_id,
        note: row.note,
        productName: row.product_name,
        userName: row.user_name
      })) as Transaction[];
    } catch (error) {
      console.error('Error fetching transactions:', error);
      return [];
    }
  },
};

export const inventoryCheckService = {
  getAll: async (restaurantId?: string): Promise<InventoryCheck[]> => {
    try {
      const response = await apiClient.get('/inventory-checks');
      return response.data.map((row: any) => ({
        id: row.id,
        restaurantId: row.restaurant_id,
        date: row.date,
        status: row.status,
        items: [] // Items are stored in inventory_check_items table, fetched separately if needed
      })) as InventoryCheck[];
    } catch (error) {
      console.error('Error fetching inventory checks:', error);
      return [];
    }
  },

  create: async (data: Omit<InventoryCheck, 'id' | 'date'> & { restaurantId?: string }) => {
    try {
      const response = await apiClient.post('/inventory-checks', {
        items: data.items.map(item => ({
          productId: item.productId,
          systemQty: item.systemQty,
          realQty: item.realQty
        }))
      });
      return response.data;
    } catch (error) {
      console.error('Error creating inventory check:', error);
      throw error;
    }
  },
};

export const invoiceService = {
  create: async (data: { invoiceNumber: string; supplierName: string; items: { productId: string; quantity: number; price: number }[]; restaurantId?: string }) => {
    try {
      const response = await apiClient.post('/invoices', {
        invoice_number: data.invoiceNumber,
        supplier_name: data.supplierName,
        date: new Date().toISOString().split('T')[0],
        items: data.items.map(item => ({
          product_id: item.productId,
          quantity: item.quantity,
          price: item.price
        }))
      });
      return response.data;
    } catch (error) {
      console.error('Error creating invoice:', error);
      throw error;
    }
  },

  getAll: async (restaurantId?: string): Promise<Invoice[]> => {
    try {
      // The API doesn't have a dedicated GET /invoices route yet, 
      // but we can add one or use the existing structure.
      // For now, return empty — invoices are created via POST /invoices and 
      // their history is tracked in the transactions table.
      const response = await apiClient.get('/invoices');
      return response.data.map((row: any) => ({
        id: row.id,
        restaurantId: row.restaurant_id,
        invoiceNumber: row.invoice_number,
        supplierName: row.supplier_name,
        date: row.date,
        totalAmount: Number(row.total_amount),
        status: row.status,
        userId: row.user_id
      })) as Invoice[];
    } catch (error) {
      console.error('Error fetching invoices:', error);
      return [];
    }
  },
};

export const bundleService = {
  getAll: async (restaurantId?: string): Promise<Bundle[]> => {
    try {
      const response = await apiClient.get('/bundles');
      return response.data.map((row: any) => ({
        id: row.id,
        restaurantId: row.restaurant_id,
        name: row.name,
        sellingPrice: Number(row.selling_price),
        active: row.active,
        items: row.items?.map((item: any) => ({
          id: item.id,
          productId: item.product_id,
          quantity: Number(item.quantity),
          productName: item.product_name,
          unit: item.unit
        })) || []
      })) as Bundle[];
    } catch (error) {
      console.error('Error fetching bundles:', error);
      return [];
    }
  },

  create: async (data: { name: string; sellingPrice: number; items: { productId: string; quantity: number }[]; restaurantId?: string }) => {
    try {
      const response = await apiClient.post('/bundles', {
        name: data.name,
        sellingPrice: data.sellingPrice,
        items: data.items
      });
      return response.data;
    } catch (error) {
      console.error('Error creating bundle:', error);
      throw error;
    }
  },

  update: async (id: string, data: { name?: string; sellingPrice?: number; active?: boolean; items?: { productId: string; quantity: number }[] }) => {
    try {
      await apiClient.put(`/bundles/${id}`, {
        name: data.name,
        sellingPrice: data.sellingPrice,
        active: data.active,
        items: data.items || []
      });
    } catch (error) {
      console.error('Error updating bundle:', error);
      throw error;
    }
  },

  delete: async (id: string) => {
    try {
      await apiClient.delete(`/bundles/${id}`);
    } catch (error) {
      console.error('Error deleting bundle:', error);
      throw error;
    }
  },

  getBundleItems: async (bundleId: string): Promise<{ productId: string; quantity: number }[]> => {
    try {
      // Bundle items are already included in the GET /bundles response
      const bundles = await bundleService.getAll();
      const bundle = bundles.find((b: any) => b.id === bundleId);
      return (bundle as any)?.items || [];
    } catch (error) {
      console.error('Error fetching bundle items:', error);
      return [];
    }
  }
};

export const dashboardService = {
  getStats: async (restaurantId?: string): Promise<DashboardStats> => {
    try {
      const response = await apiClient.get('/dashboard/stats');
      const row = response.data;
      return {
        totalProducts: Number(row.total_products || 0),
        totalStockValue: Number(row.inventory_value || 0),
        lowStockCount: Number(row.low_stock_alerts || 0),
        dailyTransactions: Number(row.daily_transactions || 0),
        revenueByDay: [
          { name: 'Mon', value: 4000 },
          { name: 'Tue', value: 3000 },
          { name: 'Wed', value: 2000 },
          { name: 'Thu', value: 2780 },
          { name: 'Fri', value: 1890 },
          { name: 'Sat', value: 2390 },
          { name: 'Sun', value: 3490 },
        ],
        topSellingItems: [],
        categoryPerformance: []
      };
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      throw error;
    }
  },
};
