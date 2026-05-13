import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Order } from '../types';
import { 
  ShoppingBag, 
  Search, 
  Calendar, 
  Clock, 
  User, 
  ChevronRight,
  Filter,
  CheckCircle2,
  Clock3,
  XCircle,
  Receipt
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const OrdersView: React.FC = () => {
  const { orders, fetchOrders } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'open' | 'cancelled'>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (!orders || orders.length === 0) {
      fetchOrders();
    }
  }, [orders, fetchOrders]);

  const filteredOrders = (orders || [])
    .filter(order => {
      const matchesSearch = order.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          order.items.some(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesStatus = filterStatus === 'all' || order.status === filterStatus;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20';
      case 'cancelled': return 'text-red-500 bg-red-50 dark:bg-red-900/20';
      case 'open': return 'text-blue-500 bg-blue-50 dark:bg-blue-900/20';
      default: return 'text-zinc-500 bg-zinc-50 dark:bg-zinc-900/20';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': return <CheckCircle2 size={14} />;
      case 'cancelled': return <XCircle size={14} />;
      default: return <Clock3 size={14} />;
    }
  };

  return (
    <div className="space-y-4 md:space-y-8 pb-10 md:pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-3">
            <div className="p-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl">
              <ShoppingBag size={20} />
            </div>
            НАРАЧКИ
          </h1>
          <p className="text-zinc-500 font-medium mt-1 text-sm">Преглед на сите деловни трансакции</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-zinc-900 dark:group-focus-within:text-zinc-100 transition-colors" size={18} />
            <input
              type="text"
              placeholder="Пребарај нарачка..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-11 pr-6 py-3 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all shadow-sm font-medium"
            />
          </div>

          <div className="flex bg-white dark:bg-zinc-900 rounded-2xl p-1 border border-zinc-100 dark:border-zinc-800 shadow-sm">
            {(['all', 'paid', 'open'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`flex-1 px-3 sm:px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${
                  filterStatus === status
                    ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-md'
                    : 'text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                }`}
              >
                {status === 'all' ? 'Сите' : status === 'paid' ? 'Платени' : 'Отворени'}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-8 items-start">
        {/* Orders List */}
        <div className="xl:col-span-2 space-y-4">
          <AnimatePresence mode="popLayout">
            {filteredOrders.map((order, index) => (
              <motion.div
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.05 }}
                key={order.id}
                onClick={() => setSelectedOrder(order)}
                className={`group bg-white dark:bg-zinc-900 p-5 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 shadow-sm hover:shadow-xl hover:border-zinc-900 dark:hover:border-zinc-100 transition-all cursor-pointer relative overflow-hidden ${
                  selectedOrder?.id === order.id ? 'ring-2 ring-zinc-900 dark:ring-zinc-100 border-transparent' : ''
                }`}
              >
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:bg-zinc-900 group-hover:text-white dark:group-hover:bg-zinc-100 dark:group-hover:text-zinc-900 transition-all duration-500">
                      <Receipt size={24} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-900 dark:text-zinc-100 font-black">#{order.id.slice(-6).toUpperCase()}</span>
                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${getStatusColor(order.status)}`}>
                          {getStatusIcon(order.status)}
                          {order.status}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-zinc-500 font-medium tracking-tight">
                        <span className="flex items-center gap-1"><Calendar size={14} /> {new Date(order.createdAt).toLocaleDateString('mk-MK')}</span>
                        <span className="flex items-center gap-1"><Clock size={14} /> {new Date(order.createdAt).toLocaleTimeString('mk-MK', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xl font-black text-zinc-900 dark:text-zinc-100">{order.totalAmount} ден.</div>
                    <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1">Вкупно</div>
                  </div>
                </div>
                
                <div className="absolute top-0 right-0 w-32 h-32 bg-zinc-900/[0.02] dark:bg-white/[0.02] rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700"></div>
              </motion.div>
            ))}
          </AnimatePresence>

          {filteredOrders.length === 0 && (
            <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-[3rem] border border-dashed border-zinc-200 dark:border-zinc-800">
              <div className="w-20 h-20 bg-zinc-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4 text-zinc-300">
                <Search size={32} />
              </div>
              <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100">Нема пронајдени нарачки</h3>
              <p className="text-zinc-500 font-medium">Обидете се со поинаков термин на пребарување</p>
            </div>
          )}
        </div>

        {/* Order Details Sidebar */}
        <div className="bg-white dark:bg-zinc-900 rounded-[2rem] xl:rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 p-4 md:p-8 shadow-xl xl:sticky xl:top-8">
          {selectedOrder ? (
            <div className="space-y-5 md:space-y-8">
              <div className="pb-4 md:pb-6 border-b border-zinc-100 dark:border-zinc-800">
                <h3 className="text-lg md:text-2xl font-black text-zinc-900 dark:text-zinc-100">ДЕТАЛИ ЗА НАРАЧКА</h3>
                <p className="text-zinc-500 font-bold uppercase tracking-widest text-[10px] mt-1">Идентификатор: {selectedOrder.id}</p>
              </div>

              <div className="space-y-4">
                {selectedOrder.items.map((item, i) => (
                  <div key={i} className="flex justify-between items-start py-3 border-b border-zinc-50 dark:border-zinc-800/50 last:border-0">
                    <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-xs font-black text-zinc-900 dark:text-zinc-100">
                        {item.quantity}x
                      </div>
                      <div>
                        <p className="font-bold text-zinc-900 dark:text-zinc-100 leading-none mb-1">{item.name}</p>
                        <p className="text-xs text-zinc-500 font-medium">Цена по парче: {item.price} ден.</p>
                      </div>
                    </div>
                    <div className="text-sm font-black text-zinc-900 dark:text-zinc-100">
                      {item.quantity * item.price} ден.
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 md:p-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl md:rounded-3xl space-y-3">
                <div className="flex justify-between text-sm font-medium text-zinc-500">
                  <span>Меѓутотал</span>
                  <span>{selectedOrder.totalAmount} ден.</span>
                </div>
                <div className="flex justify-between text-sm font-medium text-zinc-500">
                  <span>ДДВ (18%)</span>
                  <span>{(selectedOrder.totalAmount * 0.18).toFixed(0)} ден.</span>
                </div>
                <div className="pt-3 border-t border-zinc-200 dark:border-zinc-700 flex justify-between items-center">
                  <span className="text-base md:text-lg font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">Вкупно</span>
                  <span className="text-xl md:text-2xl font-black text-zinc-900 dark:text-zinc-100">{selectedOrder.totalAmount} ден.</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <button className="w-full h-14 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-2xl font-black uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-lg shadow-zinc-200 dark:shadow-none">
                  <Receipt size={20} />
                  ПЕЧАТИ РАЧУН
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-24 h-24 bg-zinc-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-6 text-zinc-200">
                <Receipt size={40} />
              </div>
              <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-100">ИЗБЕРЕТЕ НАРАЧКА</h3>
              <p className="text-zinc-500 font-medium mt-2 px-6">Изберете нарачка од листата за да ги видите деталните информации и ставки</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrdersView;
