import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  where 
} from 'firebase/firestore';
import { db } from '../firebase';
import { Discount } from '../types';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

export const discountService = {
  getAll: async (): Promise<Discount[]> => {
    const path = 'discounts';
    try {
      const q = query(collection(db, path), where('active', '==', true));
      const snap = await getDocs(q);
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Discount));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return [];
    }
  },

  create: async (data: Omit<Discount, 'id'>) => {
    const path = 'discounts';
    try {
      const docRef = await addDoc(collection(db, path), data);
      return { id: docRef.id, ...data };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  update: async (id: string, data: Partial<Discount>) => {
    const path = `discounts/${id}`;
    try {
      await updateDoc(doc(db, 'discounts', id), data);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }
};
