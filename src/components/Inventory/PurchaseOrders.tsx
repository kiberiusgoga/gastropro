import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  ShoppingBag,
  Plus,
  Truck,
  Calendar,
  FileText,
  X,
  CheckCircle2,
  Trash2,
  Package,
} from 'lucide-react';
import { purchaseOrderService } from '../../services/purchaseOrderService';
import { useStore } from '../../store/useStore';
import { PurchaseOrder, Supplier } from '../../types';
import { format } from 'date-fns';

type PoItem = { productId: string; productName: string; quantity: number; unitPrice: number };
type ReceiveItem = { poItemId: string; productId: string; productName: string; quantity: number; price: number; expiryDate: string };

const PurchaseOrders = () => {
  const { t } = useTranslation();
  const { products, fetchProducts } = useStore();
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'orders' | 'suppliers'>('orders');

  // Create PO modal
  const [showCreatePO, setShowCreatePO] = useState(false);
  const [poForm, setPoForm] = useState({ supplierId: '', supplierName: '', expectedDate: '', notes: '' });
  const [poItems, setPoItems] = useState<PoItem[]>([{ productId: '', productName: '', quantity: 1, unitPrice: 0 }]);
  const [savingPO, setSavingPO] = useState(false);

  // Create supplier modal
  const [showCreateSupplier, setShowCreateSupplier] = useState(false);
  const [supplierForm, setSupplierForm] = useState({ name: '', contactPerson: '', email: '', phone: '' });
  const [savingSupplier, setSavingSupplier] = useState(false);

  // Receive modal
  const [receivingPO, setReceivingPO] = useState<PurchaseOrder | null>(null);
  const [receiveItems, setReceiveItems] = useState<ReceiveItem[]>([]);
  const [receivingLoading, setReceivingLoading] = useState(false);

  useEffect(() => {
    loadData();
    if (!products.length) fetchProducts();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [poData, supplierData] = await Promise.all([
        purchaseOrderService.getPOs(),
        purchaseOrderService.getSuppliers(),
      ]);
      setPos(poData);
      setSuppliers(supplierData);
    } catch {
      toast.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: PurchaseOrder['status']) => {
    switch (status) {
      case 'received':  return 'bg-green-100 text-green-700 border-green-200';
      case 'ordered':   return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'cancelled': return 'bg-red-100 text-red-700 border-red-200';
      default:          return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const poTotal = poItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  const handlePoItemChange = (idx: number, field: keyof PoItem, value: string | number) => {
    setPoItems(prev => {
      const next = [...prev];
      if (field === 'productId') {
        const product = products.find(p => p.id === value);
        next[idx] = {
          ...next[idx],
          productId: value as string,
          productName: product?.name ?? '',
          unitPrice: product?.purchasePrice ?? next[idx].unitPrice,
        };
      } else {
        (next[idx] as any)[field] = value;
      }
      return next;
    });
  };

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (poItems.some(i => !i.productId || i.quantity <= 0)) {
      toast.error(t('add_at_least_one_item'));
      return;
    }
    const supplier = suppliers.find(s => s.id === poForm.supplierId);
    if (!supplier) { toast.error(t('select_supplier')); return; }

    setSavingPO(true);
    try {
      await purchaseOrderService.createPO({
        supplierId: supplier.id,
        supplierName: supplier.name,
        orderDate: new Date().toISOString().split('T')[0],
        expectedDate: poForm.expectedDate || undefined,
        status: 'ordered',
        totalCost: poTotal,
        notes: poForm.notes || undefined,
        items: poItems.map(i => ({
          productId: i.productId,
          productName: i.productName,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          total: i.quantity * i.unitPrice,
        })),
      });
      toast.success(t('purchase_order_created_success'));
      setShowCreatePO(false);
      setPoForm({ supplierId: '', supplierName: '', expectedDate: '', notes: '' });
      setPoItems([{ productId: '', productName: '', quantity: 1, unitPrice: 0 }]);
      loadData();
    } catch {
      toast.error(t('error_creating_purchase_order'));
    } finally {
      setSavingPO(false);
    }
  };

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSupplier(true);
    try {
      await purchaseOrderService.createSupplier({
        name: supplierForm.name,
        contactPerson: supplierForm.contactPerson || undefined,
        email: supplierForm.email || undefined,
        phone: supplierForm.phone || undefined,
        active: true,
      });
      toast.success(t('supplier_created_success'));
      setShowCreateSupplier(false);
      setSupplierForm({ name: '', contactPerson: '', email: '', phone: '' });
      loadData();
    } catch {
      toast.error(t('error_saving_supplier'));
    } finally {
      setSavingSupplier(false);
    }
  };

  const openReceiveModal = (po: PurchaseOrder) => {
    setReceivingPO(po);
    setReceiveItems(po.items.map(item => ({
      poItemId: item.id ?? '',
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      price: item.unitPrice,
      expiryDate: '',
    })));
  };

  const handleReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receivingPO) return;
    setReceivingLoading(true);
    try {
      await purchaseOrderService.receivePO(receivingPO.id, {
        items: receiveItems
          .filter(i => i.poItemId)
          .map(i => ({
            purchase_order_item_id: i.poItemId,
            quantity: i.quantity,
            price: i.price,
            expiry_date: i.expiryDate || null,
          })),
      });
      toast.success(t('receive_po_success'));
      setReceivingPO(null);
      loadData();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? t('error');
      toast.error(msg);
    } finally {
      setReceivingLoading(false);
    }
  };

  const activeOrdersCount = pos.filter(po => po.status === 'ordered').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">{t('purchase_orders')}</h2>
          <p className="text-slate-500 font-medium">{t('manage_your_supplier_orders')}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-white border border-slate-200 rounded-xl flex p-1 shadow-sm">
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'orders' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              {t('inv_tab_purchase_orders')}
            </button>
            <button
              onClick={() => setActiveTab('suppliers')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'suppliers' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              {t('suppliers')}
            </button>
          </div>
          <button
            onClick={() => activeTab === 'orders' ? setShowCreatePO(true) : setShowCreateSupplier(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
          >
            <Plus size={20} />
            {activeTab === 'orders' ? t('create_purchase_order') : t('add_supplier')}
          </button>
        </div>
      </div>

      {activeTab === 'orders' ? (
        loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : pos.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 mx-auto mb-4">
              <ShoppingBag size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-900">{t('no_orders_found')}</h3>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">ID</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">{t('supplier')}</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">{t('date')}</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">{t('status')}</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">{t('total')}</th>
                  <th className="px-6 py-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {pos.map(po => (
                  <tr key={po.id} className="hover:bg-slate-50/50 transition-colors">
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
                        {t(po.status)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-black text-slate-900">{po.totalCost.toLocaleString()} ден.</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {po.status === 'ordered' && (
                        <button
                          onClick={() => openReceiveModal(po)}
                          className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-all"
                        >
                          {t('receive_po')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {suppliers.map(supplier => (
            <div key={supplier.id} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-start justify-between mb-6">
                <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                  <Truck size={28} />
                </div>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">{supplier.name}</h3>
              <p className="text-sm text-slate-500 mb-4">{supplier.contactPerson || t('no_data')}</p>
              <div className="space-y-2 mb-6">
                <div className="flex items-center gap-2 text-slate-600 text-sm">
                  <FileText size={14} className="text-slate-400" />
                  <span>{supplier.email || t('no_data')}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600 text-sm">
                  <Truck size={14} className="text-slate-400" />
                  <span>{supplier.phone || t('no_data')}</span>
                </div>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('ordered')}</span>
                <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold">
                  {pos.filter(po => po.supplierId === supplier.id && po.status === 'ordered').length}
                </span>
              </div>
            </div>
          ))}
          {suppliers.length === 0 && !loading && (
            <div className="col-span-3 flex flex-col items-center justify-center py-20 text-slate-400">
              <Truck size={64} className="mb-4 opacity-10" />
              <p className="text-lg font-medium">{t('no_suppliers_found')}</p>
            </div>
          )}
        </div>
      )}

      {/* Create PO Modal */}
      {showCreatePO && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
              <h3 className="text-xl font-bold text-slate-900">{t('create_purchase_order')}</h3>
              <button onClick={() => setShowCreatePO(false)} className="p-2 text-slate-400 hover:bg-white hover:text-slate-900 rounded-full transition-all shadow-sm">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreatePO} className="flex-1 overflow-y-auto p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="label">{t('supplier')}</label>
                  <select
                    className="input"
                    value={poForm.supplierId}
                    onChange={e => setPoForm({ ...poForm, supplierId: e.target.value })}
                    required
                  >
                    <option value="">{t('select_supplier')}</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">{t('expected_delivery_date')}</label>
                  <input
                    type="date"
                    className="input"
                    value={poForm.expectedDate}
                    onChange={e => setPoForm({ ...poForm, expectedDate: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="label mb-0">{t('po_items')}</label>
                  <button
                    type="button"
                    onClick={() => setPoItems(p => [...p, { productId: '', productName: '', quantity: 1, unitPrice: 0 }])}
                    className="text-blue-600 text-sm font-bold hover:text-blue-700 flex items-center gap-1"
                  >
                    <Plus size={16} />
                    {t('add_po_item')}
                  </button>
                </div>
                <div className="space-y-3">
                  {poItems.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-3 items-center">
                      <div className="col-span-5">
                        <select
                          className="input"
                          value={item.productId}
                          onChange={e => handlePoItemChange(idx, 'productId', e.target.value)}
                          required
                        >
                          <option value="">{t('select_product')}</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                      <div className="col-span-3">
                        <input
                          type="number"
                          className="input"
                          placeholder={t('quantity')}
                          min="0.001"
                          step="0.001"
                          value={item.quantity}
                          onChange={e => handlePoItemChange(idx, 'quantity', Number(e.target.value))}
                          required
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          type="number"
                          className="input"
                          placeholder={t('unit_price')}
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={e => handlePoItemChange(idx, 'unitPrice', Number(e.target.value))}
                          required
                        />
                      </div>
                      <div className="col-span-1 flex justify-center">
                        {poItems.length > 1 && (
                          <button type="button" onClick={() => setPoItems(p => p.filter((_, i) => i !== idx))} className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 text-right text-sm font-bold text-slate-900">
                  {t('total_cost')}: {poTotal.toLocaleString('mk-MK', { minimumFractionDigits: 2 })} ден.
                </div>
              </div>

              <div>
                <label className="label">{t('notes')}</label>
                <input
                  type="text"
                  className="input"
                  value={poForm.notes}
                  onChange={e => setPoForm({ ...poForm, notes: e.target.value })}
                  placeholder={t('no_note_placeholder')}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setShowCreatePO(false)} className="btn btn-secondary">{t('cancel')}</button>
                <button type="submit" className="btn btn-primary px-8" disabled={savingPO}>
                  <CheckCircle2 size={20} />
                  {t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Supplier Modal */}
      {showCreateSupplier && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-900">{t('add_supplier')}</h3>
              <button onClick={() => setShowCreateSupplier(false)} className="p-2 text-slate-400 hover:bg-white hover:text-slate-900 rounded-full transition-all shadow-sm">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateSupplier} className="p-8 space-y-4">
              <div>
                <label className="label">{t('company_name')}</label>
                <input
                  type="text"
                  className="input"
                  value={supplierForm.name}
                  onChange={e => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  placeholder={t('enter_company_name')}
                  required
                />
              </div>
              <div>
                <label className="label">{t('contact_person')}</label>
                <input
                  type="text"
                  className="input"
                  value={supplierForm.contactPerson}
                  onChange={e => setSupplierForm({ ...supplierForm, contactPerson: e.target.value })}
                  placeholder={t('enter_contact_person')}
                />
              </div>
              <div>
                <label className="label">{t('email')}</label>
                <input
                  type="email"
                  className="input"
                  value={supplierForm.email}
                  onChange={e => setSupplierForm({ ...supplierForm, email: e.target.value })}
                  placeholder={t('enter_email')}
                />
              </div>
              <div>
                <label className="label">{t('phone')}</label>
                <input
                  type="text"
                  className="input"
                  value={supplierForm.phone}
                  onChange={e => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                  placeholder={t('enter_phone')}
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setShowCreateSupplier(false)} className="btn btn-secondary">{t('cancel')}</button>
                <button type="submit" className="btn btn-primary px-8" disabled={savingSupplier}>
                  <CheckCircle2 size={20} />
                  {t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receive PO Modal */}
      {receivingPO && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
              <div>
                <h3 className="text-xl font-bold text-slate-900">{t('receive_po_title')}</h3>
                <p className="text-sm text-slate-500">{receivingPO.supplierName} · #{receivingPO.id.slice(-6).toUpperCase()}</p>
              </div>
              <button onClick={() => setReceivingPO(null)} className="p-2 text-slate-400 hover:bg-white hover:text-slate-900 rounded-full transition-all shadow-sm">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleReceive} className="flex-1 overflow-y-auto p-8 space-y-6">
              {receiveItems.length === 0 ? (
                <p className="text-slate-500 text-center py-8">{t('no_po_items')}</p>
              ) : (
                <div className="space-y-4">
                  {receiveItems.map((item, idx) => (
                    <div key={idx} className="bg-slate-50 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Package size={16} className="text-slate-400" />
                        <span className="font-bold text-slate-900">{item.productName}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="label">{t('quantity')}</label>
                          <input
                            type="number"
                            className="input"
                            min="0.001"
                            step="0.001"
                            value={item.quantity}
                            onChange={e => {
                              const next = [...receiveItems];
                              next[idx] = { ...next[idx], quantity: Number(e.target.value) };
                              setReceiveItems(next);
                            }}
                            required
                          />
                        </div>
                        <div>
                          <label className="label">{t('unit_price')}</label>
                          <input
                            type="number"
                            className="input"
                            min="0"
                            step="0.01"
                            value={item.price}
                            onChange={e => {
                              const next = [...receiveItems];
                              next[idx] = { ...next[idx], price: Number(e.target.value) };
                              setReceiveItems(next);
                            }}
                            required
                          />
                        </div>
                        <div>
                          <label className="label">{t('expiry_date')} ({t('optional')})</label>
                          <input
                            type="date"
                            className="input"
                            value={item.expiryDate}
                            onChange={e => {
                              const next = [...receiveItems];
                              next[idx] = { ...next[idx], expiryDate: e.target.value };
                              setReceiveItems(next);
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setReceivingPO(null)} className="btn btn-secondary">{t('cancel')}</button>
                <button type="submit" className="btn btn-primary px-8" disabled={receivingLoading || receiveItems.length === 0}>
                  <CheckCircle2 size={20} />
                  {t('complete_receipt')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrders;
