import React from 'react';
import { Order, OrderItem } from '../../types';
import { format } from 'date-fns';
import { mk } from 'date-fns/locale';

interface KitchenReceiptProps {
  order: Order;
  items: OrderItem[];
  station?: string;
}

export const KitchenReceipt: React.FC<KitchenReceiptProps> = ({ order, items, station }) => {
  return (
    <div className="p-4 bg-white text-black font-mono text-sm w-[80mm] border border-gray-200">
      <div className="text-center border-b border-dashed border-black pb-2 mb-2">
        <h2 className="text-xl font-bold uppercase">Кујнски Бон</h2>
        {station && <p className="text-lg font-bold">Станица: {station.toUpperCase()}</p>}
        <p className="text-xs">{format(new Date(order.createdAt), 'dd.MM.yyyy HH:mm', { locale: mk })}</p>
      </div>

      <div className="mb-2 flex justify-between items-center">
        <span className="text-lg font-bold">Маса: {order.tableId || 'N/A'}</span>
        <span className="text-xs"># {order.id.slice(-6)}</span>
      </div>

      <div className="border-b border-dashed border-black pb-2 mb-2">
        <table className="w-full">
          <thead>
            <tr className="border-b border-black">
              <th className="text-left py-1">Кол.</th>
              <th className="text-left py-1">Артикал</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-gray-100">
                <td className="py-2 align-top font-bold text-lg">{item.quantity}x</td>
                <td className="py-2">
                  <div className="font-bold text-lg">{item.name}</div>
                  {item.note && (
                    <div className="text-xs italic bg-gray-100 p-1 mt-1">
                      ЗАБЕЛЕШКА: {item.note}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-center mt-4 pt-2 border-t border-dashed border-black">
        <p className="text-xs italic">Печатено од StoreHouse MK</p>
      </div>
    </div>
  );
};
