import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  Plus,
  FileText,
  Trash2,
  CheckCircle2,
  X,
  Calendar,
  Truck,
  Hash,
  ShoppingBag
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { cn } from '../../utils/cn';
import { invoiceService } from '../../services/inventoryService';

const Invoices = () => {
  const { invoices, products, loading, fetchInvoices, fetchProducts } = useStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (!invoices.length) fetchInvoices();
    if (!products.length) fetchProducts();
  }, [invoices.length, products.length, fetchInvoices, fetchProducts]);

  const [formData, setFormData] = useState({
    invoiceNumber: '',
    supplierName: '',
    date: new Date().toISOString().split('T')[0],
  });
  const [items, setItems] = useState<{ productId: string, quantity: number, price: number }[]>([]);

  const handleAddItem = () => {
    setItems([...items, { productId: '', quantity: 1, price: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: 'productId' | 'quantity' | 'price', value: string | number) => {
    const newItems = [...items];
    if (field === 'productId') {
      newItems[index].productId = value as string;
    } else {
      newItems[index][field] = value as number;
    }

    if (field === 'productId') {
      const product = products.find(p => p.id === value);
      if (product) {
        newItems[index].price = product.purchasePrice;
      }
    }

    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      toast.error(t('add_at_least_one_item'));
      return;
    }

    try {
      await invoiceService.create({ ...formData, items });

      toast.success(t('success_invoice_added'));
      setIsModalOpen(false);
      setItems([]);
      setFormData({
        invoiceNumber: '',
        supplierName: '',
        date: new Date().toISOString().split('T')[0],
      });
      fetchInvoices();
      fetchProducts();
    } catch (error: any) {
      console.error("Error creating invoice:", error);
      toast.error(error?.message ?? t('error'));
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-serif italic text-cream tracking-tight">{t('invoices')}</h2>
          <p className="text-cream-muted font-medium">{t('goods_receipt_management')}</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="btn btn-primary">
          <Plus size={20} />
          {t('new_invoice')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {invoices.map((invoice) => (
          <div key={invoice.id} className="card p-6 flex flex-col gap-4 hover:shadow-card-lg transition-all group">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-accent/10 text-accent-light flex items-center justify-center">
                <FileText size={24} />
              </div>
              <span className={cn(
                "status-badge",
                invoice.status === 'completed' ? "status-completed" : "status-draft"
              )}>
                {t(invoice.status)}
              </span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-cream mb-1">#{invoice.invoiceNumber}</h3>
              <p className="text-sm font-medium text-cream-muted flex items-center gap-2">
                <Truck size={14} />
                {invoice.supplierName}
              </p>
            </div>
            <div className="pt-4 border-t border-warm-line flex items-center justify-between">
              <div>
                <p className="text-xs text-cream-faint uppercase font-bold tracking-wider mb-1">{t('total')}</p>
                <p className="text-xl font-bold text-cream">{invoice.totalAmount.toLocaleString()} ден.</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-cream-faint uppercase font-bold tracking-wider mb-1">{t('date')}</p>
                <p className="text-sm font-medium text-cream-muted">{new Date(invoice.date).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {invoices.length === 0 && !loading.invoices && (
        <div className="flex flex-col items-center justify-center py-20 text-cream-faint">
          <FileText size={64} className="mb-4 opacity-10" />
          <p className="text-lg font-medium">{t('no_invoices_found')}</p>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-base/80 backdrop-blur-sm">
          <div className="bg-surface border border-warm-line w-full max-w-4xl rounded-2xl shadow-card-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-8 py-6 border-b border-warm-line flex items-center justify-between bg-surface-2/50 shrink-0">
              <h3 className="text-xl font-serif italic text-cream">{t('new_invoice')}</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-cream-faint hover:bg-surface-2 hover:text-cream rounded-full transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div>
                  <label className="block text-sm font-medium text-cream-muted mb-2">{t('invoice_number')}</label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-cream-faint" size={18} />
                    <input
                      type="text"
                      className="input pl-10"
                      value={formData.invoiceNumber}
                      onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-cream-muted mb-2">{t('supplier')}</label>
                  <div className="relative">
                    <Truck className="absolute left-3 top-1/2 -translate-y-1/2 text-cream-faint" size={18} />
                    <input
                      type="text"
                      className="input pl-10"
                      value={formData.supplierName}
                      onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-cream-muted mb-2">{t('date')}</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-cream-faint" size={18} />
                    <input
                      type="date"
                      className="input pl-10"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-bold text-cream flex items-center gap-2">
                    <ShoppingBag size={20} className="text-accent-light" />
                    {t('invoice_items')}
                  </h4>
                  <button type="button" onClick={handleAddItem} className="btn btn-secondary py-1.5 text-sm">
                    <Plus size={16} />
                    {t('add_item')}
                  </button>
                </div>

                <div className="space-y-3">
                  {items.map((item, index) => (
                    <div key={index} className="flex flex-col md:flex-row items-end gap-4 p-4 bg-surface-2 rounded-2xl border border-warm-line">
                      <div className="flex-1 w-full">
                        <label className="block text-xs font-medium text-cream-muted mb-1.5">{t('product')}</label>
                        <select
                          className="input"
                          value={item.productId}
                          onChange={(e) => handleItemChange(index, 'productId', e.target.value)}
                          required
                        >
                          <option value="">{t('select_product')}</option>
                          {products.map(p => (
                            <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
                          ))}
                        </select>
                      </div>
                      <div className="w-full md:w-32">
                        <label className="block text-xs font-medium text-cream-muted mb-1.5">{t('quantity')}</label>
                        <input
                          type="number"
                          className="input"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', Number(e.target.value))}
                          required
                          min="0.01"
                          step="0.01"
                        />
                      </div>
                      <div className="w-full md:w-40">
                        <label className="block text-xs font-medium text-cream-muted mb-1.5">{t('price')}</label>
                        <input
                          type="number"
                          className="input"
                          value={item.price}
                          onChange={(e) => handleItemChange(index, 'price', Number(e.target.value))}
                          required
                          min="0"
                        />
                      </div>
                      <div className="w-full md:w-40">
                        <label className="block text-xs font-medium text-cream-muted mb-1.5">{t('total')}</label>
                        <div className="input bg-warm-input flex items-center font-bold text-cream-muted">
                          {(item.quantity * item.price).toLocaleString()}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="p-2 text-rose-400 hover:bg-rose-900/20 rounded-lg transition-all"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  ))}

                  {items.length === 0 && (
                    <div className="text-center py-10 border-2 border-dashed border-warm-line rounded-2xl text-cream-faint">
                      <p>{t('no_items_added')}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-10 flex items-center justify-between p-6 bg-accent/10 rounded-2xl border border-accent/30">
                <div>
                  <p className="text-sm font-bold text-accent-light uppercase tracking-widest mb-1">{t('total_to_pay')}</p>
                  <p className="text-3xl font-black text-cream">
                    {items.reduce((acc, item) => acc + (item.quantity * item.price), 0).toLocaleString()} ден.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
                    {t('cancel')}
                  </button>
                  <button type="submit" className="btn btn-primary px-10 py-4 text-lg">
                    <CheckCircle2 size={24} />
                    {t('complete_receipt')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Invoices;
