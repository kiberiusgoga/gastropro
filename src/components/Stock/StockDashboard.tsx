import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import apiClient from '../../lib/apiClient';
import StockSummaryCards from './StockSummaryCards';
import StockFiltersBar, { SortOption } from './StockFiltersBar';
import StockMatrixTable from './StockMatrixTable';

interface StockSummary {
  total_stock_value: number;
  low_stock_count: number;
  out_of_stock_count: number;
  warehouses_count: number;
  recent_transfers_count: number;
}

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

interface Category {
  id: string;
  name: string;
}

const StockDashboard: React.FC = () => {
  const { t } = useTranslation();

  const [summary, setSummary] = useState<StockSummary | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name_asc');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [highlightEmpty, setHighlightEmpty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [summaryRes, matrixRes, catRes] = await Promise.all([
        apiClient.get('/stock/summary'),
        apiClient.get('/stock/matrix'),
        apiClient.get('/categories'),
      ]);

      setSummary(summaryRes.data);
      setWarehouses(matrixRes.data.warehouses ?? []);
      setProducts(matrixRes.data.products ?? []);
      setCategories(Array.isArray(catRes.data) ? catRes.data : (catRes.data.categories ?? []));
    } catch (err: any) {
      setError(err.message || 'Error loading stock data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-cream-faint text-sm">
        {t('loading')}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-24 text-rose-400 text-sm">
        {error}
      </div>
    );
  }

  const itemCount = products.length;
  const locationCount = warehouses.length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-cream font-serif italic">{t('stock_dashboard_title')}</h1>
          <p className="text-sm text-cream-faint mt-1">
            {itemCount} {t('items')} · {locationCount} {t('locations')}
          </p>
        </div>
      </div>

      {summary && <StockSummaryCards summary={summary} />}

      <div className="bg-surface-2 border border-warm-line rounded-card p-4 space-y-4">
        <StockFiltersBar
          search={search}
          onSearchChange={setSearch}
          categoryId={categoryId}
          onCategoryChange={setCategoryId}
          categories={categories}
          sortBy={sortBy}
          onSortChange={setSortBy}
          lowStockOnly={lowStockOnly}
          onLowStockOnlyChange={setLowStockOnly}
          highlightEmpty={highlightEmpty}
          onHighlightEmptyChange={setHighlightEmpty}
        />

        <StockMatrixTable
          warehouses={warehouses}
          products={products}
          search={search}
          categoryId={categoryId}
          sortBy={sortBy}
          lowStockOnly={lowStockOnly}
          highlightEmpty={highlightEmpty}
        />
      </div>
    </div>
  );
};

export default StockDashboard;
