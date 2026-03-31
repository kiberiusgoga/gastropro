import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  MapPin, 
  Phone, 
  Clock, 
  User as UserIcon,
  Plus,
  Filter,
  ChevronRight,
  MoreVertical,
  CheckCircle2,
  Navigation,
  Package,
  AlertCircle
} from 'lucide-react';
import { deliveryService } from '../../services/deliveryService';
import { Driver, Order } from '../../types';
import { toast } from 'sonner';
import { format } from 'date-fns';

const DeliveryDashboard = () => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered'>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDriverModal, setShowDriverModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [driverData, orderData] = await Promise.all([
        deliveryService.getDrivers(),
        deliveryService.getDeliveryOrders()
      ]);
      setDrivers(driverData);
      setOrders(orderData);
    } catch (error) {
      console.error('Error loading delivery data:', error);
      toast.error('Грешка при вчитување на податоци за достава');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignDriver = async (driverId: string) => {
    if (!selectedOrder) return;
    
    try {
      await deliveryService.assignDriver(selectedOrder.id, driverId);
      toast.success('Возачот е успешно доделен');
      setShowDriverModal(false);
      setSelectedOrder(null);
      loadData();
    } catch (error) {
      console.error('Error assigning driver:', error);
      toast.error('Грешка при доделување на возач');
    }
  };

  const handleUpdateStatus = async (orderId: string, status: Order['deliveryStatus']) => {
    try {
      await deliveryService.updateDeliveryStatus(orderId, status);
      toast.success('Статусот е успешно ажуриран');
      loadData();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Грешка при ажурирање на статусот');
    }
  };

  const getStatusColor = (status: string | undefined) => {
    switch (status) {
      case 'delivered': return 'bg-green-100 text-green-700 border-green-200';
      case 'preparing': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'ready': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'out_for_delivery': return 'bg-orange-100 text-orange-700 border-orange-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusLabel = (status: string | undefined) => {
    switch (status) {
      case 'preparing': return 'Се подготвува';
      case 'ready': return 'Подготвено';
      case 'out_for_delivery': return 'На пат';
      case 'delivered': return 'Испорачано';
      default: return 'Непознато';
    }
  };

  const getDriverStatusColor = (status: Driver['status']) => {
    switch (status) {
      case 'available': return 'bg-green-500';
      case 'busy': return 'bg-orange-500';
      case 'offline': return 'bg-slate-400';
      default: return 'bg-slate-400';
    }
  };

  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true;
    return order.deliveryStatus === filter;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Достава</h1>
          <p className="text-slate-500">Управување со нарачки за достава и возачи</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-white border border-slate-200 rounded-xl flex p-1 overflow-x-auto">
            <button 
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${filter === 'all' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              Сите
            </button>
            <button 
              onClick={() => setFilter('preparing')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${filter === 'preparing' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              Подготовка
            </button>
            <button 
              onClick={() => setFilter('ready')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${filter === 'ready' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              Подготвени
            </button>
            <button 
              onClick={() => setFilter('out_for_delivery')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${filter === 'out_for_delivery' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              На пат
            </button>
            <button 
              onClick={() => setFilter('delivered')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${filter === 'delivered' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              Испорачани
            </button>
          </div>
          <button className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 shrink-0">
            <Filter size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Drivers Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Truck size={20} className="text-blue-600" />
                Возачи
              </h3>
              <button className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors">
                <Plus size={18} />
              </button>
            </div>

            <div className="space-y-3">
              {drivers.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">Нема активни возачи</p>
              ) : drivers.map(driver => (
                <div key={driver.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-200 transition-all cursor-pointer group">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 border border-slate-200">
                        <UserIcon size={20} />
                      </div>
                      <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 border-2 border-slate-50 rounded-full ${getDriverStatusColor(driver.status)}`}></div>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-slate-900 text-sm">{driver.name}</h4>
                      <p className="text-xs text-slate-500">{driver.phone}</p>
                    </div>
                    <ChevronRight size={16} className="text-slate-300 group-hover:text-blue-400 transition-colors" />
                  </div>
                  {driver.currentOrderId && (
                    <div className="mt-3 pt-3 border-t border-slate-200/50 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Нарачка во тек</span>
                      <span className="text-xs font-bold text-blue-600">#{driver.currentOrderId.slice(-4)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-3xl p-6 text-white shadow-lg shadow-blue-600/20">
            <h3 className="font-bold mb-2">Статистика за денес</h3>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <p className="text-blue-100 text-xs uppercase font-bold tracking-wider">Вкупно</p>
                <p className="text-2xl font-bold">{orders.length}</p>
              </div>
              <div>
                <p className="text-blue-100 text-xs uppercase font-bold tracking-wider">Испорачани</p>
                <p className="text-2xl font-bold">{orders.filter(o => o.deliveryStatus === 'delivered').length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Orders Main View */}
        <div className="lg:col-span-3 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 mx-auto mb-4">
                <Truck size={32} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Нема нарачки за достава</h3>
              <p className="text-slate-500 max-w-xs mx-auto mt-2">
                Сè уште нема активни нарачки за достава со овој филтер.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredOrders.map((order) => (
                <div key={order.id} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all group">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Нарачка</span>
                        <span className="text-sm font-bold text-slate-900">#{order.id.slice(-6).toUpperCase()}</span>
                      </div>
                      <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(order.deliveryStatus)}`}>
                        {getStatusLabel(order.deliveryStatus)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {order.deliveryStatus === 'ready' && !order.driverId && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-lg animate-pulse">
                          <AlertCircle size={12} />
                          ЧЕКА ВОЗАЧ
                        </span>
                      )}
                      <button className="p-2 hover:bg-slate-50 rounded-xl text-slate-400">
                        <MoreVertical size={20} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3 mb-5">
                    <div className="flex items-start gap-3">
                      <MapPin size={18} className="text-slate-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-bold text-slate-900">{order.deliveryAddress || 'Нема адреса'}</p>
                        <p className="text-xs text-slate-500">Скопје, Центар</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone size={18} className="text-slate-400 shrink-0" />
                      <p className="text-sm font-medium text-slate-700">{order.deliveryPhone || 'Нема телефон'}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock size={18} className="text-slate-400 shrink-0" />
                      <p className="text-sm font-medium text-slate-700">
                        Креирана во {format(new Date(order.createdAt), 'HH:mm')}
                      </p>
                    </div>
                    {order.driverId && (
                      <div className="flex items-center gap-3 pt-2 border-t border-slate-50">
                        <Navigation size={18} className="text-blue-500 shrink-0" />
                        <p className="text-sm font-bold text-slate-700">
                          Возач: {drivers.find(d => d.id === order.driverId)?.name || 'Доделен'}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Вкупно</span>
                      <span className="text-lg font-bold text-blue-600">{order.totalAmount.toLocaleString()} ден.</span>
                    </div>
                    
                    <div className="flex gap-2">
                      {!order.driverId && order.deliveryStatus === 'ready' && (
                        <button 
                          onClick={() => {
                            setSelectedOrder(order);
                            setShowDriverModal(true);
                          }}
                          className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 flex items-center gap-2"
                        >
                          <Truck size={16} />
                          Додели
                        </button>
                      )}
                      
                      {order.deliveryStatus === 'preparing' && (
                        <button 
                          onClick={() => handleUpdateStatus(order.id, 'ready')}
                          className="px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-bold hover:bg-purple-700 transition-all flex items-center gap-2"
                        >
                          <Package size={16} />
                          Подготвено
                        </button>
                      )}

                      {order.deliveryStatus === 'out_for_delivery' && (
                        <button 
                          onClick={() => handleUpdateStatus(order.id, 'delivered')}
                          className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 transition-all flex items-center gap-2"
                        >
                          <CheckCircle2 size={16} />
                          Испорачано
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Driver Assignment Modal */}
      {showDriverModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-900">Додели возач</h3>
              <button 
                onClick={() => setShowDriverModal(false)}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-400"
              >
                <Plus size={24} className="rotate-45" />
              </button>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {drivers.filter(d => d.status === 'available').length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 mx-auto mb-3">
                    <AlertCircle size={24} />
                  </div>
                  <p className="text-slate-500 font-medium">Нема слободни возачи во моментов</p>
                </div>
              ) : (
                drivers.filter(d => d.status === 'available').map(driver => (
                  <button
                    key={driver.id}
                    onClick={() => handleAssignDriver(driver.id)}
                    className="w-full flex items-center gap-4 p-4 bg-slate-50 hover:bg-blue-50 border border-slate-100 hover:border-blue-200 rounded-2xl transition-all text-left"
                  >
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-slate-400 border border-slate-200">
                      <UserIcon size={24} />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-slate-900">{driver.name}</h4>
                      <p className="text-sm text-slate-500">{driver.phone}</p>
                    </div>
                    <ChevronRight size={20} className="text-slate-300" />
                  </button>
                ))
              )}
            </div>

            <div className="mt-8 flex gap-3">
              <button 
                onClick={() => setShowDriverModal(false)}
                className="flex-1 px-6 py-3 border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-all"
              >
                Откажи
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryDashboard;
