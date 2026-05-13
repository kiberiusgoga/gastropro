import React from 'react';
import { Printer, ArrowLeft, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ZReportData } from '../../services/zreportService';

interface Props {
  zreport: ZReportData;
  onBack?: () => void;
}

const fmt = (n: number) =>
  n.toLocaleString('mk-MK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtPct = (n: number) =>
  `${n.toFixed(1)}%`;

const VatRatePct = (rate: number) => `${(rate * 100).toFixed(0)}%`;

function duration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}ч ${m}мин` : `${m}мин`;
}

function formatTs(ts: string) {
  return new Date(ts).toLocaleString('mk-MK', {
    dateStyle: 'medium', timeStyle: 'short',
  });
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="mb-6 print:mb-4">
    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400 mb-3 print:text-zinc-600">
      {title}
    </h3>
    {children}
  </div>
);

const Row: React.FC<{ label: string; value: string; bold?: boolean; accent?: string }> = ({ label, value, bold, accent }) => (
  <div className={`flex justify-between items-center py-1.5 border-b border-zinc-100 dark:border-zinc-800 print:border-zinc-200 last:border-0 ${bold ? 'font-black' : 'font-medium'}`}>
    <span className={`text-sm ${bold ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400'}`}>{label}</span>
    <span className={`text-sm font-black ${accent ?? (bold ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-800 dark:text-zinc-200')}`}>{value}</span>
  </div>
);

