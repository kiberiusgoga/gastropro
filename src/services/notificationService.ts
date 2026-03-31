import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  getDocs, 
  query, 
  where, 
  orderBy,
  limit,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase';
import { Notification } from '../types';

const COLLECTION = 'notifications';

export const notificationService = {
  getAll: async (): Promise<Notification[]> => {
    const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'), limit(50));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
  },

  getUnread: async (): Promise<Notification[]> => {
    const q = query(collection(db, COLLECTION), where('read', '==', false), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
  },

  create: async (data: Omit<Notification, 'id' | 'createdAt' | 'read'>): Promise<Notification> => {
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...data,
      read: false,
      createdAt: new Date().toISOString()
    });
    return { id: docRef.id, ...data, read: false, createdAt: new Date().toISOString() } as Notification;
  },

  markAsRead: async (id: string): Promise<void> => {
    await updateDoc(doc(db, COLLECTION, id), { read: true });
  },

  markAllAsRead: async (): Promise<void> => {
    const q = query(collection(db, COLLECTION), where('read', '==', false));
    const snapshot = await getDocs(q);
    for (const d of snapshot.docs) {
      await updateDoc(doc(db, COLLECTION, d.id), { read: true });
    }
  },

  subscribeToUnread: (callback: (notifications: Notification[]) => void) => {
    const q = query(collection(db, COLLECTION), where('read', '==', false), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification)));
    });
  }
};
