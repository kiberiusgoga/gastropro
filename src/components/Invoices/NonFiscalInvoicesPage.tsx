import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText, Eye, CheckCircle2, XCircle, X, Save, Printer,
  TrendingUp, Clock, AlertTriangle, DollarSign,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import apiClient from '../../lib/apiClient';
import { Company, NonFiscalInvoice } from '../../types';
import { CompaniesSection } from './CompaniesSection';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('mk-MK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('mk-MK');
}

type StatusKey = 'all' | 'pending' | 'paid' | 'overdue' | 'cancelled';

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; text: string }> = {
    pending:   { bg: 'bg-amber-500/15',      text: 'text-amber-300' },
    paid:      { bg: 'bg-emerald-500/15',    text: 'text-emerald-300' },
    overdue:   { bg: 'bg-rose-500/15',       text: 'text-rose-300' },
    cancelled: { bg: 'bg-cream-faint/10',    text: 'text-cream-faint' },
  };
  const { t } = useTranslation();
  const c = cfg[status] ?? cfg.pending;
  const label: Record<string, string> = {
    pending: t('status_pending'), paid: t('status_paid'),
    overdue: t('status_overdue'), cancelled: t('status_cancelled'),
  };
  return (
    <span className={`${c.bg} ${c.text} px-2 py-0.5 rounded-md text-xs font-medium inline-block`}>
      {label[status] ?? status}
    </span>
  );
}

// ── KPI card ─────────────────────────────────────────────────────────────────

interface KpiProps { label: string; count: number; amount: number; icon: React.ElementType; color: string }
function KpiCard({ label, count, amount, icon: Icon, color }: KpiProps) {
  return (
    <div className="bg-surface border border-warm-line rounded-2xl p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={18} className="text-current" />
      </div>
      <div>
        <p className="text-xs font-black text-cream-faint uppercase tracking-widest mb-0.5">{label}</p>
        <p className="text-2xl font-black text-cream">{count}</p>
        <p className="text-xs text-cream-muted mt-0.5">{fmt(amount)} ден.</p>
      </div>
    </div>
  );
}

// ── Invoice row ───────────────────────────────────────────────────────────────

interface InvoiceRowProps {
  invoice: NonFiscalInvoice;
  onView: () => void;
  onMarkPaid: () => void;
  onCancel: () => void;
}

