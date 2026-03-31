import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  where,
  limit,
  getDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { Table, Order, OrderItem, Payment } from '../types';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { bundleService, inventoryService } from './inventoryService';
import { crmService } from './crmService';

export const tableService = {
  getAll: async (restaurantId: string): Promise<Table[]> => {
    const path = 'tables';
    try {
      const q = query(collection(db, path), where('restaurantId', '==', restaurantId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Table));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return [];
    }
  },
  create: async (data: Partial<Table> & { restaurantId: string }) => {
    const path = 'tables';
    try {
      const docRef = await addDoc(collection(db, path), data);
      return { id: docRef.id, ...data };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },
  update: async (id: string, data: Partial<Table>) => {
    const path = `tables/${id}`;
    try {
      await updateDoc(doc(db, 'tables', id), data);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }
};

export const posService = {
  getOpenOrderForTable: async (tableId: string, restaurantId: string): Promise<Order | null> => {
    const path = 'orders';
    try {
      const q = query(
        collection(db, path), 
        where('restaurantId', '==', restaurantId),
        where('tableId', '==', tableId), 
        where('status', 'in', ['order_created', 'sent_to_kitchen', 'preparing', 'ready', 'served', 'paid']),
        limit(1)
      );
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) return null;
      
      const orderDoc = querySnapshot.docs[0];
      const itemsSnapshot = await getDocs(collection(db, path, orderDoc.id, 'items'));
      const items = itemsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OrderItem));
      
      return { id: orderDoc.id, ...orderDoc.data(), items } as Order;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return null;
    }
  },

  createOrder: async (tableId: string | null, userId: string, restaurantId: string, orderType: Order['orderType'] = 'dine_in', customerId?: string, shiftId?: string): Promise<Order | undefined> => {
    const path = 'orders';
    try {
      const orderData = {
        tableId,
        customerId,
        userId,
        restaurantId,
        shiftId,
        status: 'order_created',
        orderType,
        totalAmount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const docRef = await addDoc(collection(db, path), orderData);
      
      // Update table status if dine-in
      if (tableId) {
        await updateDoc(doc(db, 'tables', tableId), { 
          status: 'occupied',
          currentOrderId: docRef.id 
        });
      }
      
      return { id: docRef.id, ...orderData, items: [] } as Order;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  addItemToOrder: async (orderId: string, item: Omit<OrderItem, 'id'>) => {
    const path = `orders/${orderId}/items`;
    try {
      const docRef = await addDoc(collection(db, 'orders', orderId, 'items'), {
        ...item,
        orderId,
        status: item.status || 'pending'
      });
      
      // Update order total
      const orderRef = doc(db, 'orders', orderId);
      const orderSnap = await getDoc(orderRef);
      if (orderSnap.exists()) {
        const orderData = orderSnap.data() as Order;
        const subtotal = (orderData.subtotal || 0) + (item.price * item.quantity);
        let discountAmount = 0;
        if (orderData.discountId) {
          if (orderData.discountType === 'percentage') {
            discountAmount = (subtotal * (orderData.discountValue || 0)) / 100;
          } else {
            discountAmount = orderData.discountValue || 0;
          }
        }
        const totalAmount = subtotal - discountAmount;

        await updateDoc(orderRef, { 
          subtotal,
          totalAmount,
          discountAmount,
          updatedAt: new Date().toISOString()
        });
      }
      
      return { id: docRef.id, ...item, orderId };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  updateItemQuantity: async (orderId: string, itemId: string, newQuantity: number) => {
    const path = `orders/${orderId}/items/${itemId}`;
    try {
      const itemRef = doc(db, 'orders', orderId, 'items', itemId);
      const itemSnap = await getDoc(itemRef);
      
      if (itemSnap.exists()) {
        await updateDoc(itemRef, { quantity: newQuantity });
        
        // Update order total
        const orderRef = doc(db, 'orders', orderId);
        const orderSnap = await getDoc(orderRef);
        if (orderSnap.exists()) {
          const orderData = orderSnap.data() as Order;
          const itemsSnapshot = await getDocs(collection(db, 'orders', orderId, 'items'));
          const items = itemsSnapshot.docs.map(d => d.data() as OrderItem);
          const subtotal = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
          
          let discountAmount = 0;
          if (orderData.discountId) {
            if (orderData.discountType === 'percentage') {
              discountAmount = (subtotal * (orderData.discountValue || 0)) / 100;
            } else {
              discountAmount = orderData.discountValue || 0;
            }
          }
          const totalAmount = subtotal - discountAmount;

          await updateDoc(orderRef, { 
            subtotal,
            totalAmount,
            discountAmount,
            updatedAt: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  updateOrderItemStatus: async (orderId: string, itemId: string, status: OrderItem['status']) => {
    const path = `orders/${orderId}/items/${itemId}`;
    try {
      await updateDoc(doc(db, 'orders', orderId, 'items', itemId), { status });
      await updateDoc(doc(db, 'orders', orderId), { updatedAt: new Date().toISOString() });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  sendToKitchen: async (orderId: string, restaurantId: string) => {
    const path = `orders/${orderId}`;
    try {
      const orderRef = doc(db, 'orders', orderId);
      const orderSnap = await getDoc(orderRef);
      if (!orderSnap.exists()) throw new Error('Order not found');
      const orderData = orderSnap.data();

      // 1. Update order status
      await updateDoc(orderRef, { 
        status: 'sent_to_kitchen',
        updatedAt: new Date().toISOString()
      });

      // 2. Update all pending items to sent_to_kitchen
      const itemsSnapshot = await getDocs(collection(db, 'orders', orderId, 'items'));
      const items = itemsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OrderItem));
      
      for (const item of items) {
        if (item.status === 'pending') {
          await updateDoc(doc(db, 'orders', orderId, 'items', item.id), { 
            status: 'sent_to_kitchen' 
          });

          // 3. Inventory Deduction (Deduct ingredients when sent to kitchen)
          if (item.isBundle) {
            // It's a normative - deduct ingredients
            const ingredients = await bundleService.getBundleItems(item.productId);
            for (const ingredient of ingredients) {
              await inventoryService.recordMovement({
                productId: ingredient.productId,
                restaurantId,
                type: 'output',
                quantity: ingredient.quantity * item.quantity,
                note: `Kitchen Order ${orderId} - ${item.name}`,
                userId: orderData.userId,
                referenceId: orderId
              });
              
              // Update product stock
              const productRef = doc(db, 'products', ingredient.productId);
              const productSnap = await getDoc(productRef);
              if (productSnap.exists()) {
                const currentStock = productSnap.data().currentStock || 0;
                await updateDoc(productRef, { 
                  currentStock: currentStock - (ingredient.quantity * item.quantity) 
                });
              }
            }
          } else {
            // Direct product deduction
            await inventoryService.recordMovement({
              productId: item.productId,
              restaurantId,
              type: 'output',
              quantity: item.quantity,
              note: `Kitchen Order ${orderId} - ${item.name}`,
              userId: orderData.userId,
              referenceId: orderId
            });
            
            const productRef = doc(db, 'products', item.productId);
            const productSnap = await getDoc(productRef);
            if (productSnap.exists()) {
              const currentStock = productSnap.data().currentStock || 0;
              await updateDoc(productRef, { 
                currentStock: currentStock - item.quantity 
              });
            }
          }
        }
      }

      // 4. Notify Kitchen
      console.log(`[WebSocket] Emitting order:new for order ${orderId}`);
      
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
      return false;
    }
  },

  serveOrder: async (orderId: string) => {
    const path = `orders/${orderId}`;
    try {
      await updateDoc(doc(db, 'orders', orderId), { 
        status: 'served',
        updatedAt: new Date().toISOString()
      });

      // Update all ready items to served
      const itemsSnapshot = await getDocs(collection(db, 'orders', orderId, 'items'));
      for (const itemDoc of itemsSnapshot.docs) {
        if (itemDoc.data().status === 'ready') {
          await updateDoc(doc(db, 'orders', orderId, 'items', itemDoc.id), { 
            status: 'served' 
          });
        }
      }
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
      return false;
    }
  },

  closeOrder: async (orderId: string, payments: Omit<Payment, 'id'>[], shiftId?: string) => {
    const path = `orders/${orderId}`;
    try {
      const orderRef = doc(db, 'orders', orderId);
      const orderSnap = await getDoc(orderRef);
      
      if (!orderSnap.exists()) throw new Error('Order not found');
      const orderData = orderSnap.data();
      
      // 1. Record payments
      for (const payment of payments) {
        await addDoc(collection(db, 'orders', orderId, 'payments'), {
          ...payment,
          shiftId,
          timestamp: new Date().toISOString()
        });
      }
      
      // 2. Mark order as paid and closed
      await updateDoc(orderRef, { 
        status: 'closed',
        closedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      // 3. Free the table
      if (orderData.tableId) {
        await updateDoc(doc(db, 'tables', orderData.tableId), { 
          status: 'free',
          currentOrderId: null 
        });
      }

      // 4. Update Customer history if applicable
      if (orderData.customerId) {
        await crmService.addOrderToHistory(orderData.customerId, orderId, orderData.totalAmount);
      }
      
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
      return false;
    }
  },

  getAllOrders: async (restaurantId: string): Promise<Order[]> => {
    const path = 'orders';
    try {
      const q = query(collection(db, path), where('restaurantId', '==', restaurantId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return [];
    }
  },

  updateOrder: async (orderId: string, data: Partial<Order>) => {
    const path = `orders/${orderId}`;
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        ...data,
        updatedAt: new Date().toISOString()
      });
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
      return false;
    }
  },

  updateOrderItem: async (orderId: string, itemId: string, data: Partial<OrderItem>) => {
    const path = `orders/${orderId}/items/${itemId}`;
    try {
      await updateDoc(doc(db, 'orders', orderId, 'items', itemId), data);
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
      return false;
    }
  }
};
