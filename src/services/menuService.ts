import apiClient from '../lib/apiClient';
import { MenuItem, MenuCategory } from '../types';

// Helper functions to map snake_case to camelCase
const mapCategory = (row: any): MenuCategory => ({
  id: row.id,
  restaurantId: row.restaurant_id,
  name: row.name,
  sortOrder: row.sort_order ?? 0,
  active: row.active,
  type: row.type ?? 'system',
  icon: row.icon ?? undefined,
  color: row.color ?? undefined,
  itemCount: row.item_count !== undefined ? Number(row.item_count) : undefined,
  nameTranslations: row.name_translations ?? undefined,
});

const mapMenuItem = (row: any): MenuItem => ({
  id: row.id,
  restaurantId: row.restaurant_id,
  name: row.name,
  description: row.description,
  price: Number(row.price),
  displayedPrice: row.displayed_price !== undefined ? Number(row.displayed_price) : undefined,
  menuCategoryId: row.menu_category_id,
  categoryIds: Array.isArray(row.category_ids) ? row.category_ids : [],
  categoryName: row.category_name,
  bundleId: row.bundle_id,
  imageUrl: row.image_url,
  active: row.active,
  available: row.available !== false,
  preparationStation: row.preparation_station,
  vatRate: row.vat_rate !== undefined ? Number(row.vat_rate) : undefined,
});

// Helper functions to map camelCase back to snake_case for payloads
const toCategoryPayload = (data: Partial<MenuCategory>) => ({
  name: data.name,
  sort_order: data.sortOrder,
  active: data.active !== false,
  icon: data.icon,
  color: data.color,
  name_translations: data.nameTranslations,
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
  preparation_station: data.preparationStation,
  vat_rate: data.vatRate,
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

  updateCategory: async (id: string, data: Partial<MenuCategory>) => {
    try {
      const payload = toCategoryPayload(data);
      const response = await apiClient.put(`/menu-categories/${id}`, payload);
      return mapCategory(response.data);
    } catch (error) {
      console.error('Error updating category', error);
      throw error;
    }
  },

  deleteCategory: async (id: string) => {
    await apiClient.delete(`/menu-categories/${id}`);
  },

  reorderCategories: async (order: Array<{ id: string; sort_order: number }>) => {
    await apiClient.patch('/menu-categories/reorder', { order });
  },

  // Item ↔ Category assignments (junction table)
  getItemCategories: async (itemId: string): Promise<Array<{ category_id: string; price_override: number | null }>> => {
    const res = await apiClient.get(`/menu-items/${itemId}/categories`);
    return Array.isArray(res.data) ? res.data : [];
  },

  assignItemCategory: async (itemId: string, categoryId: string, priceOverride: number | null): Promise<void> => {
    await apiClient.post(`/menu-items/${itemId}/categories`, {
      category_id: categoryId,
      price_override: priceOverride,
    });
  },

  removeItemCategory: async (itemId: string, categoryId: string): Promise<void> => {
    await apiClient.delete(`/menu-items/${itemId}/categories/${categoryId}`);
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
  },

  uploadImage: async (id: string, file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('image', file);
    const res = await apiClient.post(`/menu-items/${id}/image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.image_url as string;
  },

  deleteImage: async (id: string): Promise<void> => {
    await apiClient.delete(`/menu-items/${id}/image`);
  },
};
