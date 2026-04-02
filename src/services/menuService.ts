import apiClient from '../lib/apiClient';
import { MenuItem, MenuCategory } from '../types';

// Helper functions to map snake_case to camelCase
const mapCategory = (row: any): MenuCategory => ({
  id: row.id,
  restaurantId: row.restaurant_id,
  name: row.name,
  sortOrder: row.sort_order,
  active: row.active
});

const mapMenuItem = (row: any): MenuItem => ({
  id: row.id,
  restaurantId: row.restaurant_id,
  name: row.name,
  description: row.description,
  price: Number(row.price),
  menuCategoryId: row.menu_category_id,
  bundleId: row.bundle_id,
  imageUrl: row.image_url,
  active: row.active,
  preparationStation: row.preparation_station
});

// Helper functions to map camelCase back to snake_case for payloads
const toCategoryPayload = (data: Partial<MenuCategory>) => ({
  name: data.name,
  sort_order: data.sortOrder,
  active: data.active !== false
});

const toMenuItemPayload = (data: Partial<MenuItem>) => ({
  name: data.name,
  description: data.description,
  price: data.price,
  menu_category_id: data.menuCategoryId,
  bundle_id: data.bundleId,
  image_url: data.imageUrl,
  active: data.active !== false,
  available: true,
  preparation_station: data.preparationStation
});

export const menuService = {
  // Categories
  getCategories: async (restaurantId?: string): Promise<MenuCategory[]> => {
    try {
      const response = await apiClient.get('/menu-categories');
      return response.data.map(mapCategory);
    } catch (error) {
      console.error('Error fetching categories', error);
      return [];
    }
  },

  getAllCategories: async (restaurantId?: string): Promise<MenuCategory[]> => {
    return menuService.getCategories();
  },

  createCategory: async (data: Partial<MenuCategory>) => {
    try {
      const payload = toCategoryPayload(data);
      const response = await apiClient.post('/menu-categories', payload);
      return mapCategory(response.data);
    } catch (error) {
      console.error('Error creating category', error);
      throw error;
    }
  },

  // Items
  getItems: async (restaurantId?: string): Promise<MenuItem[]> => {
    try {
      const response = await apiClient.get('/menu-items');
      return response.data.map(mapMenuItem);
    } catch (error) {
      console.error('Error fetching menu items', error);
      return [];
    }
  },

  getAllItems: async (restaurantId?: string): Promise<MenuItem[]> => {
    return menuService.getItems();
  },

  createItem: async (data: Partial<MenuItem>) => {
    try {
      const payload = toMenuItemPayload(data);
      const response = await apiClient.post('/menu-items', payload);
      return mapMenuItem(response.data);
    } catch (error) {
      console.error('Error creating menu item', error);
      throw error;
    }
  },

  updateItem: async (id: string, data: Partial<MenuItem>) => {
    try {
      const payload = toMenuItemPayload(data);
      const response = await apiClient.put(`/menu-items/${id}`, payload);
      return mapMenuItem(response.data);
    } catch (error) {
      console.error('Error updating menu item', error);
      throw error;
    }
  },

  deleteItem: async (id: string) => {
    try {
      await apiClient.delete(`/menu-items/${id}`);
    } catch (error) {
      console.error('Error deleting menu item', error);
      throw error;
    }
  }
};
