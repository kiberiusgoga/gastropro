import React from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';

interface Category {
  id: string;
  name: string;
}

export type SortOption = 'name_asc' | 'total_desc' | 'low_first';

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  categoryId: string;
  onCategoryChange: (v: string) => void;
  categories: Category[];
  sortBy: SortOption;
  onSortChange: (v: SortOption) => void;
  lowStockOnly: boolean;
  onLowStockOnlyChange: (v: boolean) => void;
  highlightEmpty: boolean;
  onHighlightEmptyChange: (v: boolean) => void;
}

const StockFiltersBar: React.FC<Props> = ({
  search, onSearchChange,
  categoryId, onCategoryChange, categories,
  sortBy, onSortChange,
  lowStockOnly, onLowStockOnlyChange,
  highlightEmpty, onHighlightEmptyChange,
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap gap-3 items-center">
      <div className="relative flex-1 min-w-[180px]">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-cream-faint" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('search_products')}
          className="w-full pl-9 pr-3 py-2 bg-surface border border-warm-line rounded-btn text-sm text-cream placeholder:text-cream-faint focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      <select
        value={categoryId}
        onChange={(e) => onCategoryChange(e.target.value)}
        className="px-3 py-2 bg-surface border border-warm-line rounded-btn text-sm text-cream focus:outline-none focus:ring-1 focus:ring-accent"
      >
        <option value="">{t('all_categories')}</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      <select
        value={sortBy}
        onChange={(e) => onSortChange(e.target.value as SortOption)}
        className="px-3 py-2 bg-surface border border-warm-line rounded-btn text-sm text-cream focus:outline-none focus:ring-1 focus:ring-accent"
      >
        <option value="name_asc">{t('sort_by_name')}</option>
        <option value="total_desc">{t('sort_by_total_desc')}</option>
        <option value="low_first">{t('sort_by_low_first')}</option>
      </select>

      <label className="flex items-center gap-2 text-sm text-cream-muted cursor-pointer select-none">
        <input
          type="checkbox"
          checked={lowStockOnly}
          onChange={(e) => onLowStockOnlyChange(e.target.checked)}
          className="w-4 h-4 accent-[#c2652a] rounded"
        />
        {t('low_stock_only')}
      </label>

      <label className="flex items-center gap-2 text-sm text-cream-muted cursor-pointer select-none">
        <input
          type="checkbox"
          checked={highlightEmpty}
          onChange={(e) => onHighlightEmptyChange(e.target.checked)}
          className="w-4 h-4 accent-[#c2652a] rounded"
        />
        {t('highlight_critical')}
      </label>
    </div>
  );
};

export default StockFiltersBar;
