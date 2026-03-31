import { 
  collection, 
  getDocs, 
  updateDoc, 
  doc, 
  query, 
  where,
  getDoc,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase';
import { Order, OrderItem } from '../types';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { notificationService } from './notificationService';

// Mock WebSocket implementation
const emitWebSocketEvent = (event: string, data: Record<string, unknown>) => {
  console.log(`[WebSocket] Emitting ${event}:`, data);
  // In a real app, this would use socket.io or similar
  // window.dispatchEvent(new CustomEvent(event, { detail: data }));
};

export const kdsService = {
  // Listen for active orders for the kitchen
  subscribeToKitchenOrders: (callback: (orders: Order[]) => void) => {
    const q = query(
      collection(db, 'orders'),
      where('status', 'in', ['sent_to_kitchen', 'preparing', 'ready'])
    );

    return onSnapshot(q, async (snapshot) => {
      const orders: Order[] = [];
      for (const orderDoc of snapshot.docs) {
        const itemsSnapshot = await getDocs(collection(db, 'orders', orderDoc.id, 'items'));
        const items = itemsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OrderItem));
        orders.push({ id: orderDoc.id, ...orderDoc.data(), items } as Order);
      }
      callback(orders);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'orders');
    });
  },

  startPreparing: async (orderId: string) => {
    const path = `orders/${orderId}`;
    try {
      await updateDoc(doc(db, 'orders', orderId), { 
        status: 'preparing',
        updatedAt: new Date().toISOString()
      });

      // Update all items to preparing
      const itemsSnapshot = await getDocs(collection(db, 'orders', orderId, 'items'));
      for (const itemDoc of itemsSnapshot.docs) {
        if (itemDoc.data().status === 'sent_to_kitchen') {
          await updateDoc(doc(db, 'orders', orderId, 'items', itemDoc.id), { 
            status: 'preparing' 
          });
        }
      }

      emitWebSocketEvent('order:preparing', { orderId });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  markAsReady: async (orderId: string) => {
    const path = `orders/${orderId}`;
    try {
      const orderRef = doc(db, 'orders', orderId);
      const orderSnap = await getDoc(orderRef);
      const orderData = orderSnap.data();

      await updateDoc(orderRef, { 
        status: 'ready',
        updatedAt: new Date().toISOString()
      });

      // Update all items to ready
      const itemsSnapshot = await getDocs(collection(db, 'orders', orderId, 'items'));
      for (const itemDoc of itemsSnapshot.docs) {
        if (itemDoc.data().status === 'preparing') {
          await updateDoc(doc(db, 'orders', orderId, 'items', itemDoc.id), { 
            status: 'ready' 
          });
        }
      }

      // Notify waiter
      if (orderData?.userId) {
        await notificationService.create({
          title: 'Нарачката е готова!',
          message: `Нарачката за маса ${orderData.tableId || 'N/A'} е подготвена.`,
          type: 'success',
          category: 'new_order',
          userId: orderData.userId
        });
      }

      emitWebSocketEvent('order:ready', { orderId });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }
};
