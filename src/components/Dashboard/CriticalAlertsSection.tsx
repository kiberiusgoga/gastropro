import React from 'react';
import { PackageX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useStockAlerts } from '../../contexts/StockAlertsContext';

export const CriticalAlertsSection: React.FC = () => {
  const { t } = useTranslation();
  const { alerts } = useStockAlerts();
  const items = alerts.out_of_stock.slice(0, 5);

  if (items.length === 0) return null;

  return (
    <div className="rounded-card border border-rose-500/30 bg-rose-500/5 p-4 md:p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 bg-rose-500/10 rounded-xl flex items-center justify-center shrink-0">
          <PackageX size={18} className="text-rose-400" />
        </div>
        <div>
          <h3 className="text-sm font-black text-cream uppercase tracking-widest">
            {t('out_of_stock_alert')}
          </h3>
          <p className="text-[10px] font-bold text-cream-faint uppercase tracking-widest mt-0.5">
            {t('urgent_restock_needed', { count: items.length })}
          </p>
        </div>
      </div>

      <div className="space-y-1">
        {items.map((item) => (
          <div
            key={`${item.id}-${item.warehouse_id}`}
            className="flex items-center justify-between py-2 px-1 border-b border-rose-500/10 last:border-0"
          >
            <div className="flex-1 min-w-0">
              <span className="text-sm font-black text-cream">{item.name}</span>
              <span className="text-cream-faint text-xs ml-2">{item.warehouse_name}</span>
            </div>
            <span className="text-xs font-black text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-lg shrink-0 ml-2">
              0 {item.unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CriticalAlertsSection;
