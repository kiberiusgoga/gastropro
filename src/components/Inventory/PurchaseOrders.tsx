import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  Plus, 
  Truck, 
  Calendar, 
  MoreVertical,
  ChevronRight,
  FileText
} from 'lucide-react';
import { purchaseOrderService } from '../../services/purchaseOrderService';
import { PurchaseOrder, Supplier } from '../../types';
import { toast } from 'sonner';
import { format } from 'date-fns';

const PurchaseOrders = () => {
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'orders' | 'suppliers'>('orders');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [poData, supplierData] = await Promise.all([
        purchaseOrderService.getPOs(),
        purchaseOrderService.getSuppliers()
      ]);
      setPos(poData);
      setSuppliers(supplierData);
    } catch (error) {
      console.error('Error loading PO data:', error);
      toast.error('Грешка при вчитување на податоци');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: PurchaseOrder['status']) => {
    switch (status) {
      case 'received': return 'bg-green-100 text-green-700 border-green-200';
      case 'ordered': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'cancelled': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Набавки</h1>
          <p className="text-slate-500">Управување со добавувачи и нарачки за набавка</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-white border border-slate-200 rounded-xl flex p-1 shadow-sm">
            <button 
              onClick={() => setActiveTab('orders')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'orders' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              Нарачки
            </button>
            <button 
              onClick={() => setActiveTab('suppliers')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'suppliers' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              Добавувачи
            </button>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20">
            <Plus size={20} />
            {activeTab === 'orders' ? 'Нова Нарачка' : 'Нов Добавувач'}
          </button>
        </div>
      </div>

      {activeTab === 'orders' ? (
        <div className="grid grid-cols-1 gap-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : pos.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 mx-auto mb-4">
                <ShoppingBag size={32} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Нема нарачки за набавка</h3>
              <p className="text-slate-500 max-w-xs mx-auto mt-2">
                Сè уште немате креирано нарачки за набавка од добавувачи.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">ID</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Добавувач</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Датум</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Статус</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Вкупно</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {pos.map((po) => (
                    <tr key={po.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-slate-900">#{po.id.slice(-6).toUpperCase()}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                            <Truck size={16} />
                          </div>
                          <span className="text-sm font-bold text-slate-700">{po.supplierName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-slate-500 text-sm">
                          <Calendar size={14} />
                          {format(new Date(po.orderDate), 'dd.MM.yyyy')}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(po.status)}`}>
                          {po.status}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm font-black text-slate-900">{po.totalCost.toLocaleString()} ден.</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="p-2 hover:bg-white rounded-xl text-slate-400 hover:text-blue-600 transition-all border border-transparent hover:border-slate-100">
                          <ChevronRight size={20} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {suppliers.map(supplier => (
            <div key={supplier.id} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all group">
              <div className="flex items-start justify-between mb-6">
                <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                  <Truck size={28} />
                </div>
                <button className="p-2 hover:bg-slate-50 rounded-xl text-slate-400">
                  <MoreVertical size={20} />
                </button>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">{supplier.name}</h3>
              <p className="text-sm text-slate-500 mb-4">{supplier.contactPerson || 'Нема контакт лице'}</p>
              
              <div className="space-y-2 mb-6">
                <div className="flex items-center gap-2 text-slate-600 text-sm">
                  <FileText size={14} className="text-slate-400" />
                  <span>{supplier.email || 'Нема е-пошта'}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600 text-sm">
                  <Truck size={14} className="text-slate-400" />
                  <span>{supplier.phone || 'Нема телефон'}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Активни нарачки</span>
                <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold">3</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PurchaseOrders;
