import apiClient from '../lib/apiClient';
import { Shift } from '../types';

export const shiftService = {
  openShift: async (userId: string, userName: string, startingCash: number, restaurantId?: string): Promise<Shift | null> => {
    try {
      const payload = { initial_cash: startingCash };
      const response = await apiClient.post('/shifts', payload);
      const row = response.data;
      return {
        id: row.id,
        userId: row.user_id,
        userName,
        startTime: row.start_time,
        startingCash: Number(row.initial_cash || 0),
        status: row.status,
        totalSales: 0,
        restaurantId: row.restaurant_id
      } as Shift;
    } catch (error) {
      console.error(error);
      return null;
    }
  },

  getActiveShift: async (userId: string, restaurantId?: string): Promise<Shift | null> => {
    if (!userId) return null;
    try {
      const response = await apiClient.get('/shifts/active');
      if (!response.data) return null;
      
      const row = response.data;
      return {
        id: row.id,
        userId: row.user_id,
        userName: 'Current User', // we usually don't need this in active fetch
        startTime: row.start_time,
        startingCash: Number(row.initial_cash || 0),
        status: row.status,
        totalSales: 0, // In backend we should probably compute this or fetch from orders, for now 0
        restaurantId: row.restaurant_id
      } as Shift;
    } catch (error) {
      console.error(error);
      return null;
    }
  },

  closeShift: async (shiftId: string, endingCash: number) => {
    try {
      await apiClient.put(`/shifts/${shiftId}/end`, { final_cash: endingCash, expected_cash: endingCash });
    } catch (error) {
      console.error(error);
    }
  }
};
