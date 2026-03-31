import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Plus, 
  Search, 
  Calendar, 
  Truck, 
  CheckCircle2, 
  XCircle, 
  Clock,
  ChevronRight,
  X,
  Save,
  Trash2,
  Package
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { supplierService } from '../../services/supplierService';
import { PurchaseOrder } from '../../types';
import { toast } from 'sonner';
import { format } from 'date-fns';

const PurchaseOrdersPage = () => {
  const { t } = useTranslation();
  const { activeRestaurant, purchaseOrders, suppliers, products, fetchPurchaseOrders, fetchSuppliers, fetchProducts, loading } = useStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<Omit<PurchaseOrder, 'id' | 'restaurantId' | 'createdAt'>>({
    supplierId: '',
    supplierName: '',
    orderDate: new Date().toISOString(),
    expectedDate: '',
    items: [],
    totalCost: 0,
    status: 'draft',
    notes: ''
  });

  useEffect(() => {
    if (activeRestaurant) {
      fetchPurchaseOrders();
      fetchSuppliers();
      fetchProducts();
    }
  }, [activeRestaurant, fetchPurchaseOrders, fetchSuppliers, fetchProducts]);

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        { productId: '', productName: '', quantity: 1, unitPrice: 0, total: 0 }
      ]
    });
  };

  const handleRemoveItem = (index: number) => {
    const newItems = [...formData.items];
    newItems.splice(index, 1);
    const totalCost = newItems.reduce((sum, item) => sum + item.total, 0);
    setFormData({ ...formData, items: newItems, totalCost });
  };

  const handleItemChange = (index: number, field: string, value: string | number) => {
    const newItems = [...formData.items];
    const item = { ...newItems[index] };

    if (field === 'productId') {
      const product = products.find(p => p.id === value);
      if (product) {
        item.productId = product.id;
        item.productName = product.name;
        item.unitPrice = product.purchasePrice;
      }
    } else if (field === 'quantity') {
      item.quantity = Number(value);
    } else if (field === 'unitPrice') {
      item.unitPrice = Number(value);
    }

    item.total = item.quantity * item.unitPrice;
    newItems[index] = item;
    
    const totalCost = newItems.reduce((sum, item) => sum + item.total, 0);
    setFormData({ ...formData, items: newItems, totalCost });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRestaurant) return;
    if (formData.items.length === 0) {
      toast.error(t('please_add_at_least_one_item'));
      return;
    }

    try {
      const supplier = suppliers.find(s => s.id === formData.supplierId);
      await supplierService.createPurchaseOrder({
        ...formData,
        restaurantId: activeRestaurant.id,
        supplierName: supplier?.name || '',
        createdAt: new Date().toISOString()
      });
      toast.success(t('purchase_order_created_success'));
      setIsModalOpen(false);
      fetchPurchaseOrders();
    } catch (error) {
      console.error('Error creating purchase order:', error);
      toast.error(t('error_creating_purchase_order'));
    }
  };

  const handleUpdateStatus = async (id: string, status: PurchaseOrder['status']) => {
    try {
      await supplierService.updatePurchaseOrderStatus(id, status);
      toast.success(t('status_updated_success'));
      fetchPurchaseOrders();
    } catch {
      toast.error(t('error_updating_status'));
    }
  };

  const getStatusBadge = (status: PurchaseOrder['status']) => {
    switch (status) {
      case 'draft':
        return <span className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold uppercase tracking-wider"><Clock size={12} /> {t('draft')}</span>;
      case 'ordered':
        return <span className="flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-600 rounded-full text-xs font-bold uppercase tracking-wider"><Truck size={12} /> {t('ordered')}</span>;
      case 'received':
        return <span className="flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-600 rounded-full text-xs font-bold uppercase tracking-wider"><CheckCircle2 size={12} /> {t('received')}</span>;
      case 'cancelled':
        return <span className="flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-600 rounded-full text-xs font-bold uppercase tracking-wider"><XCircle size={12} /> {t('cancelled')}</span>;
      default:
        return null;
    }
  };

  const filteredOrders = purchaseOrders.filter(o => 
    o.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t('purchase_orders')}</h1>
          <p className="text-slate-500">{t('manage_your_supplier_orders')}</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
        >
          <Plus size={20} />
          {t('create_order')}
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder={t('search_orders')}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 text-slate-500 text-sm font-semibold uppercase tracking-wider">
                <th className="px-6 py-4 border-b border-slate-200">{t('order_info')}</th>
                <th className="px-6 py-4 border-b border-slate-200">{t('supplier')}</th>
                <th className="px-6 py-4 border-b border-slate-200">{t('total')}</th>
                <th className="px-6 py-4 border-b border-slate-200">{t('status')}</th>
                <th className="px-6 py-4 border-b border-slate-200 text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading.purchaseOrders ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex justify-center">
                      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    {t('no_orders_found')}
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">#{order.id.slice(-6).toUpperCase()}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                        <Calendar size={12} />
                        {format(new Date(order.orderDate), 'dd.MM.yyyy')}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-700">
                      {order.supplierName}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900">
                      {order.totalCost.toLocaleString()} ден.
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(order.status)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {order.status === 'draft' && (
                          <button 
                            onClick={() => handleUpdateStatus(order.id, 'ordered')}
                            className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-all"
                          >
                            {t('mark_as_ordered')}
                          </button>
                        )}
                        {order.status === 'ordered' && (
                          <button 
                            onClick={() => handleUpdateStatus(order.id, 'received')}
                            className="px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-xs font-bold hover:bg-green-100 transition-all"
                          >
                            {t('mark_as_received')}
                          </button>
                        )}
                        <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                          <ChevronRight size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-900">{t('create_purchase_order')}</h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t('supplier')} *</label>
                  <select 
                    required
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    value={formData.supplierId}
                    onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                  >
                    <option value="">{t('select_supplier')}</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t('expected_delivery_date')}</label>
                  <input 
                    type="date"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    value={formData.expectedDate}
                    onChange={(e) => setFormData({ ...formData, expectedDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    <Package size={18} className="text-blue-600" />
                    {t('order_items')}
                  </h3>
                  <button 
                    type="button"
                    onClick={handleAddItem}
                    className="flex items-center gap-1 text-sm font-bold text-blue-600 hover:text-blue-700"
                  >
                    <Plus size={16} />
                    {t('add_item')}
                  </button>
                </div>

                <div className="space-y-3">
                  {formData.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-3 items-end bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div className="col-span-5">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t('product')}</label>
                        <select 
                          required
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          value={item.productId}
                          onChange={(e) => handleItemChange(index, 'productId', e.target.value)}
                        >
                          <option value="">{t('select_product')}</option>
                          {products.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t('qty')}</label>
                        <input 
                          type="number"
                          required
                          min="1"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t('price')}</label>
                        <input 
                          type="number"
                          required
                          min="0"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          value={item.unitPrice}
                          onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)}
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t('total')}</label>
                        <div className="px-3 py-2 text-sm font-bold text-slate-700">
                          {item.total.toLocaleString()}
                        </div>
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <button 
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t('notes')}</label>
                <textarea 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                  rows={2}
                  placeholder={t('order_notes_placeholder')}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
            </form>

            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="text-slate-600">
                <span className="text-sm">{t('total_cost')}:</span>
                <span className="ml-2 text-2xl font-black text-slate-900">{formData.totalCost.toLocaleString()} ден.</span>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-all"
                >
                  {t('cancel')}
                </button>
                <button 
                  onClick={handleSubmit}
                  className="flex items-center justify-center gap-2 bg-blue-600 text-white px-8 py-2.5 rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
                >
                  <Save size={20} />
                  {t('create_order')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrdersPage;
