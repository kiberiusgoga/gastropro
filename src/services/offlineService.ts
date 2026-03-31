import Dexie, { Table } from 'dexie';
import { Order } from '../types';

export class AppDatabase extends Dexie {
  orders!: Table<Order & { isSynced: boolean }>;

  constructor() {
    super('StoreHouseDB');
    this.version(1).stores({
      orders: '++id, tableId, status, isSynced, createdAt'
    });
  }
}

export const db_local = new AppDatabase();

export const offlineService = {
  saveOrder: async (order: Order) => {
    try {
      await db_local.orders.put({ ...order, isSynced: false });
      return true;
    } catch (error) {
      console.error('Error saving order offline:', error);
      return false;
    }
  },

  getUnsyncedOrders: async () => {
    return await db_local.orders.where('isSynced').equals(0).toArray(); // dexie uses 0/1 for boolean sometimes, but let's use false
  },

  markAsSynced: async (orderId: string) => {
    await db_local.orders.update(orderId, { isSynced: true });
  },

  isOnline: () => navigator.onLine
};
