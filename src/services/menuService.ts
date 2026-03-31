import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where,
  orderBy 
} from 'firebase/firestore';
import { db } from '../firebase';
import { MenuItem, MenuCategory } from '../types';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

export const menuService = {
  // Categories
  getCategories: async (restaurantId: string): Promise<MenuCategory[]> => {
    const path = 'menu_categories';
    try {
      const q = query(
        collection(db, path), 
        where('restaurantId', '==', restaurantId),
        orderBy('sortOrder', 'asc')
      );
      const snap = await getDocs(q);
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MenuCategory));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return [];
    }
  },

  getAllCategories: async (restaurantId: string): Promise<MenuCategory[]> => {
    return menuService.getCategories(restaurantId);
  },

  createCategory: async (data: Partial<MenuCategory>) => {
    const path = 'menu_categories';
    try {
      const docRef = await addDoc(collection(db, path), data);
      return { id: docRef.id, ...data };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  // Items
  getItems: async (restaurantId: string): Promise<MenuItem[]> => {
    const path = 'menu_items';
    try {
      const q = query(collection(db, path), where('restaurantId', '==', restaurantId));
      const snap = await getDocs(q);
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MenuItem));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return [];
    }
  },

  getAllItems: async (restaurantId: string): Promise<MenuItem[]> => {
    return menuService.getItems(restaurantId);
  },

  createItem: async (data: Partial<MenuItem>) => {
    const path = 'menu_items';
    try {
      const docRef = await addDoc(collection(db, path), data);
      return { id: docRef.id, ...data };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  updateItem: async (id: string, data: Partial<MenuItem>) => {
    const path = `menu_items/${id}`;
    try {
      await updateDoc(doc(db, 'menu_items', id), data);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  deleteItem: async (id: string) => {
    const path = `menu_items/${id}`;
    try {
      await deleteDoc(doc(db, 'menu_items', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }
};
