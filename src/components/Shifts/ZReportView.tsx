import React from 'react';
import { Printer, ArrowLeft, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ZReportData } from '../../services/zreportService';
import SupplierConsumptionSection from '../ZReport/SupplierConsumptionSection';

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
    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-cream-faint mb-3 print:text-zinc-600">
      {title}
    </h3>
    {children}
  </div>
);

const Row: React.FC<{ label: string; value: string; bold?: boolean; accent?: string }> = ({ label, value, bold, accent }) => (
  <div className={`flex justify-between items-center py-1.5 border-b border-warm-line print:border-zinc-200 last:border-0 ${bold ? 'font-black' : 'font-medium'}`}>
    <span className={`text-sm ${bold ? 'text-cream' : 'text-cream-muted'}`}>{label}</span>
    <span className={`text-sm font-black ${accent ?? (bold ? 'text-cream' : 'text-cream-muted')}`}>{value}</span>
  </div>
);

const ZReportView: React.FC<Props> = ({ zreport: z, onBack }) => {
  const { t } = useTranslation();
  const diff = z.cash_difference;

  const diffColor =
    diff === 0 ? 'text-emerald-400' :
    Math.abs(diff) <= 50 ? 'text-amber-400' :
    'text-red-400';

  const diffBg =
    diff === 0 ? 'bg-emerald-900/20 border-emerald-800' :
    Math.abs(diff) <= 50 ? 'bg-amber-900/20 border-amber-800' :
    'bg-red-900/20 border-red-800';

  return (
    <div className="space-y-0">
      {/* Screen toolbar — hidden in print */}
      <div className="flex items-center gap-3 mb-6 print:hidden">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-warm-line text-sm font-black text-cream-muted hover:bg-surface-2 transition-all"
          >
            <ArrowLeft size={16} />
            {t('back')}
          </button>
        )}
        <div className="flex-1" />
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-5 py-2 rounded-xl bg-accent text-[#faf5ee] text-sm font-black uppercase tracking-wide hover:brightness-110 transition-all shadow-card"
        >
          <Printer size={16} />
          {t('print')} / PDF
        </button>
      </div>

      {/* Report card */}
      <div
        className="bg-surface rounded-2xl border border-warm-line shadow-card print:shadow-none print:border-0 print:rounded-none"
        id="zreport-print"
      >
        {/* ── Header ── */}
        <div className="px-8 pt-8 pb-6 border-b border-warm-line print:border-zinc-300">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-accent-light mb-1">Z-ИЗВЕШТАЈ</p>
              <h1 className="text-2xl font-black text-cream tracking-tight">
                {z.restaurant.name}
              </h1>
              {z.restaurant.address && (
                <p className="text-sm text-cream-faint mt-0.5">{z.restaurant.address}</p>
              )}
              {z.restaurant.vat_number && (
                <p className="text-xs text-cream-faint mt-0.5">ДДВ број: {z.restaurant.vat_number}</p>
              )}
            </div>
            <div className="text-right text-xs text-cream-faint space-y-0.5">
              <p>{formatTs(z.closed_at)}</p>
              <p className="font-black text-cream-muted">Смена #{z.shift_id.slice(-6).toUpperCase()}</p>
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

          {/* ── Cash reconciliation — keep semantic emerald/amber/red ── */}
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

          {/* ── Per-location breakdown (informational, screen-only) ── */}
          {z.per_warehouse && z.per_warehouse.length > 0 && (
            <div className="print:hidden">
              <Section title={t('per_warehouse_breakdown')}>
                <p className="text-xs text-cream-faint mb-3">{t('revenue_by_location')}</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] font-black uppercase tracking-widest text-cream-faint border-b border-warm-line">
                        <th className="text-left pb-2">{t('location')}</th>
                        <th className="text-right pb-2">{t('orders')}</th>
                        <th className="text-right pb-2">{t('subtotal_gross')}</th>
                        <th className="text-right pb-2">{t('net_revenue')}</th>
                        <th className="text-right pb-2">{t('percent_of_total')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const totalSubtotal = z.per_warehouse!.reduce((s, w) => s + w.subtotal, 0);
                        return z.per_warehouse!.map(w => {
                          const pct = totalSubtotal > 0 ? (w.subtotal / totalSubtotal) * 100 : 0;
                          return (
                            <tr key={w.warehouse_id} className="border-b border-warm-line/50 last:border-0">
                              <td className="py-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-cream-muted">{w.warehouse_name}</span>
                                  {w.is_main && (
                                    <span className="bg-accent/15 text-accent-light text-[10px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider">
                                      Main
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2 text-right text-cream">{w.order_count}</td>
                              <td className="py-2 text-right text-cream-muted">{fmt(w.subtotal)} ден.</td>
                              <td className="py-2 text-right text-cream font-black">{fmt(w.net_revenue)} ден.</td>
                              <td className="py-2 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="w-16 h-1.5 bg-surface-2 rounded-full overflow-hidden">
                                    <div className="h-full bg-accent rounded-full" style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className="text-cream-faint text-xs w-10 text-right">{fmtPct(pct)}</span>
                                </div>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-warm-line bg-surface-2/30">
                        <td className="py-2 text-cream font-black">{t('total')}</td>
                        <td className="py-2 text-right text-cream font-black">
                          {z.per_warehouse!.reduce((s, w) => s + w.order_count, 0)}
                        </td>
                        <td className="py-2 text-right text-cream-muted">
                          {fmt(z.per_warehouse!.reduce((s, w) => s + w.subtotal, 0))} ден.
                        </td>
                        <td className="py-2 text-right text-cream font-black">
                          {fmt(z.per_warehouse!.reduce((s, w) => s + w.net_revenue, 0))} ден.
                        </td>
                        <td className="py-2 text-right text-cream-faint text-xs">100.0%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Section>
            </div>
          )}

          {/* ── VAT breakdown ── */}
          {z.vat_breakdown.length > 0 && (
            <Section title={t('vat_breakdown')}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] font-black uppercase tracking-widest text-cream-faint border-b border-warm-line">
                    <th className="text-left pb-2">{t('vat_rate')}</th>
                    <th className="text-right pb-2">Бруто</th>
                    <th className="text-right pb-2">Нето</th>
                    <th className="text-right pb-2">ДДВ</th>
                    <th className="text-right pb-2">Ставки</th>
                  </tr>
                </thead>
                <tbody>
                  {z.vat_breakdown.map(v => (
                    <tr key={v.rate} className="border-b border-warm-line/50 last:border-0">
                      <td className="py-2 font-black text-cream">{VatRatePct(v.rate)}</td>
                      <td className="py-2 text-right text-cream-muted">{fmt(v.gross)} ден.</td>
                      <td className="py-2 text-right text-cream-faint">{fmt(v.net)} ден.</td>
                      <td className="py-2 text-right text-cream-faint">{fmt(v.vat)} ден.</td>
                      <td className="py-2 text-right text-cream-faint">{v.item_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {/* ── Payment methods ── */}
          <Section title={t('payment_breakdown')}>
            {z.payment_breakdown.length === 0 ? (
              <p className="text-sm text-cream-faint italic">Нема платени нарачки</p>
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
                  <tr className="text-[10px] font-black uppercase tracking-widest text-cream-faint border-b border-warm-line">
                    <th className="text-left pb-2">Артикал</th>
                    <th className="text-right pb-2">Кол.</th>
                    <th className="text-right pb-2">Приход</th>
                  </tr>
                </thead>
                <tbody>
                  {z.top_items.map((item, i) => (
                    <tr key={item.menu_item_id ?? item.name} className="border-b border-warm-line/50 last:border-0">
                      <td className="py-1.5 text-cream-muted">
                        <span className="text-[10px] font-black text-cream-faint mr-2">{i + 1}.</span>
                        {item.name}
                      </td>
                      <td className="py-1.5 text-right font-black text-cream">{item.quantity_sold}</td>
                      <td className="py-1.5 text-right text-cream-faint">{fmt(item.revenue)} ден.</td>
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
                <div key={c.category_id ?? 'uncat'} className="flex items-center gap-3 py-1.5 border-b border-warm-line/50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-cream-muted truncate">{c.category_name}</span>
                      <span className="font-black text-cream ml-2 shrink-0">{fmt(c.revenue)} ден.</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-warm-line rounded-full overflow-hidden">
                        <div className="h-full bg-accent rounded-full" style={{ width: `${c.percentage}%` }} />
                      </div>
                      <span className="text-[10px] font-black text-cream-faint w-8 text-right">{fmtPct(c.percentage)}</span>
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
                      className="w-full bg-accent/30 rounded-sm"
                      style={{ height: `${Math.max(pct, h.revenue > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[9px] text-cream-faint mt-1 font-mono">
              <span>0</span><span>6</span><span>12</span><span>18</span><span>23</span>
            </div>
          </Section>

          {/* ── Discounts ── */}
          <Section title="Попусти">
            {z.discounts.application_count === 0 ? (
              <p className="text-sm text-cream-faint italic">Нема применети попусти</p>
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
              <p className="text-sm text-cream-faint italic">Нема откажани нарачки</p>
            ) : (
              <>
                <Row label="Откажани нарачки" value={String(z.cancellations.cancelled_order_count)} />
                <Row label="Вредност" value={`${fmt(z.cancellations.cancelled_value)} ден.`} />
              </>
            )}
          </Section>

          {/* ── Non-fiscal B2B invoices ── */}
          {z.non_fiscal_sales && (
            <Section title="Нефискални фактури (Б2Б)">
              <p className="text-xs text-cream-faint mb-3">Не се вклучени во фискалниот промет</p>
              {z.non_fiscal_sales.order_linked.count > 0 && (
                <Row
                  label={`Поврзани со нарачки (${z.non_fiscal_sales.order_linked.count})`}
                  value={`${fmt(z.non_fiscal_sales.order_linked.total_amount)} ден.`}
                />
              )}
              {z.non_fiscal_sales.standalone.count > 0 && (
                <Row
                  label={`Самостојни (${z.non_fiscal_sales.standalone.count})`}
                  value={`${fmt(z.non_fiscal_sales.standalone.total_amount)} ден.`}
                />
              )}
              <Row
                label="Вкупно нефискални"
                value={`${fmt(
                  z.non_fiscal_sales.order_linked.total_amount +
                  z.non_fiscal_sales.standalone.total_amount,
                )} ден.`}
                bold
              />
            </Section>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t border-warm-line text-center print:border-zinc-300">
          <p className="text-[10px] text-cream-faint font-mono">
            Генерирано: {formatTs(z.closed_at)} · GastroPro Management · Смена {z.shift_id.slice(-6).toUpperCase()}
          </p>
        </div>
      </div>

      {/* Supplier consumption section — screen only, after report card */}
      <SupplierConsumptionSection shiftId={z.shift_id} />

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
