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
      case 'paid': return 'text-emerald-400 bg-emerald-900/20';
      case 'cancelled': return 'text-red-400 bg-red-900/20';
      case 'open': return 'text-accent-light bg-accent/10';
      default: return 'text-cream-faint bg-surface-2';
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
          <h1 className="text-2xl md:text-3xl font-black text-cream tracking-tight flex items-center gap-3">
            <div className="p-2 bg-accent text-[#faf5ee] rounded-btn">
              <ShoppingBag size={20} />
            </div>
            НАРАЧКИ
          </h1>
          <p className="text-cream-faint font-medium mt-1 text-sm">Преглед на сите деловни трансакции</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-cream-faint group-focus-within:text-cream transition-colors" size={18} />
            <input
              type="text"
              placeholder="Пребарај нарачка..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-11 pr-6 py-3 bg-surface border border-warm-line rounded-2xl w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/50 transition-all shadow-card-sm font-medium text-cream placeholder:text-cream-faint"
            />
          </div>

          <div className="flex bg-surface rounded-2xl p-1 border border-warm-line shadow-card-sm">
            {(['all', 'paid', 'open'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`flex-1 px-3 sm:px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${
                  filterStatus === status
                    ? 'bg-accent text-[#faf5ee] shadow-card-sm'
                    : 'text-cream-muted hover:bg-surface-2/50'
                }`}
              >
                {status === 'all' ? 'Сите' : status === 'paid' ? 'Платени' : 'Отворени'}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-8 items-start">
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
                className={`group bg-surface p-5 rounded-[2rem] border border-warm-line shadow-card hover:shadow-card-lg hover:border-warm-line-strong transition-all cursor-pointer relative overflow-hidden ${
                  selectedOrder?.id === order.id ? 'ring-2 ring-accent border-transparent' : ''
                }`}
              >
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-surface-2 flex items-center justify-center text-cream-faint group-hover:bg-accent group-hover:text-[#faf5ee] transition-all duration-500">
                      <Receipt size={24} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-cream font-black">#{order.id.slice(-6).toUpperCase()}</span>
                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${getStatusColor(order.status)}`}>
                          {getStatusIcon(order.status)}
                          {order.status}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-cream-faint font-medium tracking-tight">
                        <span className="flex items-center gap-1"><Calendar size={14} /> {new Date(order.createdAt).toLocaleDateString('mk-MK')}</span>
                        <span className="flex items-center gap-1"><Clock size={14} /> {new Date(order.createdAt).toLocaleTimeString('mk-MK', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xl font-black text-cream">{order.totalAmount} ден.</div>
                    <div className="text-xs font-bold text-cream-faint uppercase tracking-widest mt-1">Вкупно</div>
                  </div>
                </div>

                <div className="absolute top-0 right-0 w-32 h-32 bg-accent/[0.03] rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700"></div>
              </motion.div>
            ))}
          </AnimatePresence>

          {filteredOrders.length === 0 && (
            <div className="text-center py-20 bg-surface rounded-[3rem] border border-dashed border-warm-line">
              <div className="w-20 h-20 bg-surface-2 rounded-full flex items-center justify-center mx-auto mb-4 text-cream-faint">
                <Search size={32} />
              </div>
              <h3 className="text-xl font-black text-cream">Нема пронајдени нарачки</h3>
              <p className="text-cream-faint font-medium">Обидете се со поинаков термин на пребарување</p>
            </div>
          )}
        </div>

        <div className="bg-surface rounded-[2rem] xl:rounded-[2.5rem] border border-warm-line p-4 md:p-8 shadow-card-lg xl:sticky xl:top-8">
          {selectedOrder ? (
            <div className="space-y-5 md:space-y-8">
              <div className="pb-4 md:pb-6 border-b border-warm-line">
                <h3 className="text-lg md:text-2xl font-black text-cream">ДЕТАЛИ ЗА НАРАЧКА</h3>
                <p className="text-cream-faint font-bold uppercase tracking-widest text-[10px] mt-1">Идентификатор: {selectedOrder.id}</p>
              </div>

              <div className="space-y-4">
                {selectedOrder.items.map((item, i) => (
                  <div key={i} className="flex justify-between items-start py-3 border-b border-warm-line/50 last:border-0">
                    <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-xl bg-surface-2 flex items-center justify-center text-xs font-black text-cream">
                        {item.quantity}x
                      </div>
                      <div>
                        <p className="font-bold text-cream leading-none mb-1">{item.name}</p>
                        <p className="text-xs text-cream-faint font-medium">Цена по парче: {item.price} ден.</p>
                      </div>
                    </div>
                    <div className="text-sm font-black text-cream">
                      {item.quantity * item.price} ден.
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 md:p-6 bg-surface-2/50 rounded-2xl md:rounded-3xl space-y-3">
                <div className="flex justify-between text-sm font-medium text-cream-faint">
                  <span>Меѓутотал</span>
                  <span>{selectedOrder.totalAmount} ден.</span>
                </div>
                <div className="flex justify-between text-sm font-medium text-cream-faint">
                  <span>ДДВ (18%)</span>
                  <span>{(selectedOrder.totalAmount * 0.18).toFixed(0)} ден.</span>
                </div>
                <div className="pt-3 border-t border-warm-line-strong flex justify-between items-center">
                  <span className="text-base md:text-lg font-black text-cream uppercase tracking-tight">Вкупно</span>
                  <span className="text-xl md:text-2xl font-black text-cream">{selectedOrder.totalAmount} ден.</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <button className="w-full h-14 bg-accent text-[#faf5ee] rounded-2xl font-black uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-card">
                  <Receipt size={20} />
                  ПЕЧАТИ РАЧУН
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-24 h-24 bg-surface-2 rounded-full flex items-center justify-center mb-6 text-cream-faint">
                <Receipt size={40} />
              </div>
              <h3 className="text-lg font-black text-cream">ИЗБЕРЕТЕ НАРАЧКА</h3>
              <p className="text-cream-faint font-medium mt-2 px-6">Изберете нарачка од листата за да ги видите деталните информации и ставки</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrdersView;
