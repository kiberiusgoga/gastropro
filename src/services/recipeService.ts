import apiClient from '../lib/apiClient';

export interface RecipeIngredient {
  id: string;
  inventory_item_id: string;
  ingredient_name: string;
  quantity: number;
  recipe_unit: string;
  current_stock: number;
  inventory_unit: string;
}

export interface StockCheckItem {
  ingredient_name: string;
  required: number;
  available: number;
  unit: string;
  sufficient: boolean;
}

export interface InventoryProduct {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
}

export const recipeService = {
  getRecipe: async (menuItemId: string): Promise<RecipeIngredient[]> => {
    const res = await apiClient.get(`/menu-items/${menuItemId}/recipe`);
    return Array.isArray(res.data) ? res.data : [];
  },

  addIngredient: async (
    menuItemId: string,
    data: { inventory_item_id: string; quantity: number; recipe_unit: string },
  ): Promise<RecipeIngredient> => {
    const res = await apiClient.post(`/menu-items/${menuItemId}/recipe`, data);
    return res.data;
  },

  updateIngredient: async (
    menuItemId: string,
    rid: string,
    data: { quantity?: number; recipe_unit?: string },
  ): Promise<RecipeIngredient> => {
    const res = await apiClient.put(`/menu-items/${menuItemId}/recipe/${rid}`, data);
    return res.data;
  },

  deleteIngredient: async (menuItemId: string, rid: string): Promise<void> => {
    await apiClient.delete(`/menu-items/${menuItemId}/recipe/${rid}`);
  },

  checkStock: async (menuItemId: string, portions = 1): Promise<StockCheckItem[]> => {
    const res = await apiClient.get(`/menu-items/${menuItemId}/recipe/stock-check?portions=${portions}`);
    return res.data;
  },

  getInventoryProducts: async (): Promise<InventoryProduct[]> => {
    const res = await apiClient.get('/products');
    const rows = Array.isArray(res.data) ? res.data : [];
    return rows.map((p: any) => ({
      id: p.id,
      name: p.name,
      unit: p.unit,
      current_stock: Number(p.current_stock ?? 0),
    }));
  },
};
