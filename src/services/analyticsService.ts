import apiClient from '../lib/apiClient';
import { Order, OrderItem } from '../types';
import { startOfDay, endOfDay, startOfMonth, endOfMonth, format, subDays } from 'date-fns';

export const analyticsService = {
  getDailySales: async (date: Date = new Date()) => {
    try {
      const response = await apiClient.get('/orders');
      const allOrders = response.data;

      const start = startOfDay(date);
      const end = endOfDay(date);

      const orders: Order[] = allOrders
        .filter((row: any) => {
          const orderDate = new Date(row.created_at);
          return row.status === 'paid' && orderDate >= start && orderDate <= end;
        })
        .map((row: any) => ({
          id: row.id,
          totalAmount: Number(row.total_amount || 0),
          createdAt: row.created_at,
          status: row.status
        })) as Order[];

      const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);
      const orderCount = orders.length;

      return { totalRevenue, orderCount, orders };
    } catch (error) {
      console.error('Error fetching daily sales:', error);
      return { totalRevenue: 0, orderCount: 0, orders: [] };
    }
  },

  getMonthlySales: async (date: Date = new Date()) => {
    try {
      const response = await apiClient.get('/orders');
      const allOrders = response.data;

      const start = startOfMonth(date);
      const end = endOfMonth(date);

      const orders: Order[] = allOrders
        .filter((row: any) => {
          const orderDate = new Date(row.created_at);
          return row.status === 'paid' && orderDate >= start && orderDate <= end;
        })
        .map((row: any) => ({
          id: row.id,
          totalAmount: Number(row.total_amount || 0),
          createdAt: row.created_at,
          status: row.status
        })) as Order[];

      const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);
      const orderCount = orders.length;

      return { totalRevenue, orderCount, orders };
    } catch (error) {
      console.error('Error fetching monthly sales:', error);
      return { totalRevenue: 0, orderCount: 0, orders: [] };
    }
  },

  getTopSellingItems: async (limitCount: number = 10) => {
    try {
      const response = await apiClient.get('/orders');
      const allOrders = response.data.filter((row: any) => row.status === 'paid');

      const itemCounts: Record<string, { name: string, count: number, revenue: number }> = {};

      for (const order of allOrders) {
        try {
          const itemsRes = await apiClient.get(`/orders/${order.id}/items`);
          const items = itemsRes.data as any[];

          for (const item of items) {
            const key = item.menu_item_id || item.name;
            if (!itemCounts[key]) {
              itemCounts[key] = { name: item.name, count: 0, revenue: 0 };
            }
            itemCounts[key].count += Number(item.quantity);
            itemCounts[key].revenue += Number(item.price) * Number(item.quantity);
          }
        } catch {
          // Skip orders where items can't be fetched
        }
      }

      return Object.values(itemCounts)
        .sort((a, b) => b.count - a.count)
        .slice(0, limitCount);
    } catch (error) {
      console.error('Error fetching top selling items:', error);
      return [];
    }
  },

  getRevenueChartData: async (days: number = 7) => {
    const data = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const { totalRevenue } = await analyticsService.getDailySales(date);
      data.push({
        date: format(date, 'dd.MM'),
        revenue: totalRevenue
      });
    }
    return data;
  },

  getMonthlyRevenueData: async (months: number = 6) => {
    const data = [];
    for (let i = months - 1; i >= 0; i--) {
      const date = startOfMonth(subDays(new Date(), i * 30));
      const { totalRevenue } = await analyticsService.getMonthlySales(date);
      data.push({
        month: format(date, 'MMM'),
        revenue: totalRevenue
      });
    }
    return data;
  }
};
