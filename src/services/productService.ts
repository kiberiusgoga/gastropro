import apiClient from '../lib/apiClient';
import { Product, Category } from '../types';

const mapProduct = (row: any): Product => ({
  id: row.id,
  restaurantId: row.restaurant_id,
  name: row.name,
  barcode: row.barcode,
  unit: row.unit,
  purchasePrice: Number(row.purchase_price),
  sellingPrice: Number(row.selling_price),
  categoryId: row.category_id,
  preparationStation: row.preparation_station,
  currentStock: Number(row.current_stock || 0),
  minStock: Number(row.min_stock || 0),
  active: row.active,
  defaultExpiryDays: row.default_expiry_days != null ? Number(row.default_expiry_days) : null,
});

const toProductPayload = (data: Partial<Product>) => ({
  name: data.name,
  barcode: data.barcode,
  unit: data.unit,
  purchase_price: data.purchasePrice,
  selling_price: data.sellingPrice,
  category_id: data.categoryId,
  min_stock: data.minStock,
  active: data.active !== false,
  preparation_station: data.preparationStation,
  default_expiry_days: data.defaultExpiryDays,
  current_stock: data.currentStock,
});

export const productService = {
  getAll: async (restaurantId?: string): Promise<Product[]> => {
    try {
      const response = await apiClient.get('/products');
      return response.data.map(mapProduct);
    } catch (error) {
      console.error('Error fetching products', error);
      return [];
    }
  },
  
  create: async (data: Partial<Product> & { restaurantId?: string }) => {
    try {
      const payload = toProductPayload(data);
      const response = await apiClient.post('/products', payload);
      return mapProduct(response.data);
    } catch (error) {
      console.error('Error creating product', error);
      throw error;
    }
  },
  
  update: async (id: string, data: Partial<Product>) => {
    try {
      const payload = toProductPayload(data);
      await apiClient.put(`/products/${id}`, payload);
    } catch (error) {
      console.error('Error updating product', error);
      throw error;
    }
  },
  
  delete: async (id: string) => {
    try {
      await apiClient.delete(`/products/${id}`);
    } catch (error) {
      console.error('Error deleting product', error);
      throw error;
    }
  }
};

const mapCategory = (row: any): Category => ({
  id: row.id,
  restaurantId: row.restaurant_id,
  name: row.name,
  active: row.active
});

export const categoryService = {
  getAll: async (restaurantId?: string): Promise<Category[]> => {
    try {
      const response = await apiClient.get('/categories');
      return response.data.map(mapCategory);
    } catch (error) {
      console.error('Error fetching categories', error);
      return [];
    }
  },
  
  create: async (data: Partial<Category> & { restaurantId?: string }) => {
    try {
      const payload = { name: data.name };
      const response = await apiClient.post('/categories', payload);
      return mapCategory(response.data);
    } catch (error) {
      console.error('Error creating category', error);
      throw error;
    }
  },
  
  update: async (id: string, data: Partial<Category>) => {
    try {
      const payload = { name: data.name };
      await apiClient.put(`/categories/${id}`, payload);
    } catch (error) {
      console.error('Error updating category', error);
      throw error;
    }
  },
  
  delete: async (id: string) => {
    try {
      await apiClient.delete(`/categories/${id}`);
    } catch (error) {
      console.error('Error deleting category', error);
      throw error;
    }
  }
};