function InvoiceRow({ invoice, onView, onMarkPaid, onCancel }: InvoiceRowProps) {
  const displayStatus = (invoice.computedStatus ?? invoice.status) as string;
  const canMarkPaid = displayStatus === 'pending' || displayStatus === 'overdue';
  const canCancel = invoice.status === 'pending';
  return (
    <tr className="border-b border-warm-line/50 hover:bg-surface-2/30 transition-colors">
      <td className="py-3 px-4 font-mono text-sm text-cream">{invoice.invoiceNumber ?? (invoice as any).invoice_number}</td>
      <td className="py-3 px-4 text-sm text-cream-muted">{fmtDate(invoice.issueDate ?? (invoice as any).issue_date)}</td>
      <td className="py-3 px-4">
        <p className="text-sm font-medium text-cream">{invoice.companyName ?? (invoice as any).company_name}</p>
        <p className="text-xs text-cream-faint">{invoice.companyTin ?? (invoice as any).company_tin}</p>
      </td>
      <td className="py-3 px-4 text-right text-sm font-bold text-cream">
        {fmt(Number(invoice.totalAmount ?? (invoice as any).total_amount))} ден.
      </td>
      <td className="py-3 px-4 text-sm text-cream-muted">{fmtDate(invoice.dueDate ?? (invoice as any).due_date)}</td>
      <td className="py-3 px-4"><StatusBadge status={displayStatus} /></td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-1 justify-end">
          <button onClick={onView} title="Прегледај"
            className="p-1.5 text-cream-faint hover:text-cream hover:bg-surface-2 rounded-lg transition-colors">
            <Eye size={14} />
          </button>
          {canMarkPaid && (
            <button onClick={onMarkPaid} title="Означи платена"
              className="p-1.5 text-cream-faint hover:text-emerald-400 hover:bg-emerald-900/20 rounded-lg transition-colors">
              <CheckCircle2 size={14} />
            </button>
          )}
          {canCancel && (
            <button onClick={onCancel} title="Откажи"
              className="p-1.5 text-cream-faint hover:text-rose-400 hover:bg-rose-900/20 rounded-lg transition-colors">
              <XCircle size={14} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Mark Paid Modal ───────────────────────────────────────────────────────────

interface MarkPaidModalProps {
  invoice: NonFiscalInvoice;
  onClose: () => void;
  onDone: () => void;
}

function MarkPaidModal({ invoice, onClose, onDone }: MarkPaidModalProps) {
  const { t } = useTranslation();
  const totalAmount = Number(invoice.totalAmount ?? (invoice as any).total_amount);
  const [amount, setAmount] = useState(String(totalAmount));
  const [method, setMethod] = useState<'bank_transfer' | 'cash' | 'other'>('bank_transfer');
  const [ref, setRef] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await apiClient.post(`/non-fiscal-invoices/${invoice.id}/mark-paid`, {
        paid_amount: parseFloat(amount),
        paid_method: method,
        paid_reference: ref || undefined,
        paid_at: new Date(date).toISOString(),
      });
      toast.success('Фактурата е означена како платена');
      onDone();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Грешка');
    } finally { setSaving(false); }
  };

  const inputCls = 'w-full px-4 py-3 bg-warm-input border border-warm-line rounded-xl text-sm text-cream focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all';

  return (
    <div className="fixed inset-0 bg-base/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-warm-line rounded-2xl shadow-card-lg w-full max-w-md">
        <div className="p-6 border-b border-warm-line flex items-center justify-between">
          <h3 className="text-lg font-bold text-cream">{t('mark_paid')}</h3>
          <button onClick={onClose} className="text-cream-faint hover:text-cream"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-black text-cream-faint uppercase tracking-widest mb-1.5">Платен износ</label>
            <input type="number" className={inputCls} value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-black text-cream-faint uppercase tracking-widest mb-2">Начин на плаќање</label>
            <div className="grid grid-cols-3 gap-2">
              {(['bank_transfer', 'cash', 'other'] as const).map(m => (
                <button key={m} onClick={() => setMethod(m)}
                  className={`py-2.5 px-3 rounded-xl border-2 text-xs font-bold transition-all ${
                    method === m ? 'bg-accent/10 border-accent text-accent-light' : 'bg-surface-2 border-warm-line text-cream-muted'
                  }`}>
                  {m === 'bank_transfer' ? 'Банка' : m === 'cash' ? 'Готовина' : 'Друго'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-black text-cream-faint uppercase tracking-widest mb-1.5">Референца (опционално)</label>
            <input type="text" className={inputCls} value={ref} onChange={e => setRef(e.target.value)} placeholder="Референтен број" />
          </div>
          <div>
            <label className="block text-xs font-black text-cream-faint uppercase tracking-widest mb-1.5">Датум на плаќање</label>
            <input type="date" className={inputCls} value={date} onChange={e => setDate(e.target.value)} />
          </div>
        </div>
        <div className="p-6 pt-0 flex gap-3 justify-end">
          <button onClick={onClose} className="px-5 py-2.5 bg-surface-2 text-cream-muted rounded-xl font-black text-xs uppercase tracking-widest hover:bg-warm-input transition-all">
            Откажи
          </button>
          <button onClick={submit} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 disabled:opacity-50 transition-all">
            <Save size={13} />
            {saving ? 'Зачувување...' : 'Потврди'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Invoice Detail Modal ──────────────────────────────────────────────────────

interface DetailModalProps {
  invoice: NonFiscalInvoice & Record<string, any>;
  onClose: () => void;
}

function InvoiceDetailModal({ invoice, onClose }: DetailModalProps) {
  const { t } = useTranslation();
  const items = invoice.items ?? [];
  const totalAmount = Number(invoice.totalAmount ?? invoice.total_amount);
  const subtotal = Number(invoice.subtotal);
  const vatAmount = Number(invoice.vatAmount ?? invoice.vat_amount);
  const vatRate = Number(invoice.vatRate ?? invoice.vat_rate);

  const printInvoice = () => window.print();

  return (
    <div className="fixed inset-0 bg-base/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-warm-line rounded-2xl shadow-card-lg w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-warm-line flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-lg font-bold text-cream">{invoice.invoice_number ?? invoice.invoiceNumber}</h3>
            <StatusBadge status={invoice.computedStatus ?? invoice.status} />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={printInvoice}
              className="flex items-center gap-2 px-3 py-2 bg-surface-2 border border-warm-line text-cream-muted rounded-xl text-xs font-bold hover:bg-warm-input transition-all">
              <Printer size={14} /> Печати
            </button>
            <button onClick={onClose} className="text-cream-faint hover:text-cream"><X size={20} /></button>
          </div>
        </div>
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Header info */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-black text-cream-faint uppercase tracking-widest mb-2">Издавач</p>
              <p className="text-sm font-bold text-cream">{invoice.restaurant_name}</p>
              {invoice.restaurant_address && <p className="text-xs text-cream-muted">{invoice.restaurant_address}</p>}
              {invoice.restaurant_edb && <p className="text-xs text-cream-muted">ЕДБ: {invoice.restaurant_edb}</p>}
              {invoice.restaurant_bank_account && <p className="text-xs text-cream-muted">Жиро: {invoice.restaurant_bank_account}</p>}
            </div>
            <div>
              <p className="text-xs font-black text-cream-faint uppercase tracking-widest mb-2">Примач</p>
              <p className="text-sm font-bold text-cream">{invoice.company_name}</p>
              {invoice.company_address && <p className="text-xs text-cream-muted">{invoice.company_address}</p>}
              {invoice.company_tin && <p className="text-xs text-cream-muted">ЕДБ: {invoice.company_tin}</p>}
              {invoice.company_bank_account && <p className="text-xs text-cream-muted">Жиро: {invoice.company_bank_account}</p>}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs font-black text-cream-faint uppercase tracking-widest mb-1">{t('issue_date')}</p>
              <p className="text-cream">{fmtDate(invoice.issue_date ?? invoice.issueDate)}</p>
            </div>
            <div>
              <p className="text-xs font-black text-cream-faint uppercase tracking-widest mb-1">{t('due_date')}</p>
              <p className="text-cream">{fmtDate(invoice.due_date ?? invoice.dueDate)}</p>
            </div>
            <div>
              <p className="text-xs font-black text-cream-faint uppercase tracking-widest mb-1">ДДВ стапка</p>
              <p className="text-cream">{vatRate}%</p>
            </div>
          </div>

          {/* Items table */}
          {items.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-warm-line">
                    {['Опис', 'Кол.', 'Цена', 'Вкупно'].map(h => (
                      <th key={h} className="text-left text-[10px] font-black text-cream-faint uppercase tracking-widest py-2 last:text-right">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((it: any, i: number) => (
                    <tr key={i} className="border-b border-warm-line/40">
                      <td className="py-2 text-cream">{it.name}</td>
                      <td className="py-2 text-cream-muted">{Number(it.quantity)}</td>
                      <td className="py-2 text-cream-muted">{fmt(Number(it.unit_price))} ден.</td>
                      <td className="py-2 text-right text-cream font-medium">{fmt(Number(it.total))} ден.</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Totals */}
          <div className="border-t border-warm-line pt-4 space-y-1.5">
            <div className="flex justify-between text-sm text-cream-muted">
              <span>Основица</span><span>{fmt(subtotal)} ден.</span>
            </div>
            <div className="flex justify-between text-sm text-cream-muted">
              <span>ДДВ ({vatRate}%)</span><span>{fmt(vatAmount)} ден.</span>
            </div>
            <div className="flex justify-between text-base font-black text-cream border-t border-warm-line pt-2 mt-2">
              <span>Вкупно</span><span>{fmt(totalAmount)} ден.</span>
            </div>
          </div>

          {/* Payment info */}
          {invoice.status === 'paid' && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-sm">
              <p className="text-emerald-300 font-bold mb-1">Платена</p>
              {invoice.paid_at && <p className="text-emerald-200/70">Датум: {fmtDate(invoice.paid_at)}</p>}
              {invoice.paid_method && <p className="text-emerald-200/70">Начин: {invoice.paid_method}</p>}
              {invoice.paid_reference && <p className="text-emerald-200/70">Референца: {invoice.paid_reference}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Cancel Dialog ─────────────────────────────────────────────────────────────

interface CancelDialogProps {
  invoice: NonFiscalInvoice;
  onClose: () => void;
  onDone: () => void;
}

function CancelDialog({ invoice, onClose, onDone }: CancelDialogProps) {
  const [saving, setSaving] = useState(false);
  const hasOrder = !!(invoice.orderId ?? (invoice as any).order_id);

  const confirm = async () => {
    setSaving(true);
    try {
      await apiClient.post(`/non-fiscal-invoices/${invoice.id}/cancel`, {});
      toast.success('Фактурата е откажана');
      onDone();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Грешка');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-base/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-warm-line rounded-2xl shadow-card-lg w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-cream">Откажи фактура</h3>
          <button onClick={onClose} className="text-cream-faint hover:text-cream"><X size={20} /></button>
        </div>
        {hasOrder && (
          <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-4">
            <AlertTriangle size={16} className="text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-300">
              Откажувањето ќе ја поврати оригиналната нарачка во статус „отворена".
            </p>
          </div>
        )}
        <p className="text-cream-muted text-sm mb-6">
          Дали сте сигурни дека сакате да ја откажете фактурата{' '}
          <strong className="text-cream">{invoice.invoiceNumber ?? (invoice as any).invoice_number}</strong>?
        </p>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-5 py-2.5 bg-surface-2 text-cream-muted rounded-xl font-black text-xs uppercase tracking-widest hover:bg-warm-input transition-all">
            Назад
          </button>
          <button onClick={confirm} disabled={saving}
            className="px-5 py-2.5 bg-rose-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-rose-700 disabled:opacity-50 transition-all">
            {saving ? 'Откажување...' : 'Потврди откажување'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const NonFiscalInvoicesPage: React.FC = () => {
  const { t } = useTranslation();
  const [invoices, setInvoices] = useState<NonFiscalInvoice[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusKey>('all');
  const [companyFilter, setCompanyFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [viewing, setViewing] = useState<NonFiscalInvoice | null>(null);
  const [markPaying, setMarkPaying] = useState<NonFiscalInvoice | null>(null);
  const [cancelling, setCancelling] = useState<NonFiscalInvoice | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (companyFilter) params.company_id = companyFilter;
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;
      const res = await apiClient.get('/non-fiscal-invoices', { params });
      setInvoices(res.data);
    } catch { toast.error('Грешка при вчитување'); }
    finally { setLoading(false); }
  }, [statusFilter, companyFilter, fromDate, toDate]);

  useEffect(() => { load(); }, [load]);

  // KPI calculations (use computed_status from API)
  const getStatus = (inv: any) => inv.computed_status ?? inv.computedStatus ?? inv.status;
  const kpi = {
    pending: invoices.filter(i => getStatus(i) === 'pending'),
    paid:    invoices.filter(i => getStatus(i) === 'paid'),
    overdue: invoices.filter(i => getStatus(i) === 'overdue'),
  };
  const sum = (arr: NonFiscalInvoice[]) =>
    arr.reduce((s, i) => s + Number((i as any).total_amount ?? i.totalAmount ?? 0), 0);

  const STATUSES: StatusKey[] = ['all', 'pending', 'paid', 'overdue', 'cancelled'];

  return (
    <div className="p-6 max-w-screen-2xl mx-auto space-y-8 pb-16">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-serif italic text-3xl text-cream mb-1">{t('non_fiscal_invoices_title')}</h1>
          <p className="text-cream-muted text-sm">{t('manage_b2b_invoices')}</p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label={t('status_pending')} count={kpi.pending.length} amount={sum(kpi.pending)}
          icon={Clock} color="bg-amber-500/15 text-amber-300" />
        <KpiCard label={t('status_paid')} count={kpi.paid.length} amount={sum(kpi.paid)}
          icon={CheckCircle2} color="bg-emerald-500/15 text-emerald-300" />
        <KpiCard label={t('status_overdue')} count={kpi.overdue.length} amount={sum(kpi.overdue)}
          icon={AlertTriangle} color="bg-rose-500/15 text-rose-300" />
        <KpiCard label={t('total')} count={invoices.filter(i => getStatus(i) !== 'cancelled').length}
          amount={sum(invoices.filter(i => getStatus(i) !== 'cancelled'))}
          icon={TrendingUp} color="bg-surface-2 text-cream-muted" />
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="flex gap-1 bg-surface border border-warm-line rounded-xl p-1">
          {STATUSES.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === s ? 'bg-accent text-[#faf5ee]' : 'text-cream-muted hover:text-cream'
              }`}>
              {t(`status_${s}` as any)}
            </button>
          ))}
        </div>

        {companies.length > 0 && (
          <select value={companyFilter} onChange={e => setCompanyFilter(e.target.value)}
            className="bg-warm-input border border-warm-line rounded-xl px-4 py-2 text-sm text-cream focus:outline-none focus:ring-2 focus:ring-accent/20">
            <option value="">{t('all_companies')}</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}

        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
          className="bg-warm-input border border-warm-line rounded-xl px-4 py-2 text-sm text-cream focus:outline-none focus:ring-2 focus:ring-accent/20" />
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
          className="bg-warm-input border border-warm-line rounded-xl px-4 py-2 text-sm text-cream focus:outline-none focus:ring-2 focus:ring-accent/20" />
      </div>

      {/* Invoices table */}
      <div className="bg-surface border border-warm-line rounded-card overflow-hidden">
        <table className="w-full">
          <thead className="bg-surface-2 border-b border-warm-line">
            <tr>
              {[t('invoice_number'), t('issue_date'), t('company'), t('amount'), t('due_date'), t('status'), ''].map(h => (
                <th key={h} className="text-left text-[10px] font-black text-cream-faint uppercase tracking-widest py-3 px-4 last:w-28">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="py-12 text-center text-cream-faint text-sm">Вчитување...</td></tr>
            ) : invoices.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center">
                  <FileText size={32} className="text-cream-faint mx-auto mb-3" />
                  <p className="text-cream-muted text-sm">Нема фактури</p>
                </td>
              </tr>
            ) : invoices.map(inv => (
              <InvoiceRow
                key={inv.id}
                invoice={inv}
                onView={() => setViewing(inv)}
                onMarkPaid={() => setMarkPaying(inv)}
                onCancel={() => setCancelling(inv)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Companies section */}
      <CompaniesSection onCompaniesChange={setCompanies} />

      {/* Modals */}
      {viewing && (
        <InvoiceDetailModal
          invoice={viewing as any}
          onClose={() => setViewing(null)}
        />
      )}
      {markPaying && (
        <MarkPaidModal
          invoice={markPaying}
          onClose={() => setMarkPaying(null)}
          onDone={() => { setMarkPaying(null); load(); }}
        />
      )}
      {cancelling && (
        <CancelDialog
          invoice={cancelling}
          onClose={() => setCancelling(null)}
          onDone={() => { setCancelling(null); load(); }}
        />
      )}
    </div>
  );
};

export default NonFiscalInvoicesPage;
