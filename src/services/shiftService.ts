import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  where, 
  getDocs,
  limit
} from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

export interface Shift {
  id: string;
  userId: string;
  userName: string;
  startTime: string;
  endTime?: string;
  startingCash: number;
  endingCash?: number;
  status: 'open' | 'closed';
  totalSales: number;
}

export const shiftService = {
  openShift: async (userId: string, userName: string, startingCash: number, restaurantId: string) => {
    const path = 'shifts';
    try {
      const shiftData = {
        userId,
        userName,
        restaurantId,
        startTime: new Date().toISOString(),
        startingCash,
        status: 'open',
        totalSales: 0
      };
      const docRef = await addDoc(collection(db, path), shiftData);
      return { id: docRef.id, ...shiftData };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  getActiveShift: async (userId: string, restaurantId: string) => {
    if (!userId) return null;
    const path = 'shifts';
    try {
      const q = query(
        collection(db, path),
        where('userId', '==', userId),
        where('restaurantId', '==', restaurantId),
        where('status', '==', 'open'),
        limit(1)
      );
      const snap = await getDocs(q);
      if (snap.empty) return null;
      return { id: snap.docs[0].id, ...snap.docs[0].data() } as Shift;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return null;
    }
  },

  closeShift: async (shiftId: string, endingCash: number) => {
    const path = `shifts/${shiftId}`;
    try {
      await updateDoc(doc(db, 'shifts', shiftId), {
        endTime: new Date().toISOString(),
        endingCash,
        status: 'closed'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }
};
