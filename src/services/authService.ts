import apiClient from '../lib/apiClient';
import { User } from '../types';

let authListeners: Array<(user: User | null) => void> = [];

export const authService = {
  login: async (email: string, password: string): Promise<User> => {
    try {
      // Demo shortcut — redirect to real API with seeded credentials
      const resolvedEmail = (email === 'demo' || email === 'admin@storehouse.mk')
        ? 'admin@gastropro.mk'
        : email;
      const resolvedPassword = (email === 'demo' || email === 'admin@storehouse.mk')
        ? 'admin123'
        : password;

      const response = await apiClient.post('/auth/login', { email: resolvedEmail, password: resolvedPassword });
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
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  onAuthChange: (callback: (user: User | null) => void) => {
    authListeners.push(callback);

    // Clear stale demo sessions that used fake tokens
    const token = localStorage.getItem('gastropro_token');
    if (token === 'demo-access-token') {
      localStorage.removeItem('gastropro_token');
      localStorage.removeItem('gastropro_refresh_token');
      localStorage.removeItem('gastropro_user');
      localStorage.removeItem('active_shift');
      setTimeout(() => callback(null), 100);
      return () => { authListeners = authListeners.filter(l => l !== callback); };
    }

    const current = authService.getCurrentUser();
    setTimeout(() => callback(current), 100);

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
