import apiClient from '../lib/apiClient';
import { Employee, UserRole } from '../types';

const mapEmployee = (row: any): Employee => ({
  id: row.id,
  restaurantId: row.restaurant_id,
  name: row.name,
  email: row.email,
  role: row.role,
  active: row.active,
  createdAt: row.created_at || row.createdAt,
});

export const employeeService = {
  getAll: async (restaurantId?: string): Promise<Employee[]> => {
    try {
      const response = await apiClient.get('/employees');
      return response.data.map(mapEmployee);
    } catch (error) {
      console.error('Error fetching employees:', error);
      return [];
    }
  },

  getByRole: async (restaurantId: string, role: UserRole): Promise<Employee[]> => {
    try {
      const all = await employeeService.getAll(restaurantId);
      return all.filter(e => e.role === role && e.active);
    } catch (error) {
      console.error('Error fetching employees by role:', error);
      return [];
    }
  },

  create: async (data: Omit<Employee, 'id' | 'createdAt'>): Promise<Employee | undefined> => {
    try {
      const response = await apiClient.post('/employees', {
        name: data.name,
        email: data.email,
        role: data.role,
        active: data.active
      });
      return mapEmployee(response.data);
    } catch (error) {
      console.error('Error creating employee:', error);
      return undefined;
    }
  },

  update: async (id: string, data: Partial<Employee>): Promise<void> => {
    try {
      await apiClient.put(`/employees/${id}`, {
        name: data.name,
        email: data.email,
        role: data.role,
        active: data.active
      });
    } catch (error) {
      console.error('Error updating employee:', error);
    }
  },

  delete: async (id: string): Promise<void> => {
    try {
      await apiClient.put(`/employees/${id}`, { active: false });
    } catch (error) {
      console.error('Error deactivating employee:', error);
    }
  }
};
