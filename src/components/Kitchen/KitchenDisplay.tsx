import React, { useState, useEffect } from 'react';
import { Order, Table, OrderItem, PreparationStation, OrderPriority } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { printService } from '../../services/printService';
import { kdsService } from '../../services/kdsService';
import { tableService, posService } from '../../services/posService';
import { 
  Clock, 
  CheckCircle2, 
  ChefHat, 
  AlertCircle, 
  Filter, 
  Flame, 
  Wine, 
  IceCream, 
  UtensilsCrossed,
  Timer,
  Zap,
  Star,
  History,
  RotateCcw,
  Printer
} from 'lucide-react';

interface KitchenDisplayProps {
  orders?: Order[];
  tables?: Table[];
  onUpdateItemStatus?: (orderId: string, itemId: string, newStatus: OrderItem['status']) => void;
}

const KitchenDisplay: React.FC<KitchenDisplayProps> = ({ 
  orders: initialOrders, 
  tables: initialTables, 
  onUpdateItemStatus: initialOnUpdateItemStatus 
}) => {
  const [internalOrders, setInternalOrders] = useState<Order[]>([]);
  const [internalTables, setInternalTables] = useState<Table[]>([]);
  const [activeStation, setActiveStation] = useState<PreparationStation | 'all'>('all');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(!initialOrders || !initialTables);

  const orders = initialOrders || internalOrders;
  const tables = initialTables || internalTables;

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  // Subscribe to orders if not provided
  useEffect(() => {
    if (!initialOrders) {
      const unsubscribe = kdsService.subscribeToKitchenOrders((data) => {
        setInternalOrders(data);
        setLoading(false);
      });
      return () => unsubscribe();
    }
  }, [initialOrders]);

  // Fetch tables if not provided
  useEffect(() => {
    if (!initialTables) {
      const fetchTables = async () => {
        const data = await tableService.getAll();
        setInternalTables(data);
        setLoading(false);
      };
      fetchTables();
    }
  }, [initialTables]);

  const handleUpdateItemStatus = async (orderId: string, itemId: string, newStatus: OrderItem['status']) => {
    if (initialOnUpdateItemStatus) {
      initialOnUpdateItemStatus(orderId, itemId, newStatus);
    } else {
      await posService.updateOrderItemStatus(orderId, itemId, newStatus);
      // Local update for immediate feedback if needed, 
      // though subscription should handle it
      setInternalOrders(prev => prev.map(order => {
        if (order.id === orderId) {
          return {
            ...order,
            items: order.items.map(item => {
              if (item.id === itemId) {
                return { ...item, status: newStatus };
              }
              return item;
            })
          };
        }
        return order;
      }));
    }
  };

  const stations: { id: PreparationStation | 'all', label: string, icon: React.ElementType }[] = [
    { id: 'all', label: 'Сите', icon: Filter },
    { id: 'kitchen', label: 'Кујна', icon: ChefHat },
    { id: 'bar', label: 'Шанк', icon: Wine },
    { id: 'grill', label: 'Скара', icon: Flame },
    { id: 'dessert', label: 'Десерти', icon: IceCream },
    { id: 'salad', label: 'Салати', icon: UtensilsCrossed },
  ];

  const getFilteredOrders = () => {
    if (!orders) return [];
    return orders
      .filter(o => o.status !== 'paid' && o.status !== 'closed' && o.status !== 'cancelled')
      .map(order => ({
        ...order,
        items: order.items.filter(item => 
          activeStation === 'all' || item.preparationStation === activeStation
        )
      }))
      .filter(order => order.items.length > 0)
      .sort((a, b) => {
        // Sort by priority first, then by time
        const priorityScore = { 'VIP': 3, 'rush': 2, 'normal': 1 };
        const scoreA = priorityScore[a.priority || 'normal'];
        const scoreB = priorityScore[b.priority || 'normal'];
        if (scoreA !== scoreB) return scoreB - scoreA;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
  };

  const filteredOrders = getFilteredOrders();

  const getPriorityStyles = (priority?: OrderPriority) => {
    switch (priority) {
      case 'VIP': return 'bg-purple-600 text-white shadow-purple-200';
      case 'rush': return 'bg-red-600 text-white shadow-red-200 animate-pulse';
      default: return 'bg-blue-600 text-white shadow-blue-200';
    }
  };

  const getPriorityIcon = (priority?: OrderPriority) => {
    switch (priority) {
      case 'VIP': return <Star size={14} fill="currentColor" />;
      case 'rush': return <Zap size={14} fill="currentColor" />;
      default: return <Timer size={14} />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Се вчитуваат нарачки...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Station Tabs */}
      <div className="bg-white border-b border-slate-200 p-4 shrink-0">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {stations.map(station => (
            <button
              key={station.id}
              onClick={() => setActiveStation(station.id)}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl font-black uppercase text-xs tracking-widest transition-all border-2 ${
                activeStation === station.id 
                  ? 'bg-slate-900 border-slate-900 text-white shadow-lg shadow-slate-200' 
                  : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200'
              }`}
            >
              <station.icon size={16} />
              {station.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredOrders.map((order) => {
              const table = tables.find(t => t.id === order.tableId);
              const timeElapsed = Math.floor((currentTime.getTime() - new Date(order.createdAt).getTime()) / 60000);
              const isLate = timeElapsed > 15;

              return (
                <motion.div
                  key={order.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={`bg-white rounded-[2rem] border-2 shadow-sm overflow-hidden flex flex-col h-fit transition-all ${
                    isLate ? 'border-red-200 shadow-red-100' : 'border-slate-100'
                  }`}
                >
                  {/* Card Header */}
                  <div className={`p-5 flex justify-between items-start ${isLate ? 'bg-red-50' : 'bg-slate-50/50'}`}>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-tighter flex items-center gap-1 ${getPriorityStyles(order.priority)}`}>
                          {getPriorityIcon(order.priority)}
                          {order.priority || 'NORMAL'}
                        </span>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">#{order.id.slice(-4)}</span>
                      </div>
                      <h3 className="font-black text-2xl text-slate-900">
                        {order.orderType === 'dine_in' ? `МАСА ${table?.number || '?'}` : order.orderType === 'takeaway' ? 'ЗА НОСЕЊЕ' : 'ДОСТАВА'}
                      </h3>
                    </div>
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-sm ${isLate ? 'bg-red-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>
                      <Clock size={16} />
                      {timeElapsed}'
                    </div>
                    <button 
                      onClick={() => printService.printKitchenTickets(order)}
                      className="p-2 bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 rounded-xl transition-all ml-2"
                      title="Печати бон"
                    >
                      <Printer size={18} />
                    </button>
                  </div>

                  {/* Items List */}
                  <div className="p-5 space-y-3">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex flex-col gap-2 p-3 rounded-2xl bg-slate-50 border border-slate-100 group">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center text-sm font-black">
                              {item.quantity}
                            </span>
                            <div>
                              <h4 className="font-bold text-slate-900 leading-tight">{item.name}</h4>
                              {item.note && <p className="text-[10px] font-bold text-orange-600 uppercase mt-0.5 italic">! {item.note}</p>}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{item.preparationStation}</span>
                          </div>
                        </div>

                        {/* Item Actions */}
                        <div className="flex gap-1.5 mt-1">
                          {item.status === 'pending' || item.status === 'sent_to_kitchen' ? (
                            <button
                              onClick={() => handleUpdateItemStatus(order.id, item.id, 'preparing')}
                              className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-sm shadow-blue-100"
                            >
                              ЗАПОЧНИ
                            </button>
                          ) : item.status === 'preparing' ? (
                            <button
                              onClick={() => handleUpdateItemStatus(order.id, item.id, 'ready')}
                              className="flex-1 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-sm shadow-emerald-100 flex items-center justify-center gap-1"
                            >
                              <CheckCircle2 size={12} />
                              ГОТОВО
                            </button>
                          ) : (
                            <div className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-200 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest">
                              <CheckCircle2 size={12} />
                              СПРЕМНО
                              <button 
                                onClick={() => handleUpdateItemStatus(order.id, item.id, 'preparing')}
                                className="ml-2 p-1 hover:bg-slate-300 rounded-lg transition-colors"
                              >
                                <RotateCcw size={10} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Footer Actions */}
                  <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2">
                    <button className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all flex items-center justify-center gap-2">
                      <History size={14} />
                      ИСТОРИЈА
                    </button>
                    <button className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all flex items-center justify-center gap-2">
                      <AlertCircle size={14} />
                      ОДЛОЖИ
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {filteredOrders.length === 0 && (
            <div className="col-span-full py-40 flex flex-col items-center justify-center text-slate-300 gap-4">
              <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center">
                <ChefHat size={48} strokeWidth={1} />
              </div>
              <div className="text-center">
                <h2 className="text-xl font-black text-slate-400 uppercase tracking-widest">Кујната е празна</h2>
                <p className="text-sm font-medium text-slate-400">Нема активни нарачки за избраната станица.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KitchenDisplay;
