import { Order } from '../types';

export interface FiscalStatus {
  connected: boolean;
  paperLevel: number; // 0-100
  lastSync: Date;
  ipAddress: string;
}

class FiscalService {
  private status: FiscalStatus = {
    connected: true,
    paperLevel: 85,
    lastSync: new Date(),
    ipAddress: '192.168.1.105'
  };

  async getStatus(): Promise<FiscalStatus> {
    // Simulate API call to fiscal printer
    return new Promise((resolve) => {
      setTimeout(() => resolve(this.status), 500);
    });
  }

  async printReceipt(order: Order): Promise<{ success: boolean; receiptNumber?: string }> {
    console.log(`[Fiscal] Printing order ${order.id}...`);
    
    // Simulate printing process
    return new Promise((resolve) => {
      setTimeout(() => {
        const success = Math.random() > 0.05; // 95% success rate
        if (success) {
          this.status.paperLevel -= 1;
          this.status.lastSync = new Date();
          resolve({ success: true, receiptNumber: `F-${Math.floor(Math.random() * 1000000)}` });
        } else {
          resolve({ success: false });
        }
      }, 2000);
    });
  }

  async toggleConnection(): Promise<boolean> {
    this.status.connected = !this.status.connected;
    return this.status.connected;
  }
}

export const fiscalService = new FiscalService();
