import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  Plus,
  ClipboardList,
  CheckCircle2,
  X,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  FileText,
  Calendar,
  History
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useStore } from '../../store/useStore';
import { inventoryCheckService } from '../../services/inventoryService';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const InventoryCheck = () => {
  const { inventoryChecks, products, loading, fetchInventoryChecks, fetchProducts } = useStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (!inventoryChecks.length) fetchInventoryChecks();
    if (!products.length) fetchProducts();
  }, [inventoryChecks.length, products.length, fetchInventoryChecks, fetchProducts]);

  const [items, setItems] = useState<{ productId: string, systemQty: number, realQty: number }[]>([]);

  const handleStartCheck = () => {
    setItems(products.map(p => ({
      productId: p.id,
      systemQty: p.currentStock,
      realQty: p.currentStock
    })));
    setIsModalOpen(true);
  };

  const handleQtyChange = (index: number, value: number) => {
    const newItems = [...items];
    newItems[index].realQty = value;
    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await inventoryCheckService.create({
        items: items.map(item => ({
          productId: item.productId,
          systemQty: item.systemQty,
          realQty: item.realQty,
          diff: item.realQty - item.systemQty
        }))
      });

      toast.success(t('success_inventory_check'));
      setIsModalOpen(false);
      fetchInventoryChecks();
      fetchProducts();
    } catch {
      toast.error(t('error'));
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-serif italic text-cream tracking-tight">{t('inventory_check')}</h2>
          <p className="text-cream-muted font-medium">{t('stock_reconciliation')}</p>
        </div>
        <button onClick={handleStartCheck} className="btn btn-primary">
          <Plus size={20} />
          {t('new_inventory_check')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {inventoryChecks.map((check) => (
          <div key={check.id} className="card p-6 flex flex-col gap-4 hover:shadow-card-lg transition-all group">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-amber-900/20 text-amber-400 flex items-center justify-center">
                <ClipboardList size={24} />
              </div>
              <span className="status-badge status-completed">
                {t('completed')}
              </span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-cream mb-1 flex items-center gap-2">
                <Calendar size={16} className="text-cream-faint" />
                {new Date(check.date).toLocaleDateString()}
              </h3>
              <p className="text-sm font-medium text-cream-muted">
                {check.items.filter(i => i.diff !== 0).length} {t('differences_found')}
              </p>
            </div>
            <div className="pt-4 border-t border-warm-line flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-cream-faint uppercase tracking-widest">{t('surplus')}</span>
                  <span className="text-sm font-bold text-emerald-400">
                    +{check.items.reduce((acc, i) => acc + (i.diff > 0 ? i.diff : 0), 0)}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-cream-faint uppercase tracking-widest">{t('deficit')}</span>
                  <span className="text-sm font-bold text-rose-400">
                    {check.items.reduce((acc, i) => acc + (i.diff < 0 ? i.diff : 0), 0)}
                  </span>
                </div>
              </div>
              <button className="p-2 text-cream-faint hover:text-accent-light hover:bg-accent/10 rounded-lg transition-all">
                <FileText size={20} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {inventoryChecks.length === 0 && !loading.inventoryChecks && (
        <div className="flex flex-col items-center justify-center py-20 text-cream-faint">
          <History size={64} className="mb-4 opacity-10" />
          <p className="text-lg font-medium">{t('no_checks_found')}</p>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-base/80 backdrop-blur-sm">
          <div className="bg-surface border border-warm-line w-full max-w-5xl rounded-2xl shadow-card-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-8 py-6 border-b border-warm-line flex items-center justify-between bg-surface-2/50 shrink-0">
              <h3 className="text-xl font-serif italic text-cream">{t('new_inventory_check')}</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-cream-faint hover:bg-surface-2 hover:text-cream rounded-full transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8">
              <div className="mb-8 p-4 bg-amber-900/20 border border-amber-700/30 rounded-2xl flex items-start gap-4">
                <AlertTriangle className="text-amber-400 shrink-0" size={24} />
                <div>
                  <h4 className="font-bold text-amber-300">{t('important_note')}</h4>
                  <p className="text-sm text-amber-400/80">{t('inventory_check_warning')}</p>
                </div>
              </div>

              <div className="card overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-surface-2 border-b border-warm-line">
                      <th className="table-header">{t('product')}</th>
                      <th className="table-header text-right">{t('system_qty')}</th>
                      <th className="table-header text-center w-40">{t('real_qty')}</th>
                      <th className="table-header text-right">{t('difference')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-warm-line">
                    {items.map((item, index) => {
                      const product = products.find(p => p.id === item.productId);
                      const diff = item.realQty - item.systemQty;
                      return (
                        <tr key={item.productId} className="hover:bg-surface-2/50 transition-colors">
                          <td className="table-cell">
                            <p className="font-bold text-cream">{product?.name}</p>
                            <p className="text-xs text-cream-faint">{product?.unit}</p>
                          </td>
                          <td className="table-cell text-right font-medium text-cream-muted">
                            {item.systemQty}
                          </td>
                          <td className="table-cell">
                            <input
                              type="number"
                              className="input text-center font-bold"
                              value={item.realQty}
                              onChange={(e) => handleQtyChange(index, Number(e.target.value))}
                              required
                              step="0.001"
                            />
                          </td>
                          <td className="table-cell text-right">
                            {diff !== 0 ? (
                              <span className={cn(
                                "font-black flex items-center justify-end gap-1",
                                diff > 0 ? "text-emerald-400" : "text-rose-400"
                              )}>
                                {diff > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                {diff > 0 ? '+' : ''}{diff}
                              </span>
                            ) : (
                              <span className="text-cream-faint">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-10 flex items-center justify-end gap-3 pt-6 border-t border-warm-line">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
                  {t('cancel')}
                </button>
                <button type="submit" className="btn btn-primary px-10 py-4 text-lg">
                  <CheckCircle2 size={24} />
                  {t('complete_inventory_check')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryCheck;
