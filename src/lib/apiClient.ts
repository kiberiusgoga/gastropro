import axios from 'axios';
import { setupMockApi } from './mockApiAdapter';

// Get API URL from environment falling back to current domain + /api
const API_URL = import.meta.env.VITE_API_URL || '/api';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Setup mock API Adapter for seamless offline demo experience
// This intercepts requests that fail due to missing database and falls back to LocalStorage mock DB
setupMockApi(apiClient);

// Configure interceptor to attach JWT token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('gastropro_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Handle global 401s (token expire) etc.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Possible token expiration, could do refresh logic here
      // localStorage.removeItem('gastropro_token');
      // window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
