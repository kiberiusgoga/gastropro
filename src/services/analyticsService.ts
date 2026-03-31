import { 
  collection, 
  getDocs, 
  query, 
  where
} from 'firebase/firestore';
import { db } from '../firebase';
import { Order, OrderItem } from '../types';
import { startOfDay, endOfDay, startOfMonth, endOfMonth, format, subDays } from 'date-fns';

export const analyticsService = {
  getDailySales: async (date: Date = new Date()) => {
    const start = startOfDay(date).toISOString();
    const end = endOfDay(date).toISOString();
    
    const q = query(
      collection(db, 'orders'),
      where('createdAt', '>=', start),
      where('createdAt', '<=', end),
      where('status', '==', 'closed')
    );
    
    const snapshot = await getDocs(q);
    const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
    
    const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const orderCount = orders.length;
    
    return { totalRevenue, orderCount, orders };
  },

  getMonthlySales: async (date: Date = new Date()) => {
    const start = startOfMonth(date).toISOString();
    const end = endOfMonth(date).toISOString();
    
    const q = query(
      collection(db, 'orders'),
      where('createdAt', '>=', start),
      where('createdAt', '<=', end),
      where('status', '==', 'closed')
    );
    
    const snapshot = await getDocs(q);
    const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
    
    const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const orderCount = orders.length;
    
    return { totalRevenue, orderCount, orders };
  },

  getTopSellingItems: async (limitCount: number = 10) => {
    // This is complex in Firestore without aggregation. 
    // We'll fetch all closed orders and aggregate in memory for demo purposes.
    // In a real app, you'd use a cloud function to update a counter or a separate collection.
    const snapshot = await getDocs(query(collection(db, 'orders'), where('status', '==', 'closed')));
    const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
    
    const itemCounts: Record<string, { name: string, count: number, revenue: number }> = {};
    
    for (const order of orders) {
      // In a real app, items are in a subcollection. We'd need to fetch them.
      // For this demo, let's assume they are stored on the order or we fetch them.
      const itemsSnap = await getDocs(collection(db, 'orders', order.id, 'items'));
      const items = itemsSnap.docs.map(doc => doc.data() as OrderItem);
      
      for (const item of items) {
        if (!itemCounts[item.productId]) {
          itemCounts[item.productId] = { name: item.name, count: 0, revenue: 0 };
        }
        itemCounts[item.productId].count += item.quantity;
        itemCounts[item.productId].revenue += item.price * item.quantity;
      }
    }
    
    return Object.values(itemCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, limitCount);
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
      const date = startOfMonth(subDays(new Date(), i * 30)); // Rough approximation
      const { totalRevenue } = await analyticsService.getMonthlySales(date);
      data.push({
        month: format(date, 'MMM'),
        revenue: totalRevenue
      });
    }
    return data;
  }
};
