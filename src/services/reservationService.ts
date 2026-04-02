import apiClient from '../lib/apiClient';
import { Reservation, Table } from '../types';

const mapReservation = (row: any): Reservation => ({
  id: row.id,
  restaurantId: row.restaurant_id,
  customerId: row.customer_id,
  customerName: row.customer_name,
  customerPhone: row.customer_phone,
  tableId: row.table_id,
  tableNumber: Number(row.table_number),
  date: new Date(row.date).toISOString().split('T')[0],
  time: row.time.slice(0, 5), // Format HH:mm from HH:mm:ss
  numberOfGuests: row.number_of_guests,
  notes: row.notes,
  status: row.status,
  createdAt: row.created_at
});

const toPayload = (data: Partial<Reservation>) => ({
  customer_id: data.customerId,
  customer_name: data.customerName,
  customer_phone: data.customerPhone,
  table_id: data.tableId,
  table_number: data.tableNumber?.toString(),
  date: data.date,
  time: data.time,
  number_of_guests: data.numberOfGuests,
  notes: data.notes,
  status: data.status
});

export const reservationService = {
  getAll: async (): Promise<Reservation[]> => {
    try {
      const response = await apiClient.get('/reservations');
      return response.data.map(mapReservation);
    } catch (error) {
      console.error(error);
      return [];
    }
  },

  getByDate: async (date: string): Promise<Reservation[]> => {
    try {
      const all = await reservationService.getAll();
      return all.filter(r => r.date === date);
    } catch (error) {
      console.error(error);
      return [];
    }
  },

  create: async (data: Omit<Reservation, 'id' | 'createdAt'>): Promise<Reservation> => {
    try {
      const response = await apiClient.post('/reservations', toPayload(data));
      return mapReservation(response.data);
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  update: async (id: string, data: Partial<Reservation>): Promise<void> => {
    try {
      await apiClient.put(`/reservations/${id}`, toPayload(data));
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  delete: async (id: string): Promise<void> => {
    try {
      await apiClient.put(`/reservations/${id}`, { status: 'cancelled' });
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  checkAvailability: async (date: string, time: string, tableId: string): Promise<boolean> => {
    try {
      const all = await reservationService.getAll();
      const overlap = all.find(r => r.date === date && r.tableId === tableId && r.time === time && r.status === 'reserved');
      return !overlap;
    } catch (error) {
      console.error('Error checking availability:', error);
      return false;
    }
  },

  autoAssignTable: async (date: string, time: string, guestCount: number): Promise<Table | null> => {
    try {
      const tablesRes = await apiClient.get('/tables');
      const allTables = tablesRes.data as Table[];
      
      const suitableTables = allTables
        .filter(t => t.capacity >= guestCount)
        .sort((a, b) => a.capacity - b.capacity);
      
      const allReservations = await reservationService.getAll();
      
      for (const table of suitableTables) {
        const overlap = allReservations.find(r => r.date === date && r.tableId === table.id && r.time === time && r.status === 'reserved');
        if (!overlap) return table;
      }
      return null;
    } catch (error) {
      console.error('Error auto-assigning table:', error);
      return null;
    }
  },

  getReminders: async (): Promise<Reservation[]> => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const all = await reservationService.getAll();
      return all.filter(r => r.date === today && r.status === 'reserved');
    } catch (error) {
      console.error('Error getting reminders:', error);
      return [];
    }
  }
};
