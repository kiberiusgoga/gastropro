import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SortOption } from './StockFiltersBar';

interface Warehouse {
  id: string;
  name: string;
  is_main: boolean;
}

interface ProductRow {
  id: string;
  name: string;
  unit: string;
  min_stock: number;
  category_id: string | null;
  stock_by_warehouse: Record<string, number>;
}

interface Props {
  warehouses: Warehouse[];
  products: ProductRow[];
  search: string;
  categoryId: string;
  sortBy: SortOption;
  lowStockOnly: boolean;
  highlightEmpty: boolean;
}

const StockMatrixTable: React.FC<Props> = ({
  warehouses, products, search, categoryId, sortBy, lowStockOnly, highlightEmpty,
}) => {
  const { t } = useTranslation();

  const filtered = useMemo(() => {
    let rows = products;

    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((p) => p.name.toLowerCase().includes(q));
    }

    if (categoryId) {
      rows = rows.filter((p) => p.category_id === categoryId);
    }

    if (lowStockOnly) {
      rows = rows.filter((p) => {
        const total = Object.values(p.stock_by_warehouse).reduce((a, b) => a + b, 0);
        return total <= p.min_stock;
      });
    }

    const sorted = [...rows];
    if (sortBy === 'name_asc') {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'total_desc') {
      sorted.sort((a, b) => {
        const ta = Object.values(a.stock_by_warehouse).reduce((x, y) => x + y, 0);
        const tb = Object.values(b.stock_by_warehouse).reduce((x, y) => x + y, 0);
        return tb - ta;
      });
    } else if (sortBy === 'low_first') {
      sorted.sort((a, b) => {
        const ta = Object.values(a.stock_by_warehouse).reduce((x, y) => x + y, 0);
        const tb = Object.values(b.stock_by_warehouse).reduce((x, y) => x + y, 0);
        const ra = ta - a.min_stock;
        const rb = tb - b.min_stock;
        return ra - rb;
      });
    }

    return sorted;
  }, [products, search, categoryId, sortBy, lowStockOnly]);

  if (filtered.length === 0) {
    return (
      <div className="text-center py-16 text-cream-faint text-sm">
        {t('no_products_match_filters')}
      </div>
    );
  }

  const cellClass = (qty: number, min: number) => {
    if (!highlightEmpty) return '';
    if (qty === 0) return 'bg-rose-500/20 text-rose-300';
    if (qty <= min) return 'bg-amber-500/15 text-amber-300';
    return '';
  };

  return (
    <div className="overflow-x-auto rounded-card border border-warm-line">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-surface border-b border-warm-line">
            <th className="sticky left-0 z-10 bg-surface px-4 py-3 text-left font-bold text-cream-faint uppercase tracking-wider text-[11px] min-w-[160px]">
              {t('product')}
            </th>
            {warehouses.map((wh) => (
              <th key={wh.id} className="px-4 py-3 text-center font-bold text-cream-faint uppercase tracking-wider text-[11px] min-w-[110px]">
                {wh.name}
                {wh.is_main && (
                  <span className="ml-1.5 text-[9px] font-black text-accent-light bg-accent/10 px-1.5 py-0.5 rounded-full">
                    {t('main_warehouse_label')}
                  </span>
                )}
              </th>
            ))}
            <th className="sticky right-0 z-10 bg-surface px-4 py-3 text-center font-bold text-cream-faint uppercase tracking-wider text-[11px] min-w-[80px]">
              {t('total')}
            </th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((p, idx) => {
            const total = Object.values(p.stock_by_warehouse).reduce((a, b) => a + b, 0);
            const rowBg = idx % 2 === 0 ? 'bg-surface-2' : 'bg-surface';
            return (
              <tr key={p.id} className={`${rowBg} border-b border-warm-line/50 hover:bg-surface-2/80 transition-colors`}>
                <td className={`sticky left-0 z-10 ${rowBg} px-4 py-3 font-semibold text-cream`}>
                  {p.name}
                  <span className="ml-1.5 text-cream-faint text-xs font-normal">({p.unit})</span>
                </td>
                {warehouses.map((wh) => {
                  const qty = p.stock_by_warehouse[wh.id] ?? 0;
                  const cls = cellClass(qty, p.min_stock);
                  return (
                    <td key={wh.id} className={`px-4 py-3 text-center font-mono text-sm ${cls || 'text-cream-muted'}`}>
                      {qty}
                    </td>
                  );
                })}
                <td className={`sticky right-0 z-10 ${rowBg} px-4 py-3 text-center font-black ${
                  total === 0 ? 'text-rose-400' : total <= p.min_stock ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {total}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default StockMatrixTable;
