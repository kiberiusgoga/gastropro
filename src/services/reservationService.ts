import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  getDocs, 
  query, 
  where, 
  orderBy
} from 'firebase/firestore';
import { db } from '../firebase';
import { Reservation, Table } from '../types';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

const COLLECTION = 'reservations';

export const reservationService = {
  getAll: async (): Promise<Reservation[]> => {
    try {
      const q = query(collection(db, COLLECTION), orderBy('date', 'asc'), orderBy('time', 'asc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reservation));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, COLLECTION);
      return [];
    }
  },

  getByDate: async (date: string): Promise<Reservation[]> => {
    try {
      const q = query(collection(db, COLLECTION), where('date', '==', date), orderBy('time', 'asc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reservation));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, COLLECTION);
      return [];
    }
  },

  create: async (data: Omit<Reservation, 'id' | 'createdAt'>): Promise<Reservation> => {
    try {
      const docRef = await addDoc(collection(db, COLLECTION), {
        ...data,
        createdAt: new Date().toISOString()
      });
      return { id: docRef.id, ...data, createdAt: new Date().toISOString() } as Reservation;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, COLLECTION);
      throw error;
    }
  },

  update: async (id: string, data: Partial<Reservation>): Promise<void> => {
    try {
      await updateDoc(doc(db, COLLECTION, id), data);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION}/${id}`);
      throw error;
    }
  },

  delete: async (id: string): Promise<void> => {
    try {
      await updateDoc(doc(db, COLLECTION, id), { status: 'cancelled' });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${COLLECTION}/${id}`);
      throw error;
    }
  },

  checkAvailability: async (date: string, time: string, tableId: string): Promise<boolean> => {
    try {
      // Simple check: is there any reservation for this table at this date and time?
      // In a real app, we'd check for a time range (e.g., +/- 2 hours)
      const q = query(
        collection(db, COLLECTION), 
        where('date', '==', date), 
        where('tableId', '==', tableId),
        where('status', '==', 'reserved')
      );
      const snapshot = await getDocs(q);
      
      // Basic time overlap check (simplified)
      const isAvailable = snapshot.docs.every(doc => {
        const res = doc.data() as Reservation;
        return res.time !== time;
      });
      
      return isAvailable;
    } catch (error) {
      console.error('Error checking availability:', error);
      return false;
    }
  },

  autoAssignTable: async (date: string, time: string, guestCount: number): Promise<Table | null> => {
    try {
      // 1. Get all tables
      const tablesSnap = await getDocs(collection(db, 'tables'));
      const allTables = tablesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Table));
      
      // 2. Filter tables by capacity
      const suitableTables = allTables
        .filter(t => t.capacity >= guestCount)
        .sort((a, b) => a.capacity - b.capacity); // Smallest suitable first
      
      // 3. Check availability for each suitable table
      for (const table of suitableTables) {
        const isAvailable = await reservationService.checkAvailability(date, time, table.id);
        if (isAvailable) return table;
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
      const q = query(
        collection(db, COLLECTION), 
        where('date', '==', today),
        where('status', '==', 'reserved'),
        orderBy('time', 'asc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reservation));
    } catch (error) {
      console.error('Error getting reminders:', error);
      return [];
    }
  }
};
