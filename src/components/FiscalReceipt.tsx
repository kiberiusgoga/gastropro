import React from 'react';
import { Order, MenuItem } from '../types';

interface FiscalReceiptProps {
  order: Order;
  menu: MenuItem[];
}

const FiscalReceipt: React.FC<FiscalReceiptProps> = ({ order, menu }) => {
  const total = order.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const tax = total * 0.18; // 18% DDV

  return (
    <div id="fiscal-receipt" className="hidden print:block p-4 bg-white text-black font-mono text-xs w-[80mm]">
      <div className="text-center mb-4">
        <h1 className="text-lg font-bold">GASTRO PRO RESTAURANT</h1>
        <p>Ул. Партизанска бб, Скопје</p>
        <p>ДДВ Број: MK4030012345678</p>
        <p>Тел: 02/ 3123-456</p>
      </div>

      <div className="border-t border-b border-dashed py-2 mb-2">
        <div className="flex justify-between">
          <span>Маса: {order.tableId}</span>
          <span>Нарачка: #{order.id.slice(-4)}</span>
        </div>
        <div>Датум: {new Date(order.createdAt).toLocaleString('mk-MK')}</div>
        <div>Келнер: {order.waiterId}</div>
      </div>

      <div className="mb-4">
        <div className="flex justify-between font-bold mb-1">
          <span className="w-1/2">Артикал</span>
          <span className="w-1/6 text-right">Кол.</span>
          <span className="w-1/3 text-right">Цена</span>
        </div>
        {order.items.map((item, i) => {
          const menuItem = menu.find(m => m.id === item.menuItemId);
          return (
            <div key={i} className="flex justify-between">
              <span className="w-1/2 truncate">{menuItem?.name || 'Непознато'}</span>
              <span className="w-1/6 text-right">{item.quantity}</span>
              <span className="w-1/3 text-right">{(item.price * item.quantity).toFixed(2)}</span>
            </div>
          );
        })}
      </div>

      <div className="border-t border-dashed pt-2 space-y-1">
        <div className="flex justify-between">
          <span>Основица 18%:</span>
          <span>{(total - tax).toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>ДДВ 18%:</span>
          <span>{tax.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-lg font-bold border-t border-black pt-1 mt-1">
          <span>ВКУПНО:</span>
          <span>{total.toFixed(2)} ден.</span>
        </div>
      </div>

      <div className="text-center mt-6">
        <p>БЛАГОДАРИМЕ НА ПОСЕТАТА!</p>
        <div className="mt-2 text-[10px]">
          <p>ФИСКАЛНА СМЕТКА</p>
          <p>************************</p>
        </div>
      </div>
    </div>
  );
};

export default FiscalReceipt;
