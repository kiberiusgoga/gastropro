import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  getDocs, 
  query, 
  where, 
  orderBy,
  getDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { Driver, Order } from '../types';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

const DRIVERS_COLLECTION = 'drivers';
const ORDERS_COLLECTION = 'orders';
const DELIVERIES_COLLECTION = 'deliveries';

export const deliveryService = {
  // Driver management
  getDrivers: async (): Promise<Driver[]> => {
    try {
      const q = query(collection(db, DRIVERS_COLLECTION), where('active', '==', true));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Driver));
    } catch (error) {
      return handleFirestoreError(error, OperationType.GET, DRIVERS_COLLECTION);
    }
  },

  createDriver: async (data: Omit<Driver, 'id'>): Promise<Driver> => {
    try {
      const docRef = await addDoc(collection(db, DRIVERS_COLLECTION), {
        ...data,
        createdAt: new Date().toISOString()
      });
      return { id: docRef.id, ...data };
    } catch (error) {
      return handleFirestoreError(error, OperationType.CREATE, DRIVERS_COLLECTION);
    }
  },

  updateDriver: async (id: string, data: Partial<Driver>): Promise<void> => {
    try {
      await updateDoc(doc(db, DRIVERS_COLLECTION, id), data);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${DRIVERS_COLLECTION}/${id}`);
    }
  },

  // Delivery order management
  getDeliveryOrders: async (): Promise<Order[]> => {
    try {
      const q = query(
        collection(db, ORDERS_COLLECTION), 
        where('orderType', '==', 'delivery'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
    } catch (error) {
      return handleFirestoreError(error, OperationType.GET, ORDERS_COLLECTION);
    }
  },

  assignDriver: async (orderId: string, driverId: string): Promise<void> => {
    try {
      const orderRef = doc(db, ORDERS_COLLECTION, orderId);
      const driverRef = doc(db, DRIVERS_COLLECTION, driverId);
      
      const orderSnap = await getDoc(orderRef);
      if (!orderSnap.exists()) throw new Error('Нарачката не постои');
      const orderData = orderSnap.data() as Order;

      // Update Order
      await updateDoc(orderRef, { 
        driverId: driverId,
        deliveryStatus: 'out_for_delivery',
        status: 'out_for_delivery'
      });

      // Update Driver
      await updateDoc(driverRef, { 
        status: 'busy',
        currentOrderId: orderId
      });

      // Create/Update Delivery record
      const deliveryData = {
        orderId,
        driverId,
        status: 'out_for_delivery',
        address: orderData.deliveryAddress || '',
        phone: orderData.deliveryPhone || '',
        fee: orderData.deliveryFee || 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await addDoc(collection(db, DELIVERIES_COLLECTION), deliveryData);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${ORDERS_COLLECTION}/${orderId}`);
    }
  },

  updateDeliveryStatus: async (orderId: string, status: Order['deliveryStatus']): Promise<void> => {
    try {
      const orderRef = doc(db, ORDERS_COLLECTION, orderId);
      
      const updateData: Partial<Order> = { 
        deliveryStatus: status,
        status: status === 'delivered' ? 'paid' : (status as Order['status'])
      };

      await updateDoc(orderRef, updateData);

      // If delivered, free up driver
      if (status === 'delivered') {
        const orderSnap = await getDoc(orderRef);
        const orderData = orderSnap.data() as Order;
        
        if (orderData.driverId) {
          await updateDoc(doc(db, DRIVERS_COLLECTION, orderData.driverId), {
            status: 'available',
            currentOrderId: null
          });
        }
      }

      // Update Delivery record
      const q = query(collection(db, DELIVERIES_COLLECTION), where('orderId', '==', orderId));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const deliveryDoc = snapshot.docs[0];
        await updateDoc(doc(db, DELIVERIES_COLLECTION, deliveryDoc.id), {
          status,
          updatedAt: new Date().toISOString(),
          actualDeliveryTime: status === 'delivered' ? new Date().toISOString() : undefined
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${ORDERS_COLLECTION}/${orderId}`);
    }
  }
};
