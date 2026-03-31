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
import { Customer } from '../types';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

export const crmService = {
  getAll: async (restaurantId: string): Promise<Customer[]> => {
    const path = 'customers';
    try {
      const q = query(collection(db, path), where('restaurantId', '==', restaurantId));
      const snap = await getDocs(q);
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return [];
    }
  },

  create: async (data: Partial<Customer> & { restaurantId: string }) => {
    const path = 'customers';
    try {
      const customerData = {
        ...data,
        totalSpent: 0,
        orderHistory: []
      };
      const docRef = await addDoc(collection(db, path), customerData);
      return { id: docRef.id, ...customerData };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  update: async (id: string, data: Partial<Customer>) => {
    const path = `customers/${id}`;
    try {
      await updateDoc(doc(db, 'customers', id), data);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  addOrderToHistory: async (customerId: string, orderId: string, amount: number) => {
    const path = `customers/${customerId}`;
    try {
      const customerRef = doc(db, 'customers', customerId);
      const snap = await getDocs(query(collection(db, 'customers'), where('id', '==', customerId)));
      if (!snap.empty) {
        const currentData = snap.docs[0].data() as Customer;
        await updateDoc(customerRef, {
          totalSpent: (currentData.totalSpent || 0) + amount,
          orderHistory: [...(currentData.orderHistory || []), orderId]
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }
};
