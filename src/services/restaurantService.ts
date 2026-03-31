import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  where,
  getDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { Restaurant } from '../types';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

export const restaurantService = {
  getAll: async (): Promise<Restaurant[]> => {
    const path = 'restaurants';
    try {
      const querySnapshot = await getDocs(collection(db, path));
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Restaurant));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return [];
    }
  },

  getById: async (id: string): Promise<Restaurant | null> => {
    const path = `restaurants/${id}`;
    try {
      const docSnap = await getDoc(doc(db, 'restaurants', id));
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Restaurant;
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return null;
    }
  },

  getByOwnerId: async (ownerId: string): Promise<Restaurant[]> => {
    const path = 'restaurants';
    try {
      const q = query(collection(db, path), where('ownerId', '==', ownerId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Restaurant));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return [];
    }
  },

  create: async (data: Omit<Restaurant, 'id' | 'createdAt'>) => {
    const path = 'restaurants';
    try {
      const docRef = await addDoc(collection(db, path), {
        ...data,
        createdAt: new Date().toISOString(),
        active: true
      });

      // Update user's restaurantId
      if (data.ownerId) {
        await updateDoc(doc(db, 'users', data.ownerId), {
          restaurantId: docRef.id
        });
      }

      return { id: docRef.id, ...data };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  update: async (id: string, data: Partial<Restaurant>) => {
    const path = `restaurants/${id}`;
    try {
      await updateDoc(doc(db, 'restaurants', id), data);
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
      return false;
    }
  }
};
