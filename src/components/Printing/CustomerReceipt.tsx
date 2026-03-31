import React from 'react';
import { Order, OrderItem } from '../../types';
import { format } from 'date-fns';
import { mk } from 'date-fns/locale';

interface CustomerReceiptProps {
  order: Order;
  items: OrderItem[];
}

export const CustomerReceipt: React.FC<CustomerReceiptProps> = ({ order, items }) => {
  return (
    <div className="p-4 bg-white text-black font-mono text-sm w-[80mm] border border-gray-200">
      <div className="text-center border-b border-dashed border-black pb-2 mb-2">
        <h1 className="text-2xl font-bold uppercase tracking-widest">StoreHouse MK</h1>
        <p className="text-xs">Ул. Македонија бб, Скопје</p>
        <p className="text-xs">Тел: +389 2 123 456</p>
        <p className="text-xs">Даночен број: MK4030000000000</p>
      </div>

      <div className="mb-2 text-center border-b border-dashed border-black pb-2">
        <h2 className="text-lg font-bold uppercase">ФИСКАЛНА СМЕТКА</h2>
        <p className="text-xs">{format(new Date(order.createdAt), 'dd.MM.yyyy HH:mm:ss', { locale: mk })}</p>
      </div>

      <div className="mb-2 flex justify-between items-center text-xs">
        <span>Маса: {order.tableId || 'N/A'}</span>
        <span># {order.id.slice(-8)}</span>
      </div>

      <div className="border-b border-dashed border-black pb-2 mb-2">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-black">
              <th className="text-left py-1">Артикал</th>
              <th className="text-right py-1">Кол.</th>
              <th className="text-right py-1">Цена</th>
              <th className="text-right py-1">Вкупно</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-gray-100">
                <td className="py-1">{item.name}</td>
                <td className="py-1 text-right">{item.quantity}</td>
                <td className="py-1 text-right">{item.price.toFixed(2)}</td>
                <td className="py-1 text-right">{(item.quantity * item.price).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mb-4">
        <div className="flex justify-between items-center text-lg font-bold">
          <span>ВКУПНО:</span>
          <span>{order.totalAmount.toFixed(2)} ден.</span>
        </div>
        <div className="flex justify-between items-center text-xs mt-1">
          <span>ДДВ (18%):</span>
          <span>{(order.totalAmount * 0.18).toFixed(2)} ден.</span>
        </div>
      </div>

      <div className="text-center mt-4 pt-2 border-t border-dashed border-black">
        <p className="text-xs font-bold uppercase">Ви благодариме на посетата!</p>
        <p className="text-xs italic mt-1">Печатено од StoreHouse MK</p>
      </div>
    </div>
  );
};
