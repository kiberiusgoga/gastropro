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
import { Employee, UserRole } from '../types';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

const COLLECTION = 'employees';

export const employeeService = {
  getAll: async (restaurantId: string): Promise<Employee[]> => {
    try {
      const q = query(
        collection(db, COLLECTION), 
        where('restaurantId', '==', restaurantId),
        orderBy('name', 'asc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, COLLECTION);
      return [];
    }
  },

  getByRole: async (restaurantId: string, role: UserRole): Promise<Employee[]> => {
    try {
      const q = query(
        collection(db, COLLECTION), 
        where('restaurantId', '==', restaurantId),
        where('role', '==', role), 
        where('active', '==', true)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, COLLECTION);
      return [];
    }
  },

  create: async (data: Omit<Employee, 'id' | 'createdAt'>): Promise<Employee | undefined> => {
    try {
      const docRef = await addDoc(collection(db, COLLECTION), {
        ...data,
        createdAt: new Date().toISOString()
      });
      return { id: docRef.id, ...data, createdAt: new Date().toISOString() } as Employee;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, COLLECTION);
    }
  },

  update: async (id: string, data: Partial<Employee>): Promise<void> => {
    try {
      await updateDoc(doc(db, COLLECTION, id), data);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION}/${id}`);
    }
  },

  delete: async (id: string): Promise<void> => {
    try {
      await updateDoc(doc(db, COLLECTION, id), { active: false });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${COLLECTION}/${id}`);
    }
  }
};
