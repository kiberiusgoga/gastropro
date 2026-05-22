import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Package, ChevronDown, Search } from 'lucide-react';
import apiClient from '../../lib/apiClient';
import { Warehouse } from '../Settings/WarehousesList';

type StockStatus = 'ok' | 'low_stock' | 'out_of_stock' | 'not_assigned';

interface WarehouseProduct {
  id: string;
  name: string;
  unit: string;
  purchase_price: number;
  selling_price: number;
  min_stock: number;
  category_id: string | null;
  warehouse_stock: number;
  stock_status: StockStatus;
}

const STATUS_CONFIG: Record<StockStatus, { cls: string; labelKey: string }> = {
  ok:           { cls: 'bg-emerald-500/15 text-emerald-300', labelKey: 'stock_ok' },
  low_stock:    { cls: 'bg-rose-500/15 text-rose-300',       labelKey: 'stock_low' },
  out_of_stock: { cls: 'bg-rose-500/15 text-rose-300',       labelKey: 'stock_out' },
  not_assigned: { cls: 'bg-cream-faint/15 text-cream-faint', labelKey: 'stock_not_assigned' },
};

const PerWarehouse: React.FC = () => {
  const { t } = useTranslation();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [products, setProducts] = useState<WarehouseProduct[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [loadingWh, setLoadingWh] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  useEffect(() => {
    const fetchInit = async () => {
      try {
        const [whRes, catRes] = await Promise.all([
          apiClient.get('/warehouses'),
          apiClient.get('/categories'),
        ]);
        const whs: Warehouse[] = whRes.data;
        setWarehouses(whs);
        setCategories(catRes.data);
        const main = whs.find(w => w.is_main) ?? whs[0];
        if (main) setSelectedWarehouseId(main.id);
      } finally {
        setLoadingWh(false);
      }
    };
    fetchInit();
  }, []);

  const fetchProducts = useCallback(async (whId: string) => {
    if (!whId) return;
    setLoadingProducts(true);
    try {
      const res = await apiClient.get(`/warehouses/${whId}/products`);
      setProducts(res.data);
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  useEffect(() => {
    if (selectedWarehouseId) fetchProducts(selectedWarehouseId);
  }, [selectedWarehouseId, fetchProducts]);

  const filtered = useMemo(() => {
    return products.filter(p => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (categoryFilter && p.category_id !== categoryFilter) return false;
      if (lowStockOnly && p.stock_status !== 'low_stock' && p.stock_status !== 'out_of_stock') return false;
      return true;
    });
  }, [products, search, categoryFilter, lowStockOnly]);

  const stats = useMemo(() => {
    const total = products.filter(p => p.stock_status !== 'not_assigned').length;
    const totalValue = products.reduce((acc, p) => acc + p.warehouse_stock * p.purchase_price, 0);
    const lowCount = products.filter(p => p.stock_status === 'low_stock' || p.stock_status === 'out_of_stock').length;
    return { total, totalValue, lowCount };
  }, [products]);

  const selectedWarehouse = warehouses.find(w => w.id === selectedWarehouseId);

  if (loadingWh) {
    return <div className="py-16 text-center text-cream-faint text-sm">{t('loading')}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Warehouse selector + header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <h3 className="text-xl font-serif italic text-cream">{selectedWarehouse?.name ?? '—'}</h3>
          {selectedWarehouse?.is_main && (
            <span className="text-xs text-accent-light font-medium">{t('main_warehouse_label')}</span>
          )}
        </div>
        <div className="relative">
          <select
            value={selectedWarehouseId}
            onChange={e => setSelectedWarehouseId(e.target.value)}
            className="appearance-none bg-warm-input border border-warm-line rounded-btn px-4 py-2.5 pr-10 text-cream text-sm font-medium focus:outline-none focus:border-accent/50 transition-all min-w-[200px]"
          >
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-cream-faint pointer-events-none" />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: t('products_count'), value: stats.total },
          { label: t('total_stock_value'), value: stats.totalValue.toLocaleString('mk-MK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ден.' },
          { label: t('low_stock_count'), value: stats.lowCount },
        ].map(({ label, value }) => (
          <div key={label} className="bg-surface-2 border border-warm-line rounded-card p-4">
            <p className="text-xs text-cream-faint uppercase tracking-widest font-black mb-1">{label}</p>
            <p className="text-lg font-bold text-cream tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-cream-faint" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('search')}
            className="w-full pl-9 pr-4 py-2.5 bg-warm-input border border-warm-line rounded-btn text-sm text-cream placeholder:text-cream-faint focus:outline-none focus:border-accent/50 transition-all"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="bg-warm-input border border-warm-line rounded-btn px-3 py-2.5 text-cream text-sm focus:outline-none focus:border-accent/50"
        >
          <option value="">{t('all_categories')}</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 px-4 py-2.5 bg-warm-input border border-warm-line rounded-btn cursor-pointer hover:bg-surface-2 transition-all select-none">
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={e => setLowStockOnly(e.target.checked)}
            className="w-4 h-4 rounded accent-[#c2652a]"
          />
          <span className="text-sm text-cream-muted font-medium">{t('low_stock_only')}</span>
        </label>
      </div>

      {/* Products table */}
      {loadingProducts ? (
        <div className="py-12 text-center text-cream-faint text-sm">{t('loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 flex flex-col items-center gap-3">
          <Package size={40} className="text-cream-faint/30" />
          <p className="text-cream-faint text-sm">{t('no_data')}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-warm-line">
          <table className="w-full">
            <thead className="bg-surface-2 border-b border-warm-line">
              <tr>
                <th className="table-header text-left py-3 px-4">{t('product_name')}</th>
                <th className="table-header text-left py-3 px-4">{t('unit')}</th>
                <th className="table-header text-right py-3 px-4">{t('stock')}</th>
                <th className="table-header text-right py-3 px-4">{t('min_stock')}</th>
                <th className="table-header text-left py-3 px-4">{t('status')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => {
                const cfg = STATUS_CONFIG[p.stock_status] ?? STATUS_CONFIG.not_assigned;
                return (
                  <tr key={p.id} className={`border-b border-warm-line/50 last:border-0 hover:bg-surface-2/40 transition-colors`}>
                    <td className="py-3 px-4 text-cream font-medium">{p.name}</td>
                    <td className="py-3 px-4 text-cream-muted text-sm">{p.unit}</td>
                    <td className="py-3 px-4 text-right text-cream tabular-nums font-semibold">
                      {p.warehouse_stock.toLocaleString('mk-MK', { maximumFractionDigits: 3 })}
                    </td>
                    <td className="py-3 px-4 text-right text-cream-muted tabular-nums">
                      {p.min_stock.toLocaleString('mk-MK', { maximumFractionDigits: 3 })}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${cfg.cls}`}>
                        {t(cfg.labelKey)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PerWarehouse;
