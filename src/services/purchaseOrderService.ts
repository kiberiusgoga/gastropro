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
import { PurchaseOrder, Supplier } from '../types';

const SUPPLIERS_COLLECTION = 'suppliers';
const PO_COLLECTION = 'purchaseOrders';

export const purchaseOrderService = {
  // Suppliers
  getSuppliers: async (): Promise<Supplier[]> => {
    const q = query(collection(db, SUPPLIERS_COLLECTION), where('active', '==', true));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier));
  },

  createSupplier: async (data: Omit<Supplier, 'id'>): Promise<Supplier> => {
    const docRef = await addDoc(collection(db, SUPPLIERS_COLLECTION), data);
    return { id: docRef.id, ...data };
  },

  updateSupplier: async (id: string, data: Partial<Supplier>): Promise<void> => {
    await updateDoc(doc(db, SUPPLIERS_COLLECTION, id), data);
  },

  deleteSupplier: async (id: string): Promise<void> => {
    await updateDoc(doc(db, SUPPLIERS_COLLECTION, id), { active: false });
  },

  // Purchase Orders
  getPOs: async (): Promise<PurchaseOrder[]> => {
    const q = query(collection(db, PO_COLLECTION), orderBy('orderDate', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PurchaseOrder));
  },

  createPO: async (data: Omit<PurchaseOrder, 'id' | 'createdAt'>): Promise<PurchaseOrder> => {
    const docRef = await addDoc(collection(db, PO_COLLECTION), {
      ...data,
      createdAt: new Date().toISOString()
    });
    return { id: docRef.id, ...data, createdAt: new Date().toISOString() } as PurchaseOrder;
  },

  updatePO: async (id: string, data: Partial<PurchaseOrder>): Promise<void> => {
    await updateDoc(doc(db, PO_COLLECTION, id), data);
  },

  deletePO: async (id: string): Promise<void> => {
    await updateDoc(doc(db, PO_COLLECTION, id), { status: 'cancelled' });
  }
};
