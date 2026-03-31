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
import { Supplier, PurchaseOrder } from '../types';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

export const supplierService = {
  // Suppliers
  async getAllSuppliers(restaurantId: string): Promise<Supplier[]> {
    const path = 'suppliers';
    try {
      const q = query(
        collection(db, path),
        where('restaurantId', '==', restaurantId),
        where('active', '==', true)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return [];
    }
  },

  async createSupplier(supplier: Omit<Supplier, 'id'>): Promise<string> {
    const path = 'suppliers';
    try {
      const docRef = await addDoc(collection(db, path), supplier);
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
      throw error;
    }
  },

  async updateSupplier(id: string, supplier: Partial<Supplier>): Promise<void> {
    const path = 'suppliers';
    try {
      const docRef = doc(db, path, id);
      await updateDoc(docRef, supplier);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
      throw error;
    }
  },

  // Purchase Orders
  async getAllPurchaseOrders(restaurantId: string): Promise<PurchaseOrder[]> {
    const path = 'purchaseOrders';
    try {
      const q = query(
        collection(db, path),
        where('restaurantId', '==', restaurantId),
        orderBy('orderDate', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PurchaseOrder));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return [];
    }
  },

  async createPurchaseOrder(order: Omit<PurchaseOrder, 'id'>): Promise<string> {
    const path = 'purchaseOrders';
    try {
      const docRef = await addDoc(collection(db, path), order);
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
      throw error;
    }
  },

  async updatePurchaseOrderStatus(id: string, status: PurchaseOrder['status']): Promise<void> {
    const path = 'purchaseOrders';
    try {
      const docRef = doc(db, path, id);
      await updateDoc(docRef, { status });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
      throw error;
    }
  }
};
