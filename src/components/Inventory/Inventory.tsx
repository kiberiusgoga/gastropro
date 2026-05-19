import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  Plus,
  Minus,
  AlertTriangle,
  CheckCircle2,
  X,
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Package
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { cn } from '../../utils/cn';
import { inventoryService } from '../../services/inventoryService';

const Inventory = () => {
  const { products, transactions, fetchProducts, fetchInventory } = useStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'input' | 'output'>('input');
  const { t } = useTranslation();

  useEffect(() => {
    if (!products.length) fetchProducts();
    if (!transactions.length) fetchInventory();
  }, [products.length, transactions.length, fetchProducts, fetchInventory]);

  const [formData, setFormData] = useState({
    productId: '',
    quantity: 0,
    note: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.quantity <= 0) {
      toast.error(t('invalid_quantity'));
      return;
    }

    try {
      await inventoryService.recordMovement({
        productId: formData.productId,
        type: modalType,
        quantity: formData.quantity,
        note: formData.note
      });

      toast.success(t('success_stock_update'));
      setIsModalOpen(false);
      setFormData({ productId: '', quantity: 0, note: '' });
      fetchProducts();
      fetchInventory();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      const message = err.response?.data?.error || err.message || t('error');
      toast.error(message);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-serif italic text-cream tracking-tight">{t('inventory')}</h2>
          <p className="text-cream-muted font-medium">{t('stock_movement_management')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setModalType('output'); setIsModalOpen(true); }}
            className="btn btn-secondary text-rose-400 border-rose-900/30 hover:bg-rose-900/20"
          >
            <Minus size={20} />
            {t('output')}
          </button>
          <button
            onClick={() => { setModalType('input'); setIsModalOpen(true); }}
            className="btn btn-primary"
          >
            <Plus size={20} />
            {t('input')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Current Stock List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6">
            <h3 className="text-lg font-bold text-cream mb-6 flex items-center gap-2">
              <Package size={20} className="text-accent-light" />
              {t('current_stock_state')}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-warm-line">
                    <th className="px-4 py-3 text-left text-xs font-bold text-cream-faint uppercase tracking-widest">{t('product')}</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-cream-faint uppercase tracking-widest">{t('unit')}</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-cream-faint uppercase tracking-widest">{t('current_stock')}</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-cream-faint uppercase tracking-widest">{t('status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-warm-line">
                  {products.map((product) => (
                    <tr key={product.id} className="hover:bg-surface-2/50 transition-colors">
                      <td className="px-4 py-4">
                        <p className="font-bold text-cream">{product.name}</p>
                        <p className="text-xs text-cream-faint font-mono">{product.barcode || '-'}</p>
                      </td>
                      <td className="px-4 py-4 text-sm text-cream-muted">{product.unit}</td>
                      <td className="px-4 py-4 text-right">
                        <span className={cn(
                          "font-black text-lg",
                          product.currentStock <= product.minStock ? "text-rose-400" : "text-cream"
                        )}>
                          {product.currentStock.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        {product.currentStock <= product.minStock ? (
                          <span className="status-badge bg-rose-500/15 text-rose-300 border-rose-500/30 inline-flex items-center gap-1">
                            <AlertTriangle size={12} />
                            {t('low_stock')}
                          </span>
                        ) : (
                          <span className="status-badge status-completed inline-flex items-center gap-1">
                            <CheckCircle2 size={12} />
                            {t('optimal')}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Movement History */}
        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="text-lg font-bold text-cream mb-6 flex items-center gap-2">
              <Activity size={20} className="text-accent-light" />
              {t('movement_history')}
            </h3>
            <div className="space-y-6">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-start gap-4 group">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110",
                    tx.type === 'input' || tx.type === 'receipt'
                      ? "bg-emerald-900/20 text-emerald-400"
                      : "bg-rose-900/20 text-rose-400"
                  )}>
                    {tx.type === 'input' || tx.type === 'receipt' ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-bold text-cream truncate">
                        {products.find(p => p.id === tx.productId)?.name || t('unknown')}
                      </p>
                      <span className="text-[10px] font-bold text-cream-faint uppercase tracking-widest">
                        {new Date(tx.date).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-cream-muted flex items-center gap-2">
                        <span className={cn(
                          "font-bold",
                          tx.type === 'input' || tx.type === 'receipt' ? "text-emerald-400" : "text-rose-400"
                        )}>
                          {tx.type === 'input' || tx.type === 'receipt' ? '+' : '-'}{tx.quantity}
                        </span>
                        • {t(tx.type)}
                      </p>
                      <p className="text-[10px] font-mono text-cream-faint">
                        {tx.previousStock} → {tx.newStock}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-base/80 backdrop-blur-sm">
          <div className="bg-surface border border-warm-line w-full max-w-md rounded-2xl shadow-card-lg overflow-hidden">
            <div className={cn(
              "px-8 py-6 border-b border-warm-line flex items-center justify-between",
              modalType === 'input' ? "bg-emerald-900/20" : "bg-rose-900/20"
            )}>
              <h3 className={cn(
                "text-xl font-serif italic",
                modalType === 'input' ? "text-emerald-400" : "text-rose-400"
              )}>
                {modalType === 'input' ? t('stock_input') : t('stock_output')}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-cream-faint hover:bg-surface-2 hover:text-cream rounded-full transition-all"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div>
                <label className="block text-sm font-medium text-cream-muted mb-2">{t('product')}</label>
                <select
                  className="input"
                  value={formData.productId}
                  onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                  required
                >
                  <option value="">{t('select_product')}</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-cream-muted mb-2">{t('quantity')}</label>
                <input
                  type="number"
                  className="input"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                  required
                  min="0.01"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-cream-muted mb-2">{t('note')}</label>
                <textarea
                  className="input min-h-[100px]"
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  placeholder={t('reason_for_change')}
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
                  {t('cancel')}
                </button>
                <button type="submit" className={cn(
                  "btn px-8",
                  modalType === 'input' ? "btn-primary" : "bg-rose-600 text-white hover:bg-rose-700"
                )}>
                  <CheckCircle2 size={20} />
                  {t('confirm')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
