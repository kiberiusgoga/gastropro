import apiClient from '../lib/apiClient';
import { Printer, PrintJob, Order, OrderItem } from '../types';

const mapPrinter = (row: any): Printer => ({
  id: row.id,
  restaurantId: row.restaurant_id,
  name: row.name,
  type: row.type,
  connectionType: row.connection_type,
  active: row.active,
  station: row.station
});

class PrintService {
  async getPrinters(restaurantId?: string): Promise<Printer[]> {
    try {
      const response = await apiClient.get('/printers');
      return response.data.map(mapPrinter);
    } catch (error) {
      console.error(error);
      return [];
    }
  }

  async getActivePrintersByType(restaurantId: string, type: Printer['type']): Promise<Printer[]> {
    try {
      const printers = await this.getPrinters(restaurantId);
      return printers.filter(p => p.type === type && p.active);
    } catch (error) {
      console.error(error);
      return [];
    }
  }

  async createPrintJob(job: Omit<PrintJob, 'id' | 'createdAt' | 'status'>): Promise<string> {
    // In a fully developed backend, this would go to /print-jobs to queue for hardware printers.
    // For now, we simulate success as browser printing is handled locally.
    console.log('[PrintService] Created virtual print job', job);
    return `job_${Date.now()}`;
  }

  async updatePrintJobStatus(jobId: string, status: PrintJob['status']): Promise<void> {
    console.log('[PrintService] Updated print job status', jobId, status);
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
          restaurantId: order.restaurantId,
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
        
        // Simulating actual hardware print by opening a print window if it's a 'browser' connection.
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
        restaurantId: order.restaurantId,
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
    const event = new CustomEvent('app:print', { detail: { type, data } });
    window.dispatchEvent(event);
  }
}

export const printService = new PrintService();
