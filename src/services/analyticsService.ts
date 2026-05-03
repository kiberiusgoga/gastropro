import apiClient from '../lib/apiClient';

export interface AnalyticsData {
  today: { revenue: number; orderCount: number; avgTicket: number };
  revenueByDay: { date: string; revenue: number }[];
  revenueByMonth: { month: string; revenue: number }[];
  topItems: { name: string; count: number; revenue: number }[];
  byCategory: { name: string; value: number }[];
}

const emptyData: AnalyticsData = {
  today: { revenue: 0, orderCount: 0, avgTicket: 0 },
  revenueByDay: [],
  revenueByMonth: [],
  topItems: [],
  byCategory: [],
};

export const analyticsService = {
  getAnalytics: async (range: string = '7d'): Promise<AnalyticsData> => {
    try {
      const response = await apiClient.get(`/analytics?range=${range}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching analytics:', error);
      return emptyData;
    }
  },
};
