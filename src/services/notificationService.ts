import apiClient from '../lib/apiClient';
import { Notification } from '../types';

export const notificationService = {
  getAll: async (): Promise<Notification[]> => {
    try {
      const response = await apiClient.get('/notifications');
      return response.data.map((row: any) => ({
        id: row.id,
        restaurantId: row.restaurant_id,
        title: row.title,
        message: row.message,
        type: row.type,
        category: row.category,
        read: row.read,
        link: row.link,
        createdAt: row.created_at
      })) as Notification[];
    } catch (error) {
      console.error(error);
      return [];
    }
  },

  getUnread: async (): Promise<Notification[]> => {
    try {
      const all = await notificationService.getAll();
      return all.filter(n => !n.read);
    } catch (error) {
      console.error(error);
      return [];
    }
  },

  create: async (data: Omit<Notification, 'id' | 'createdAt' | 'read' | 'restaurantId'>): Promise<Notification | null> => {
    try {
      const response = await apiClient.post('/notifications', {
        title: data.title,
        message: data.message,
        type: data.type,
        category: data.category,
        link: data.link
      });
      const row = response.data;
      return {
        id: row.id,
        restaurantId: row.restaurant_id,
        title: row.title,
        message: row.message,
        type: row.type,
        category: row.category,
        read: row.read,
        link: row.link,
        createdAt: row.created_at
      } as Notification;
    } catch (error) {
      console.error(error);
      return null;
    }
  },

  markAsRead: async (id: string): Promise<void> => {
    try {
      await apiClient.put(`/notifications/${id}/read`);
    } catch (error) {
      console.error(error);
    }
  },

  markAllAsRead: async (): Promise<void> => {
    try {
      const unread = await notificationService.getUnread();
      await Promise.all(unread.map(n => apiClient.put(`/notifications/${n.id}/read`)));
    } catch (error) {
      console.error(error);
    }
  },

  subscribeToUnread: (callback: (notifications: Notification[]) => void) => {
    const fetchUnread = async () => {
      const data = await notificationService.getUnread();
      callback(data);
    };
    
    // Initial fetch
    fetchUnread();
    
    // Poll every 15 seconds to simulate realtime behavior
    const interval = setInterval(fetchUnread, 15000);
    
    // Return unsubscribe function
    return () => clearInterval(interval);
  }
};