const ZReportView: React.FC<Props> = ({ zreport: z, onBack }) => {
  const { t } = useTranslation();
  const diff = z.cash_difference;

  const diffColor =
    diff === 0 ? 'text-emerald-600 dark:text-emerald-400' :
    Math.abs(diff) <= 50 ? 'text-amber-600 dark:text-amber-400' :
    'text-red-600 dark:text-red-400';

  const diffBg =
    diff === 0 ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' :
    Math.abs(diff) <= 50 ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' :
    'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';

  return (
    <div className="space-y-0">
      {/* Screen toolbar — hidden in print */}
      <div className="flex items-center gap-3 mb-6 print:hidden">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-black text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all"
          >
            <ArrowLeft size={16} />
            {t('back')}
          </button>
        )}
        <div className="flex-1" />
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-5 py-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-black uppercase tracking-wide hover:opacity-90 transition-all shadow-sm"
        >
          <Printer size={16} />
          {t('print')} / PDF
        </button>
      </div>

      {/* Report card */}
      <div
        className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm print:shadow-none print:border-0 print:rounded-none"
        id="zreport-print"
      >
        {/* ── Header ── */}
        <div className="px-8 pt-8 pb-6 border-b border-zinc-100 dark:border-zinc-800 print:border-zinc-300">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-400 mb-1">Z-ИЗВЕШТАЈ</p>
              <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">
                {z.restaurant.name}
              </h1>
              {z.restaurant.address && (
                <p className="text-sm text-zinc-500 mt-0.5">{z.restaurant.address}</p>
              )}
              {z.restaurant.vat_number && (
                <p className="text-xs text-zinc-400 mt-0.5">ДДВ број: {z.restaurant.vat_number}</p>
              )}
            </div>
            <div className="text-right text-xs text-zinc-400 space-y-0.5">
              <p>{formatTs(z.closed_at)}</p>
              <p className="font-black text-zinc-600 dark:text-zinc-300">Смена #{z.shift_id.slice(-6).toUpperCase()}</p>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* ── Shift metadata ── */}
          <Section title="Информации за смена">
            <Row label="Келнер" value={z.opened_by.name} />
            <Row label="Затворена од" value={z.closed_by.name} />
            <Row label="Отворена" value={formatTs(z.opened_at)} />
            <Row label="Затворена" value={formatTs(z.closed_at)} />
            <Row label="Траење" value={duration(z.duration_minutes)} />
          </Section>

          {/* ── Cash reconciliation ── */}
          <Section title={t('cash_reconciliation')}>
            <div className={`rounded-xl border p-4 space-y-2 ${diffBg}`}>
              <Row label={t('initial_cash')} value={`${fmt(z.initial_cash)} ден.`} />
              <Row label="Готовински продажби" value={`+ ${fmt(z.expected_cash - z.initial_cash)} ден.`} />
              <Row label={t('expected_cash')} value={`${fmt(z.expected_cash)} ден.`} bold />
              <Row label={t('actual_cash')} value={`${fmt(z.actual_cash)} ден.`} bold />
              <div className={`flex justify-between items-center pt-2 border-t border-current/10 font-black ${diffColor}`}>
                <div className="flex items-center gap-1.5 text-sm">
                  {diff > 0 ? <TrendingUp size={14} /> : diff < 0 ? <TrendingDown size={14} /> : <Minus size={14} />}
                  {t('cash_difference')}
                </div>
                <span className="text-sm">
                  {diff > 0 ? '+' : ''}{fmt(diff)} ден.
                  {diff > 0 && <span className="ml-1 font-medium opacity-70">({t('surplus')})</span>}
                  {diff < 0 && <span className="ml-1 font-medium opacity-70">({t('shortage')})</span>}
                </span>
              </div>
            </div>
          </Section>

          {/* ── Financial totals ── */}
          <Section title={t('financial_summary')}>
            <Row label={t('gross_revenue')} value={`${fmt(z.totals.gross_revenue)} ден.`} bold />
            <Row label="Нето приход (без ДДВ)" value={`${fmt(z.totals.net_revenue)} ден.`} />
            <Row label="Вкупен ДДВ" value={`${fmt(z.totals.total_vat)} ден.`} />
            <Row label={t('order_count')} value={String(z.totals.order_count)} />
            <Row label="Вкупно ставки" value={String(z.totals.item_count)} />
            <Row label="Просечна нарачка" value={`${fmt(z.totals.average_order_value)} ден.`} />
            <Row label="Вкупно гости" value={String(z.totals.guest_count)} />
          </Section>

          {/* ── VAT breakdown ── */}
          {z.vat_breakdown.length > 0 && (
            <Section title={t('vat_breakdown')}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
                    <th className="text-left pb-2">{t('vat_rate')}</th>
                    <th className="text-right pb-2">Бруто</th>
                    <th className="text-right pb-2">Нето</th>
                    <th className="text-right pb-2">ДДВ</th>
                    <th className="text-right pb-2">Ставки</th>
                  </tr>
                </thead>
                <tbody>
                  {z.vat_breakdown.map(v => (
                    <tr key={v.rate} className="border-b border-zinc-50 dark:border-zinc-800/50 last:border-0">
                      <td className="py-2 font-black">{VatRatePct(v.rate)}</td>
                      <td className="py-2 text-right">{fmt(v.gross)} ден.</td>
                      <td className="py-2 text-right text-zinc-500">{fmt(v.net)} ден.</td>
                      <td className="py-2 text-right text-zinc-500">{fmt(v.vat)} ден.</td>
                      <td className="py-2 text-right text-zinc-400">{v.item_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {/* ── Payment methods ── */}
          <Section title={t('payment_breakdown')}>
            {z.payment_breakdown.length === 0 ? (
              <p className="text-sm text-zinc-400 italic">Нема платени нарачки</p>
            ) : (
              z.payment_breakdown.map(p => (
                <Row
                  key={p.method}
                  label={p.method === 'cash' ? 'Готовина' : p.method === 'card' ? 'Картичка' : p.method}
                  value={`${p.count}× — ${fmt(p.total)} ден.`}
                />
              ))
            )}
          </Section>

          {/* ── Order types ── */}
          <Section title="Видови нарачки">
            {z.order_type_breakdown.map(o => (
              <Row
                key={o.type}
                label={o.type === 'dine_in' ? 'На маса' : o.type === 'takeaway' ? 'За носење' : 'Достава'}
                value={`${o.count}× — ${fmt(o.total)} ден.`}
              />
            ))}
          </Section>

          {/* ── Top items ── */}
          {z.top_items.length > 0 && (
            <Section title="Топ 10 артикли">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
                    <th className="text-left pb-2">Артикал</th>
                    <th className="text-right pb-2">Кол.</th>
                    <th className="text-right pb-2">Приход</th>
                  </tr>
                </thead>
                <tbody>
                  {z.top_items.map((item, i) => (
                    <tr key={item.menu_item_id ?? item.name} className="border-b border-zinc-50 dark:border-zinc-800/50 last:border-0">
                      <td className="py-1.5">
                        <span className="text-[10px] font-black text-zinc-400 mr-2">{i + 1}.</span>
                        {item.name}
                      </td>
                      <td className="py-1.5 text-right font-black">{item.quantity_sold}</td>
                      <td className="py-1.5 text-right text-zinc-500">{fmt(item.revenue)} ден.</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {/* ── Category breakdown ── */}
          {z.category_breakdown.length > 0 && (
            <Section title="По категорија">
              {z.category_breakdown.map(c => (
                <div key={c.category_id ?? 'uncat'} className="flex items-center gap-3 py-1.5 border-b border-zinc-50 dark:border-zinc-800/50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-zinc-700 dark:text-zinc-300 truncate">{c.category_name}</span>
                      <span className="font-black text-zinc-900 dark:text-zinc-100 ml-2 shrink-0">{fmt(c.revenue)} ден.</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${c.percentage}%` }} />
                      </div>
                      <span className="text-[10px] font-black text-zinc-400 w-8 text-right">{fmtPct(c.percentage)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </Section>
          )}

          {/* ── Hourly revenue ── */}
          <Section title="Приход по час">
            <div className="flex items-end gap-0.5 h-16">
              {z.hourly_revenue.map(h => {
                const max = Math.max(...z.hourly_revenue.map(x => x.revenue), 1);
                const pct = (h.revenue / max) * 100;
                return (
                  <div key={h.hour} className="flex-1 flex flex-col items-center gap-0.5" title={`${h.hour}:00 — ${fmt(h.revenue)} ден.`}>
                    <div
                      className="w-full bg-emerald-500/30 dark:bg-emerald-500/20 rounded-sm"
                      style={{ height: `${Math.max(pct, h.revenue > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[9px] text-zinc-400 mt-1 font-mono">
              <span>0</span><span>6</span><span>12</span><span>18</span><span>23</span>
            </div>
          </Section>

          {/* ── Discounts ── */}
          <Section title="Попусти">
            {z.discounts.application_count === 0 ? (
              <p className="text-sm text-zinc-400 italic">Нема применети попусти</p>
            ) : (
              <>
                <Row label="Вкупен попуст" value={`${fmt(z.discounts.total_amount)} ден.`} bold />
                <Row label="Број на примени" value={String(z.discounts.application_count)} />
                {z.discounts.by_type.map(d => (
                  <Row key={`${d.type}-${d.name}`} label={d.name} value={`${d.count}× — ${fmt(d.total)} ден.`} />
                ))}
              </>
            )}
          </Section>

          {/* ── Cancellations ── */}
          <Section title="Откажани нарачки">
            {z.cancellations.cancelled_order_count === 0 ? (
              <p className="text-sm text-zinc-400 italic">Нема откажани нарачки</p>
            ) : (
              <>
                <Row label="Откажани нарачки" value={String(z.cancellations.cancelled_order_count)} />
                <Row label="Вредност" value={`${fmt(z.cancellations.cancelled_value)} ден.`} />
              </>
            )}
          </Section>
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t border-zinc-100 dark:border-zinc-800 text-center print:border-zinc-300">
          <p className="text-[10px] text-zinc-400 font-mono">
            Генерирано: {formatTs(z.closed_at)} · GastroPro Management · Смена {z.shift_id.slice(-6).toUpperCase()}
          </p>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body > *:not(#zreport-root) { display: none !important; }
          #zreport-print { box-shadow: none !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
};

export default ZReportView;
