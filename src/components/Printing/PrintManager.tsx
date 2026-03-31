import React, { useEffect, useState } from 'react';
import { KitchenReceipt } from './KitchenReceipt';
import { CustomerReceipt } from './CustomerReceipt';
import { Order, OrderItem, PreparationStation } from '../../types';

export const PrintManager: React.FC = () => {
  const [printData, setPrintData] = useState<{ type: string; data: Record<string, unknown> } | null>(null);

  useEffect(() => {
    const handlePrint = (e: Event) => {
      const customEvent = e as CustomEvent;
      setPrintData(customEvent.detail);
    };

    window.addEventListener('app:print', handlePrint);
    return () => window.removeEventListener('app:print', handlePrint);
  }, []);

  useEffect(() => {
    if (printData) {
      // Small delay to ensure rendering before print dialog
      const timer = setTimeout(() => {
        window.print();
        setPrintData(null);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [printData]);

  if (!printData) return null;

  return (
    <div id="print-root">
      {printData.type === 'kitchen_ticket' && (
        <KitchenReceipt 
          order={printData.data.order as Order} 
          items={printData.data.items as OrderItem[]} 
          station={printData.data.station as PreparationStation}
        />
      )}
      {printData.type === 'customer_receipt' && (
        <CustomerReceipt 
          order={printData.data.order as Order} 
          items={(printData.data.order as Order).items} 
        />
      )}
      {printData.type === 'order_summary' && (
        <CustomerReceipt 
          order={printData.data.order as Order} 
          items={(printData.data.order as Order).items} 
        />
      )}
    </div>
  );
};
