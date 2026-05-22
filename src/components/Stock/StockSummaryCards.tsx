import React from 'react';
import { useTranslation } from 'react-i18next';
import { DollarSign, AlertTriangle, PackageX, Warehouse, ArrowLeftRight } from 'lucide-react';

interface StockSummary {
  total_stock_value: number;
  low_stock_count: number;
  out_of_stock_count: number;
  warehouses_count: number;
  recent_transfers_count: number;
}

interface Props {
  summary: StockSummary;
}

const StockSummaryCards: React.FC<Props> = ({ summary }) => {
  const { t } = useTranslation();

  const cards = [
    {
      label: t('total_stock_value'),
      value: `${Number(summary.total_stock_value).toLocaleString('mk-MK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ${t('mkd_short')}`,
      icon: DollarSign,
      iconCls: 'text-emerald-400',
      ringCls: 'ring-emerald-500/20',
    },
    {
      label: t('low_stock_items'),
      value: String(summary.low_stock_count),
      icon: AlertTriangle,
      iconCls: 'text-amber-400',
      ringCls: 'ring-amber-500/20',
    },
    {
      label: t('out_of_stock_items'),
      value: String(summary.out_of_stock_count),
      icon: PackageX,
      iconCls: 'text-rose-400',
      ringCls: 'ring-rose-500/20',
    },
    {
      label: t('warehouses_count'),
      value: String(summary.warehouses_count),
      icon: Warehouse,
      iconCls: 'text-accent-light',
      ringCls: 'ring-accent/20',
    },
    {
      label: t('recent_transfers_7d'),
      value: `${summary.recent_transfers_count} ${t('in_last_7d')}`,
      icon: ArrowLeftRight,
      iconCls: 'text-cream-muted',
      ringCls: 'ring-warm-line',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-surface-2 border border-warm-line rounded-card p-4 flex flex-col gap-3"
        >
          <div className={`w-9 h-9 rounded-xl bg-surface ring-1 ${card.ringCls} flex items-center justify-center`}>
            <card.icon size={18} className={card.iconCls} />
          </div>
          <div>
            <div className="text-xl font-black text-cream leading-tight">{card.value}</div>
            <div className="text-xs font-bold text-cream-faint mt-0.5 uppercase tracking-wider">{card.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StockSummaryCards;
