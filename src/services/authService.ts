import apiClient from '../lib/apiClient';
import { User } from '../types';

let authListeners: Array<(user: User | null) => void> = [];

export const authService = {
  login: async (email: string, password: string): Promise<User> => {
    try {
      // Demo login bypass locally
      if (email === 'admin@storehouse.mk' || email === 'demo') {
        const demoUser: User = {
          id: 'demo123',
          name: 'Администратор',
          email: 'admin@storehouse.mk',
          role: 'Admin',
          active: true,
          restaurantId: 'demo-restaurant-id',
          createdAt: new Date().toISOString()
        };
        const accessToken = 'demo-access-token';
        const refreshToken = 'demo-refresh-token';
        
        localStorage.setItem('gastropro_token', accessToken);
        localStorage.setItem('gastropro_refresh_token', refreshToken);
        
        authListeners.forEach(listener => listener(demoUser));
        return demoUser;
      }

      const response = await apiClient.post('/auth/login', { email, password });
      const { accessToken, refreshToken, user } = response.data;
      
      localStorage.setItem('gastropro_token', accessToken);
      localStorage.setItem('gastropro_refresh_token', refreshToken);
      localStorage.setItem('gastropro_user', JSON.stringify(user));
      
      // trigger auth listeners
      authListeners.forEach(listener => listener(user));
      
      return user;
    } catch (error: any) {
       console.error("Login failed", error);
       // Check if there is a response message
       if (error.response && error.response.data && error.response.data.error) {
           throw new Error(error.response.data.error);
       }
       throw error;
    }
  },

  loginWithGoogle: async (): Promise<User> => {
     throw new Error("Google login is disabled in strict SaaS mode. Use email and password.");
  },

  register: async (name: string, email: string, password: string): Promise<User> => {
    throw new Error("Feature disabled. Use Restaurant Setup for initial registration.");
  },

  logout: async () => {
    localStorage.removeItem('gastropro_token');
    localStorage.removeItem('gastropro_refresh_token');
    localStorage.removeItem('gastropro_user');
    localStorage.removeItem('active_shift'); // Clean up active shift as well
    
    // trigger listeners
    authListeners.forEach(listener => listener(null));
  },

  getCurrentUser: (): User | null => {
    const userStr = localStorage.getItem('gastropro_user');
    return userStr ? JSON.parse(userStr) : null;
  },

  onAuthChange: (callback: (user: User | null) => void) => {
    authListeners.push(callback);
    // trigger immediately with current state
    const current = authService.getCurrentUser();
    
    // Simulate async resolution to match previous firebase behavior
    setTimeout(() => {
        callback(current);
    }, 100);
    
    // Return unsubscribe function
    return () => {
      authListeners = authListeners.filter(l => l !== callback);
    };
  },

  getUsers: async (restaurantId?: string): Promise<User[]> => {
    // We don't need to pass restaurantId because apiClient automatically attaches JWT
    // which has the restaurantId securely on the server!
    const response = await apiClient.get('/users');
    return response.data;
  },

  updateUser: async (id: string, data: Partial<User>) => {
    const response = await apiClient.put(`/users/${id}`, data);
    return response.data;
  },

  createUser: async (data: Omit<User, 'id'> & { password?: string }) => {
    const response = await apiClient.post('/users', data);
    return response.data;
  }
};
