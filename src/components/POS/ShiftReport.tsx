import React, { useRef } from 'react';
import { X, Printer, TrendingUp, ShoppingBag, CreditCard, Banknote, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { mk } from 'date-fns/locale';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ShiftReportData {
  shift: {
    id: string;
    userName: string;
    startTime: string;
    endTime: string;
    status: string;
    initialCash: number;
    finalCash: number;
    expectedCash: number;
    cashDiff: number;
    orderCount: number;
    totalRevenue: number;
  };
  paymentsByMethod: { method: string; total: number }[];
  topItems: { name: string; count: number; revenue: number }[];
  orderTypes: { type: string; count: number; revenue: number }[];
}

interface Props {
  data: ShiftReportData;
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString('mk-MK');
const fmtDate = (d: string) => format(new Date(d), 'dd.MM.yyyy HH:mm', { locale: mk });

const METHOD_LABEL: Record<string, string> = { cash: 'Готовина', card: 'Картичка', mixed: 'Мешано' };
const TYPE_LABEL:   Record<string, string> = { dine_in: 'На маса', takeaway: 'За носење', delivery: 'Достава' };

// ─── Component ────────────────────────────────────────────────────────────────

const ShiftReport: React.FC<Props> = ({ data, onClose }) => {
  const printRef = useRef<HTMLDivElement>(null);
  const { shift, paymentsByMethod, topItems, orderTypes } = data;

  const cashTotal  = paymentsByMethod.find(p => p.method === 'cash')?.total  ?? shift.totalRevenue;
  const cardTotal  = paymentsByMethod.find(p => p.method === 'card')?.total  ?? 0;
  const diffPositive = shift.cashDiff >= 0;

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const win = window.open('', '_blank', 'width=800,height=900');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <title>Извештај за смена — ${shift.userName}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Inter', Arial, sans-serif; color: #0f172a; background: #fff; padding: 32px; font-size: 13px; }
          h1 { font-size: 22px; font-weight: 900; letter-spacing: -0.5px; }
          h2 { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.15em; color: #64748b; margin-bottom: 10px; }
          h3 { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.12em; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 2px solid #f1f5f9; }
          .brand { font-size: 11px; font-weight: 800; color: #10b981; text-transform: uppercase; letter-spacing: 0.2em; }
          .meta p { font-size: 11px; color: #64748b; text-align: right; margin-top: 2px; }
          .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
          .stat-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; }
          .stat-box .label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.14em; color: #94a3b8; margin-bottom: 4px; }
          .stat-box .value { font-size: 20px; font-weight: 900; color: #0f172a; }
          .stat-box .value.green { color: #10b981; }
          .stat-box .value.blue { color: #3b82f6; }
          .section { margin-bottom: 24px; }
          .divider { border: none; border-top: 1px solid #f1f5f9; margin: 20px 0; }
          table { width: 100%; border-collapse: collapse; }
          th { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; color: #94a3b8; padding: 6px 10px; text-align: left; border-bottom: 1px solid #f1f5f9; }
          td { padding: 8px 10px; font-size: 12px; border-bottom: 1px solid #f8fafc; }
          td.mono { font-weight: 700; text-align: right; }
          .cash-box { background: #f0fdf4; border: 1.5px solid #bbf7d0; border-radius: 12px; padding: 16px; }
          .cash-box.warn { background: #fff7ed; border-color: #fed7aa; }
          .cash-row { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; font-size: 13px; }
          .cash-row.total { border-top: 1px solid #e2e8f0; padding-top: 10px; margin-top: 6px; font-weight: 900; font-size: 15px; }
          .diff-pos { color: #16a34a; font-weight: 900; }
          .diff-neg { color: #dc2626; font-weight: 900; }
          .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 10px; color: #94a3b8; text-align: center; }
          .bar-wrap { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
          .bar-track { flex: 1; height: 6px; background: #f1f5f9; border-radius: 99px; overflow: hidden; }
          .bar-fill { height: 100%; background: #3b82f6; border-radius: 99px; }
        </style>
      </head>
      <body>${content}</body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  return (
    <>
      {/* ── Print styles (screen only) ── */}
      <style>{`@media print { .no-print { display: none !important; } }`}</style>

      {/* ── Backdrop ── */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
        <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-3xl">

          {/* Toolbar */}
          <div className="no-print flex items-center justify-between px-8 pt-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
            <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-50 uppercase tracking-tight">
              Извештај за смена
            </h2>
            <div className="flex items-center gap-3">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all"
              >
                <Printer size={15} strokeWidth={2.5} />
                Печати
              </button>
              <button onClick={onClose} className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                <X size={20} className="text-zinc-500" />
              </button>
            </div>
          </div>

          {/* ── Printable content ── */}
          <div ref={printRef} className="p-8 space-y-8">

            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-1">GastroPro</p>
                <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">Извештај за смена</h1>
                <p className="text-sm font-bold text-zinc-500 mt-0.5">{shift.userName}</p>
              </div>
              <div className="text-right text-xs font-bold text-zinc-400 space-y-1">
                <p>Отворена: <span className="text-zinc-600 dark:text-zinc-300">{fmtDate(shift.startTime)}</span></p>
                {shift.endTime && <p>Затворена: <span className="text-zinc-600 dark:text-zinc-300">{fmtDate(shift.endTime)}</span></p>}
                <p className="font-black text-zinc-500">#{shift.id.slice(0, 8).toUpperCase()}</p>
              </div>
            </div>

            {/* ── KPI cards ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Вкупен промет', value: `${fmt(shift.totalRevenue)} ден.`, icon: TrendingUp, color: 'emerald' },
                { label: 'Нарачки', value: shift.orderCount, icon: ShoppingBag, color: 'blue' },
                { label: 'Готовина', value: `${fmt(cashTotal)} ден.`, icon: Banknote, color: 'violet' },
                { label: 'Картичка', value: `${fmt(cardTotal)} ден.`, icon: CreditCard, color: 'amber' },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className={`rounded-2xl p-4 bg-${color}-50 dark:bg-${color}-950/30 border border-${color}-100 dark:border-${color}-900/50`}>
                  <Icon size={18} className={`text-${color}-500 mb-2`} />
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-wider mb-1">{label}</p>
                  <p className={`text-xl font-black text-${color}-700 dark:text-${color}-400`}>{value}</p>
                </div>
              ))}
            </div>

            {/* ── Cash reconciliation ── */}
            <div className={`rounded-2xl p-5 border ${diffPositive ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800' : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'}`}>
              <div className="flex items-center gap-2 mb-4">
                {diffPositive
                  ? <CheckCircle2 size={18} className="text-emerald-600" />
                  : <AlertTriangle size={18} className="text-amber-600" />}
                <h3 className="text-sm font-black text-zinc-700 dark:text-zinc-200 uppercase tracking-wider">Усогласување на каса</h3>
              </div>
              <div className="space-y-2">
                {[
                  { label: 'Почетен кеш',     value: shift.initialCash },
                  { label: 'Готовински приход', value: cashTotal },
                  { label: 'Очекуван кеш',     value: shift.expectedCash },
                  { label: 'Вистински кеш',    value: shift.finalCash },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between items-center text-sm">
                    <span className="font-bold text-zinc-500">{label}</span>
                    <span className="font-black text-zinc-900 dark:text-zinc-100">{fmt(value)} ден.</span>
                  </div>
                ))}
                <div className="border-t border-zinc-200 dark:border-zinc-700 pt-2 mt-2 flex justify-between items-center">
                  <span className="font-black text-zinc-700 dark:text-zinc-200 text-sm uppercase tracking-wide">Разлика</span>
                  <span className={`text-lg font-black ${diffPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                    {diffPositive ? '+' : ''}{fmt(shift.cashDiff)} ден.
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* ── Top items ── */}
              <div>
                <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.18em] mb-4">Најпродавани</h3>
                {topItems.length === 0 ? (
                  <p className="text-xs text-zinc-400 italic">Нема податоци</p>
                ) : (
                  <div className="space-y-3">
                    {topItems.map((item, idx) => (
                      <div key={idx}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 truncate pr-2">{item.name}</span>
                          <span className="text-xs font-black text-zinc-500 shrink-0">{item.count} бр.</span>
                        </div>
                        <div className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${topItems[0]?.count ? (item.count / topItems[0].count) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Order types ── */}
              <div>
                <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.18em] mb-4">По тип на нарачка</h3>
                {orderTypes.length === 0 ? (
                  <p className="text-xs text-zinc-400 italic">Нема податоци</p>
                ) : (
                  <div className="space-y-3">
                    {orderTypes.map((ot, idx) => (
                      <div key={idx} className="flex items-center justify-between py-2 border-b border-zinc-50 dark:border-zinc-800 last:border-0">
                        <div>
                          <p className="text-sm font-black text-zinc-800 dark:text-zinc-200">{TYPE_LABEL[ot.type] ?? ot.type}</p>
                          <p className="text-[10px] font-bold text-zinc-400">{ot.count} нарачки</p>
                        </div>
                        <p className="text-sm font-black text-zinc-700 dark:text-zinc-300">{fmt(ot.revenue)} ден.</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 text-center">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                GastroPro · Генерирано {format(new Date(), 'dd.MM.yyyy HH:mm', { locale: mk })}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ShiftReport;
