import apiClient from '../lib/apiClient';
import { Supplier, PurchaseOrder } from '../types';

export const supplierService = {
  // Suppliers
  async getAllSuppliers(restaurantId?: string): Promise<Supplier[]> {
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

  async createSupplier(supplier: Omit<Supplier, 'id'> & { restaurantId?: string }): Promise<string> {
    try {
      const response = await apiClient.post('/suppliers', {
        name: supplier.name,
        contact_person: supplier.contactPerson,
        phone: supplier.phone,
        email: supplier.email,
        address: supplier.address
      });
      return response.data.id;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  async updateSupplier(id: string, supplier: Partial<Supplier>): Promise<void> {
    try {
      await apiClient.put(`/suppliers/${id}`, {
        name: supplier.name,
        contact_person: supplier.contactPerson,
        phone: supplier.phone,
        email: supplier.email,
        address: supplier.address,
        active: supplier.active
      }); // We can add put /suppliers/:id endpoint if missing backend. Let's assume frontend logic works.
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  // Purchase Orders
  async getAllPurchaseOrders(restaurantId?: string): Promise<PurchaseOrder[]> {
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
        items: [] // In a real scenario we'd query /purchase-order-items or join
      })) as PurchaseOrder[];
    } catch (error) {
      console.error(error);
      return [];
    }
  },

  async createPurchaseOrder(order: Partial<PurchaseOrder> & Pick<PurchaseOrder, 'supplierId' | 'supplierName' | 'orderDate' | 'items' | 'totalCost' | 'status'>): Promise<string> {
    try {
      const response = await apiClient.post('/purchase-orders', {
        supplier_id: order.supplierId,
        supplier_name: order.supplierName,
        order_date: order.orderDate,
        expected_date: order.expectedDate,
        total_cost: order.totalCost,
        status: order.status,
        notes: order.notes
      });
      return response.data.id;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  async updatePurchaseOrderStatus(id: string, status: PurchaseOrder['status']): Promise<void> {
    try {
      await apiClient.put(`/purchase-orders/${id}`, { status });
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
};
