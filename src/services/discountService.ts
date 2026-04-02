import apiClient from '../lib/apiClient';
import { Discount } from '../types';

export const discountService = {
  getAll: async (): Promise<Discount[]> => {
    try {
      const response = await apiClient.get('/discounts');
      return response.data.map((row: any) => ({
        id: row.id,
        name: row.name,
        type: row.type,
        value: row.value,
        requiresManagerApproval: row.requires_manager_approval,
        active: row.active
      })) as Discount[];
    } catch (error) {
      console.error(error);
      return [];
    }
  },

  create: async (data: Omit<Discount, 'id'>): Promise<Discount | null> => {
    try {
      const response = await apiClient.post('/discounts', {
        name: data.name,
        type: data.type,
        value: data.value,
        requires_manager_approval: data.requiresManagerApproval
      });
      const row = response.data;
      return {
        id: row.id,
        name: row.name,
        type: row.type,
        value: row.value,
        requiresManagerApproval: row.requires_manager_approval,
        active: row.active
      } as Discount;
    } catch (error) {
      console.error(error);
      return null;
    }
  },

  update: async (id: string, data: Partial<Discount>): Promise<void> => {
    try {
      await apiClient.put(`/discounts/${id}`, {
        active: data.active
      });
    } catch (error) {
      console.error(error);
    }
  }
};
