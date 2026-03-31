import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy,
  limit,
  where
} from 'firebase/firestore';
import { db } from '../firebase';
import { Transaction, Invoice, InventoryCheck, Bundle, DashboardStats } from '../types';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

export const inventoryService = {
  recordMovement: async (data: Omit<Transaction, 'id' | 'date'> & { restaurantId: string }) => {
    try {
      const docRef = await addDoc(collection(db, 'transactions'), {
        ...data,
        date: new Date().toISOString()
      });
      return { id: docRef.id, ...data };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'transactions');
    }
  },
  getTransactions: async (restaurantId: string): Promise<Transaction[]> => {
    const path = 'transactions';
    try {
      const q = query(
        collection(db, path), 
        where('restaurantId', '==', restaurantId),
        orderBy('date', 'desc'), 
        limit(100)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return []; // Never reached but for TS
    }
  },
};

export const inventoryCheckService = {
  getAll: async (restaurantId: string): Promise<InventoryCheck[]> => {
    const path = 'inventoryChecks';
    try {
      const q = query(collection(db, path), where('restaurantId', '==', restaurantId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryCheck));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return [];
    }
  },
  create: async (data: Omit<InventoryCheck, 'id' | 'date'> & { restaurantId: string }) => {
    const path = 'inventoryChecks';
    try {
      const docRef = await addDoc(collection(db, path), {
        ...data,
        date: new Date().toISOString()
      });
      return { id: docRef.id, ...data };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },
};

export const invoiceService = {
  create: async (data: Omit<Invoice, 'id' | 'date'> & { restaurantId: string }) => {
    const path = 'invoices';
    try {
      const docRef = await addDoc(collection(db, path), {
        ...data,
        date: new Date().toISOString()
      });
      return { id: docRef.id, ...data };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },
  getAll: async (restaurantId: string): Promise<Invoice[]> => {
    const path = 'invoices';
    try {
      const q = query(collection(db, path), where('restaurantId', '==', restaurantId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invoice));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return [];
    }
  },
};

export const bundleService = {
  getAll: async (restaurantId: string): Promise<Bundle[]> => {
    const path = 'bundles';
    try {
      const q = query(collection(db, path), where('restaurantId', '==', restaurantId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bundle));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return [];
    }
  },
  create: async (data: Omit<Bundle, 'id'> & { restaurantId: string }) => {
    const path = 'bundles';
    try {
      const docRef = await addDoc(collection(db, path), data);
      return { id: docRef.id, ...data };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },
  update: async (id: string, data: Partial<Bundle>) => {
    const path = `bundles/${id}`;
    try {
      await updateDoc(doc(db, 'bundles', id), data);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },
  delete: async (id: string) => {
    const path = `bundles/${id}`;
    try {
      await deleteDoc(doc(db, 'bundles', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },
  getBundleItems: async (bundleId: string): Promise<{ productId: string; quantity: number }[]> => {
    const path = `bundles/${bundleId}/items`;
    try {
      const querySnapshot = await getDocs(collection(db, 'bundles', bundleId, 'items'));
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as { productId: string; quantity: number }));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return [];
    }
  }
};

export const dashboardService = {
  getStats: async (restaurantId: string): Promise<DashboardStats> => {
    try {
      const productsQ = query(collection(db, 'products'), where('restaurantId', '==', restaurantId));
      const transactionsQ = query(collection(db, 'transactions'), where('restaurantId', '==', restaurantId));
      
      const productsSnapshot = await getDocs(productsQ);
      const transactionsSnapshot = await getDocs(transactionsQ);
      
      const products = productsSnapshot.docs.map(doc => doc.data());
      const totalProducts = products.length;
      const totalStockValue = products.reduce((acc, p) => acc + (p.currentStock * p.purchasePrice), 0);
      const lowStockCount = products.filter(p => p.currentStock <= p.minStock).length;
      const dailyTransactions = transactionsSnapshot.docs.filter(doc => {
        const date = new Date(doc.data().date);
        const today = new Date();
        return date.toDateString() === today.toDateString();
      }).length;

      return {
        totalProducts,
        totalStockValue,
        lowStockCount,
        dailyTransactions,
        revenueByDay: [
          { name: 'Mon', value: 4000 },
          { name: 'Tue', value: 3000 },
          { name: 'Wed', value: 2000 },
          { name: 'Thu', value: 2780 },
          { name: 'Fri', value: 1890 },
          { name: 'Sat', value: 2390 },
          { name: 'Sun', value: 3490 },
        ]
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'dashboard');
      throw error; // Re-throw to be caught by context
    }
  },
};
