import apiClient from '../lib/apiClient';
import { Restaurant } from '../types';

export const restaurantService = {
  getAll: async (): Promise<Restaurant[]> => {
    // Only admins checking all restaurants in a higher level admin view would use this
    // Since our app routes are multi-tenant, regular users just fetch theirs through getById
    return [];
  },

  getById: async (id: string): Promise<Restaurant | null> => {
    try {
      const response = await apiClient.get(`/restaurants/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching restaurant', error);
      return null;
    }
  },

  getByOwnerId: async (ownerId: string): Promise<Restaurant[]> => {
     return [];
  },

  create: async (data: Omit<Restaurant, 'id' | 'createdAt'> & { userName?: string, email?: string, password?: string }) => {
    // Our new setup route handles restaurant AND user creation
    try {
      const payload = {
         restaurantName: data.name,
         userName: data.userName || 'Admin',
         email: data.email || 'admin@demo.com',
         password: data.password || 'password123'
      };
      const response = await apiClient.post('/restaurants/setup', payload);
      const { user, accessToken, refreshToken } = response.data;
      
      // Auto login after setup
      localStorage.setItem('gastropro_token', accessToken);
      localStorage.setItem('gastropro_refresh_token', refreshToken);
      localStorage.setItem('gastropro_user', JSON.stringify(user));

      // Return a partial structure to satisfy the frontend for now
      return { 
        id: user.restaurantId, 
        name: data.name, 
        address: data.address,
        subscriptionPlan: data.subscriptionPlan
      } as Restaurant;
    } catch (error: any) {
      console.error('Error creating restaurant setup', error);
      throw error;
    }
  },

  update: async (id: string, data: Partial<Restaurant>) => {
    // Note: To be fully implemented in backend later if needed
    try {
      await apiClient.put(`/restaurants/${id}`, data);
      return true;
    } catch (error) {
      console.error('Error updating restaurant', error);
      return false;
    }
  }
};
