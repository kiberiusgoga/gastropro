import React from 'react';
import { Order, MenuItem, Table } from '../../types';

interface KitchenReceiptProps {
  order: Order;
  menu: MenuItem[];
  tables: Table[];
}

const KitchenReceipt: React.FC<KitchenReceiptProps> = ({ order, menu, tables }) => {
  const table = tables.find(t => t.id === order.tableId);
  
  // Filter for food items only if needed, but usually kitchen wants everything they need to prepare
  // For now, let's show all items in the order
  
  return (
    <div id="kitchen-receipt" className="hidden print:block p-4 bg-white text-black font-mono text-sm w-[80mm]">
      <div className="text-center mb-4 border-b-2 border-black pb-2">
        <h1 className="text-xl font-bold">КУЈНСКИ БОН</h1>
        <p className="text-lg">Маса: {table?.number || order.tableId}</p>
        <p>Време: {new Date(order.createdAt).toLocaleTimeString('mk-MK')}</p>
        <p>Нарачка: #{order.id.slice(-4)}</p>
      </div>

      <div className="space-y-3">
        {order.items.map((item, i) => {
          const menuItem = menu.find(m => m.id === item.productId);
          return (
            <div key={i} className="flex flex-col border-b border-zinc-200 pb-2">
              <div className="flex justify-between items-center">
                <span className="text-xl font-bold">{item.quantity}x {menuItem?.name}</span>
              </div>
              {item.note && (
                <div className="bg-zinc-100 p-1 mt-1 text-xs italic">
                  Забелешка: {item.note}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="text-center mt-8 pt-4 border-t-2 border-black">
        <p className="font-bold">ПРИЈАТНО!</p>
      </div>
    </div>
  );
};

export default KitchenReceipt;
