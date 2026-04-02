import apiClient from '../lib/apiClient';
import { PurchaseOrder, Supplier } from '../types';

export const purchaseOrderService = {
  // Suppliers
  getSuppliers: async (): Promise<Supplier[]> => {
    try {
      const response = await apiClient.get('/suppliers');
      return response.data.map((row: any) => ({
        id: row.id,
        restaurantId: row.restaurant_id,
        name: row.name,
        contactPerson: row.contact_person,
        phone: row.phone,
        email: row.email,
        address: row.address,
        active: row.active
      })) as Supplier[];
    } catch (error) {
      console.error(error);
      return [];
    }
  },

  createSupplier: async (data: Omit<Supplier, 'id' | 'restaurantId'>): Promise<Supplier> => {
    try {
      const response = await apiClient.post('/suppliers', {
        name: data.name,
        contact_person: data.contactPerson,
        phone: data.phone,
        email: data.email,
        address: data.address
      });
      const row = response.data;
      return {
        id: row.id,
        restaurantId: row.restaurant_id,
        name: row.name,
        contactPerson: row.contact_person,
        phone: row.phone,
        email: row.email,
        address: row.address,
        active: row.active
      } as Supplier;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  updateSupplier: async (id: string, data: Partial<Supplier>): Promise<void> => {
    try {
      await apiClient.put(`/suppliers/${id}`, {
        active: data.active
      });
    } catch (error) {
      console.error(error);
    }
  },

  deleteSupplier: async (id: string): Promise<void> => {
    try {
      await apiClient.put(`/suppliers/${id}`, { active: false });
    } catch (error) {
      console.error(error);
    }
  },

  // Purchase Orders
  getPOs: async (): Promise<PurchaseOrder[]> => {
    try {
      const response = await apiClient.get('/purchase-orders');
      return response.data.map((row: any) => ({
        id: row.id,
        restaurantId: row.restaurant_id,
        supplierId: row.supplier_id,
        supplierName: row.supplier_name,
        orderDate: new Date(row.order_date).toISOString().split('T')[0],
        expectedDate: row.expected_date ? new Date(row.expected_date).toISOString().split('T')[0] : undefined,
        status: row.status,
        totalCost: Number(row.total_cost || 0),
        notes: row.notes,
        items: []
      })) as PurchaseOrder[];
    } catch (error) {
      console.error(error);
      return [];
    }
  },

  createPO: async (data: Omit<PurchaseOrder, 'id' | 'createdAt' | 'restaurantId'>): Promise<PurchaseOrder> => {
    try {
      const response = await apiClient.post('/purchase-orders', {
        supplier_id: data.supplierId,
        supplier_name: data.supplierName,
        order_date: data.orderDate,
        expected_date: data.expectedDate,
        total_cost: data.totalCost,
        status: data.status,
        notes: data.notes
      });
      const row = response.data;
      return {
        id: row.id,
        restaurantId: row.restaurant_id,
        supplierId: row.supplier_id,
        supplierName: row.supplier_name,
        orderDate: new Date(row.order_date).toISOString().split('T')[0],
        expectedDate: row.expected_date ? new Date(row.expected_date).toISOString().split('T')[0] : undefined,
        status: row.status,
        totalCost: Number(row.total_cost || 0),
        notes: row.notes,
        items: []
      } as PurchaseOrder;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  updatePO: async (id: string, data: Partial<PurchaseOrder>): Promise<void> => {
    try {
      await apiClient.put(`/purchase-orders/${id}`, {
        status: data.status
      });
    } catch (error) {
      console.error(error);
    }
  },

  deletePO: async (id: string): Promise<void> => {
    try {
      await apiClient.put(`/purchase-orders/${id}`, { status: 'cancelled' });
    } catch (error) {
      console.error(error);
    }
  }
};
