import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, ArrowRightLeft, Loader2 } from 'lucide-react';
import apiClient from '../../lib/apiClient';

interface Transfer {
  id: string;
  quantity: number | string;
  unit: string;
  note: string | null;
  created_at: string;
  source_warehouse_name: string;
  destination_warehouse_name: string;
  product_name: string;
  user_name: string | null;
}

interface TransferHistoryProps {
  refreshTrigger: number;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatQty(raw: number | string): string {
  const n = Number(raw);
  return Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/\.?0+$/, '');
}

export const TransferHistory: React.FC<TransferHistoryProps> = ({ refreshTrigger }) => {
  const { t } = useTranslation();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiClient.get('/transfers')
      .then((res) => {
        if (!cancelled) {
          setTransfers(res.data.slice(0, 50));
          setLoading(false);
        }
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshTrigger]);

  return (
    <div className="bg-surface border border-warm-line rounded-card overflow-hidden">
      <div className="px-6 py-4 border-b border-warm-line flex items-center justify-between">
        <h3 className="font-serif italic text-xl text-cream">{t('recent_transfers')}</h3>
        <span className="text-cream-muted text-sm">
          {transfers.length} {transfers.length === 1 ? t('transfer') : t('transfers')}
        </span>
      </div>

      {loading ? (
        <div className="py-12 text-center text-cream-muted">
          <Loader2 className="mx-auto animate-spin mb-2" size={28} />
          <p className="text-sm">{t('loading')}</p>
        </div>
      ) : transfers.length === 0 ? (
        <div className="py-12 text-center">
          <ArrowRightLeft className="mx-auto text-cream-faint mb-3" size={28} />
          <p className="text-cream-muted text-sm">{t('no_transfers_yet')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-2">
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-black text-cream-faint uppercase tracking-widest">{t('date_time')}</th>
                <th className="px-4 py-3 text-left text-[11px] font-black text-cream-faint uppercase tracking-widest">{t('product')}</th>
                <th className="px-4 py-3 text-right text-[11px] font-black text-cream-faint uppercase tracking-widest">{t('quantity')}</th>
                <th className="px-4 py-3 text-left text-[11px] font-black text-cream-faint uppercase tracking-widest">{t('from_to')}</th>
                <th className="px-4 py-3 text-left text-[11px] font-black text-cream-faint uppercase tracking-widest">{t('by_user')}</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((tr, idx) => (
                <tr
                  key={tr.id}
                  className={`border-t border-warm-line/50 hover:bg-surface-2/50 transition-colors ${idx % 2 === 0 ? 'bg-surface' : 'bg-surface-2/30'}`}
                >
                  <td className="px-4 py-3 text-cream-muted whitespace-nowrap">{formatDateTime(tr.created_at)}</td>
                  <td className="px-4 py-3 text-cream font-medium">{tr.product_name}</td>
                  <td className="px-4 py-3 text-right text-cream font-mono">
                    {formatQty(tr.quantity)} <span className="text-cream-faint text-xs">{tr.unit}</span>
                  </td>
                  <td className="px-4 py-3 text-cream-muted">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span>{tr.source_warehouse_name}</span>
                      <ArrowRight size={13} className="text-accent shrink-0" />
                      <span>{tr.destination_warehouse_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-cream-muted">{tr.user_name ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TransferHistory;
