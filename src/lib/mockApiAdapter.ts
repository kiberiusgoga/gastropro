import { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { mockDb } from './mockDatabase';

export const setupMockApi = (apiClient: AxiosInstance) => {
  // Store the original adapter
  const originalAdapter = apiClient.defaults.adapter;

  apiClient.defaults.adapter = async (config) => {
    // Attempt the real network request first if we are not explicitly forcing offline mode
    // (You can change this logic to always use mock if network is down)
    try {
      if (originalAdapter) {
        // Try real request
        return await (originalAdapter as any)(config);
      }
    } catch (error: any) {
      // If network error OR 500 error from backend (like missing DB), fallback to mock DB!
      if (!error.response || error.response.status >= 500) {
        console.warn(`[Mock API] Intercepted failed request to ${config.url}. Using LocalStorage Mock DB.`);
        
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(handleMockRequest(config));
          }, 200); // 200ms fake latency
        });
      }
      throw error;
    }

    // Default fallback if originalAdapter somehow missing
    return handleMockRequest(config);
  };
};

function handleMockRequest(config: InternalAxiosRequestConfig): AxiosResponse {
  const url = config.url || '';
  const method = config.method?.toUpperCase() || 'GET';
  let data: any = null;

  try {
    if (config.data && typeof config.data === 'string') {
      data = JSON.parse(config.data);
    } else {
      data = config.data;
    }
  } catch (e) {}

  let responseData: any = null;
  const status = 200;

  // --- GET REQUESTS ---
  if (method === 'GET') {
    if (url.includes('/products')) responseData = mockDb.get('products');
    else if (url.includes('/menu-categories')) responseData = mockDb.get('menuCategories');
    else if (url.includes('/menu-items')) responseData = mockDb.get('menuItems');
    else if (url.includes('/tables')) responseData = mockDb.get('tables');
    else if (url.includes('/transactions')) responseData = mockDb.get('transactions');
    else if (url.includes('/users')) responseData = mockDb.get('users');
    else if (url.match(/\/shifts\/active/)) responseData = (mockDb.get('shifts') as { status: string }[]).find(s => s.status === 'open') || null;
    else if (url.includes('/shifts')) responseData = mockDb.get('shifts');
    else if (url.includes('/orders')) responseData = mockDb.get('orders');
    else if (url.includes('/customers')) responseData = mockDb.get('customers');
    else if (url.includes('/dashboard/stats')) responseData = mockDb.getDashboardStats();
    else if (url.includes('/restaurants/')) responseData = { id: '1', name: 'GastroPro Demo', subscriptionPlan: 'pro', active: true };
    else responseData = [];
  } 
  // --- POST REQUESTS ---
  else if (method === 'POST') {
    if (url.includes('/orders')) {
      responseData = mockDb.add('orders', { ...data, status: 'order_created', createdAt: new Date().toISOString() });
    }
    else if (url.includes('/products')) responseData = mockDb.add('products', data);
    else if (url.includes('/menu-categories')) responseData = mockDb.add('menuCategories', data);
    else if (url.includes('/menu-items')) responseData = mockDb.add('menuItems', data);
    else if (url.includes('/tables')) responseData = mockDb.add('tables', data);
    else responseData = { id: Math.random().toString(36).substr(2, 9), ...data };
  }
  // --- PUT / PATCH REQUESTS ---
  else if (method === 'PUT' || method === 'PATCH') {
    const parts = url.split('/');
    const id = parts[parts.length - 1];
    
    if (url.includes('/orders')) responseData = mockDb.update('orders', id, data);
    else if (url.includes('/products')) responseData = mockDb.update('products', id, data);
    else if (url.includes('/users')) responseData = mockDb.update('users', id, data);
    else if (url.includes('/tables')) responseData = mockDb.update('tables', id, data);
    else responseData = { success: true };
  }
  // --- DELETE REQUESTS ---
  else if (method === 'DELETE') {
    const parts = url.split('/');
    const id = parts[parts.length - 1];
    
    if (url.includes('/products')) mockDb.remove('products', id);
    else if (url.includes('/users')) mockDb.remove('users', id);
    responseData = { success: true };
  }

  return {
    data: responseData,
    status,
    statusText: 'OK',
    headers: {},
    config,
    request: {}
  };
}
