import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  query,
  where
} from 'firebase/firestore';
import { db } from '../firebase';
import { Product, Category } from '../types';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

export const productService = {
  getAll: async (restaurantId: string): Promise<Product[]> => {
    const path = 'products';
    try {
      const q = query(collection(db, path), where('restaurantId', '==', restaurantId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return [];
    }
  },
  create: async (data: Partial<Product> & { restaurantId: string }) => {
    const path = 'products';
    try {
      const docRef = await addDoc(collection(db, path), data);
      return { id: docRef.id, ...data };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },
  update: async (id: string, data: Partial<Product>) => {
    const path = `products/${id}`;
    try {
      await updateDoc(doc(db, 'products', id), data);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },
  delete: async (id: string) => {
    const path = `products/${id}`;
    try {
      await deleteDoc(doc(db, 'products', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }
};

export const categoryService = {
  getAll: async (restaurantId: string): Promise<Category[]> => {
    const path = 'categories';
    try {
      const q = query(collection(db, path), where('restaurantId', '==', restaurantId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return [];
    }
  },
  create: async (data: Partial<Category> & { restaurantId: string }) => {
    const path = 'categories';
    try {
      const docRef = await addDoc(collection(db, path), data);
      return { id: docRef.id, ...data };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },
  update: async (id: string, data: Partial<Category>) => {
    const path = `categories/${id}`;
    try {
      await updateDoc(doc(db, 'categories', id), data);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },
  delete: async (id: string) => {
    const path = `categories/${id}`;
    try {
      await deleteDoc(doc(db, 'categories', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }
};
