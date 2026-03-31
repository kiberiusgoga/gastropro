import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  doc,
  updateDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { Printer, PrintJob, Order, OrderItem } from '../types';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

class PrintService {
  private printersCollection = collection(db, 'printers');
  private printJobsCollection = collection(db, 'printJobs');

  async getPrinters(restaurantId: string): Promise<Printer[]> {
    try {
      const q = query(this.printersCollection, where('restaurantId', '==', restaurantId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Printer));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'printers');
      return [];
    }
  }

  async getActivePrintersByType(restaurantId: string, type: Printer['type']): Promise<Printer[]> {
    try {
      const q = query(
        this.printersCollection, 
        where('restaurantId', '==', restaurantId),
        where('type', '==', type),
        where('active', '==', true)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Printer));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'printers');
      return [];
    }
  }

  async createPrintJob(job: Omit<PrintJob, 'id' | 'createdAt' | 'status'>): Promise<string> {
    try {
      const docRef = await addDoc(this.printJobsCollection, {
        ...job,
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'printJobs');
      return '';
    }
  }

  async updatePrintJobStatus(jobId: string, status: PrintJob['status']): Promise<void> {
    try {
      const docRef = doc(db, 'printJobs', jobId);
      await updateDoc(docRef, { status });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `printJobs/${jobId}`);
    }
  }

  /**
   * Logic to print kitchen tickets for an order.
   * It splits the order items by their preparation station and sends them to the respective printers.
   */
  async printKitchenTickets(order: Order): Promise<void> {
    const printers = await this.getPrinters(order.restaurantId);
    const activePrinters = printers.filter(p => p.active && (p.type === 'kitchen' || p.type === 'bar'));

    // Group items by station
    const itemsByStation: Record<string, OrderItem[]> = {};
    order.items.forEach(item => {
      const station = item.preparationStation || 'kitchen';
      if (!itemsByStation[station]) {
        itemsByStation[station] = [];
      }
      itemsByStation[station].push(item);
    });

    for (const [station, items] of Object.entries(itemsByStation)) {
      // Find printer for this station
      const printer = activePrinters.find(p => p.station === station) || 
                      activePrinters.find(p => p.type === 'kitchen'); // Fallback to main kitchen

      if (printer) {
        await this.createPrintJob({
          printerId: printer.id,
          orderId: order.id,
          type: 'kitchen_ticket',
          content: {
            orderNumber: order.id.slice(-4),
            tableNumber: order.tableId, // Assuming tableId might be used as number or we need to fetch table
            items: items.map(i => ({ name: i.name, quantity: i.quantity, note: i.note })),
            timestamp: new Date().toISOString()
          }
        });
        
        // In a real app, we'd trigger the actual hardware print here.
        // For this demo, we'll simulate it by opening a print window if it's a 'browser' connection.
        if (printer.connectionType === 'browser') {
          this.triggerBrowserPrint('kitchen_ticket', { order, items, station });
        }
      }
    }
  }

  async printCustomerReceipt(order: Order): Promise<void> {
    const printers = await this.getActivePrintersByType(order.restaurantId, 'receipt');
    const printer = printers[0]; // Use the first active receipt printer

    if (printer) {
      await this.createPrintJob({
        printerId: printer.id,
        orderId: order.id,
        type: 'customer_receipt',
        content: {
          orderId: order.id,
          total: order.totalAmount,
          items: order.items,
          timestamp: new Date().toISOString()
        }
      });

      if (printer.connectionType === 'browser') {
        this.triggerBrowserPrint('customer_receipt', { order });
      }
    } else {
      // If no printer configured, just trigger browser print anyway
      this.triggerBrowserPrint('customer_receipt', { order });
    }
  }

  private triggerBrowserPrint(type: string, data: Record<string, unknown>) {
    // This is a helper to trigger the browser's print dialog.
    // In a real implementation, this would render a hidden component and call window.print().
    // We'll handle the actual rendering in the UI components.
    const event = new CustomEvent('app:print', { detail: { type, data } });
    window.dispatchEvent(event);
  }
}

export const printService = new PrintService();
