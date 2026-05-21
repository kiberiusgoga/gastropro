import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface Warehouse {
  id: string;
  name: string;
  is_main: boolean;
  product_count: number;
  total_value: number;
}

interface Props {
  warehouses: Warehouse[];
  onEdit: (w: Warehouse) => void;
  onDelete: (w: Warehouse) => void;
}

const WarehousesList: React.FC<Props> = ({ warehouses, onEdit, onDelete }) => {
  const { t } = useTranslation();

  if (warehouses.length === 0) {
    return (
      <div className="py-10 text-center text-cream-faint text-sm">{t('no_data')}</div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-warm-line">
      <div className="grid grid-cols-[1fr_auto_auto_auto] bg-surface-2 border-b border-warm-line">
        <div className="table-header">{t('warehouse_name')}</div>
        <div className="table-header text-right pr-6">{t('products_count')}</div>
        <div className="table-header text-right pr-6">{t('total_stock_value')}</div>
        <div className="table-header text-right pr-4">{t('actions')}</div>
      </div>

      {warehouses.map((w, i) => (
        <div
          key={w.id}
          className={`grid grid-cols-[1fr_auto_auto_auto] items-center hover:bg-surface-2/50 transition-colors ${
            i < warehouses.length - 1 ? 'border-b border-warm-line/50' : ''
          }`}
        >
          <div className="table-cell flex items-center gap-2">
            <span className="font-semibold">{w.name}</span>
            {w.is_main && (
              <span className="bg-accent/15 text-accent-light px-2 py-0.5 rounded-md text-xs font-medium">
                {t('main_warehouse_label')}
              </span>
            )}
          </div>
          <div className="table-cell text-right pr-6 text-cream-muted tabular-nums">
            {w.product_count}
          </div>
          <div className="table-cell text-right pr-6 text-cream-muted tabular-nums">
            {w.total_value.toLocaleString('mk-MK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ден.
          </div>
          <div className="table-cell text-right pr-2 flex items-center justify-end gap-1">
            <button
              onClick={() => onEdit(w)}
              className="p-2 text-cream-faint hover:text-cream hover:bg-surface-2 rounded-xl transition-all"
              title={t('edit_warehouse')}
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={() => onDelete(w)}
              disabled={w.is_main}
              className="p-2 text-cream-faint hover:text-rose-400 hover:bg-rose-900/20 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-cream-faint disabled:hover:bg-transparent"
              title={w.is_main ? t('cannot_delete_main') : t('delete_warehouse')}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default WarehousesList;
