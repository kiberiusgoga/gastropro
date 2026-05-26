import React, { useState, useEffect, useCallback } from 'react';
import { Mail, ChevronDown, ChevronUp, Copy, Send, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import apiClient from '../../lib/apiClient';
import type { SupplierConsumption, SupplierEmailLog } from '../../types';

const fmt = (n: number) =>
  n.toLocaleString('mk-MK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const map: Record<string, { label: string; cls: string }> = {
    sent:   { label: t('email_sent'),   cls: 'bg-emerald-900/30 text-emerald-400 border-emerald-800/40' },
    failed: { label: t('email_failed'), cls: 'bg-red-900/30 text-red-400 border-red-800/40' },
    manual: { label: t('email_manual'), cls: 'bg-amber-900/30 text-amber-400 border-amber-800/40' },
    draft:  { label: 'Draft',           cls: 'bg-surface-2 text-cream-faint border-warm-line' },
  };
  const s = map[status] ?? map.draft;
  return (
    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border uppercase tracking-wider ${s.cls}`}>
      {s.label}
    </span>
  );
}

interface EmailPreviewModalProps {
  shiftId: string;
  supplierId: string;
  supplierName: string;
  onClose: () => void;
  onSent: () => void;
}

function EmailPreviewModal({ shiftId, supplierId, supplierName, onClose, onSent }: EmailPreviewModalProps) {
  const { t } = useTranslation();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    apiClient.post('/supplier-emails/preview', { shiftId, supplierId })
      .then(r => {
        setSubject(r.data.subject);
        setBody(r.data.text);
        setEmail(r.data.supplierEmail);
      })
      .catch(() => toast.error('Грешка при генерирање на емаил'))
      .finally(() => setLoading(false));
  }, [shiftId, supplierId]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`)
      .then(() => toast.success('Копирано'))
      .catch(() => toast.error('Неуспешно копирање'));
  };

  const sendNow = async () => {
    setSending(true);
    try {
      const res = await apiClient.post('/supplier-emails/send', { shiftId, supplierId, subject, body });
      if (res.data.status === 'sent') {
        toast.success(`Емаилот е пратен до ${supplierName}`);
      } else if (res.data.status === 'manual') {
        toast.info('SMTP не е конфигуриран — емаилот е евидентиран за рачно испраќање');
      } else {
        toast.error('Испраќањето не успеа — евидентирано');
      }
      onSent();
      onClose();
    } catch {
      toast.error('Грешка при испраќање');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-surface border border-warm-line rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="px-8 py-6 border-b border-warm-line flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-serif italic text-xl text-cream">{t('email_preview')}</h3>
            <p className="text-cream-faint text-sm mt-0.5">{supplierName}</p>
          </div>
          <button onClick={onClose} className="text-cream-faint hover:text-cream transition-colors">✕</button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <Loader2 size={32} className="animate-spin text-accent" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-8 space-y-4">
            <div>
              <label className="block text-xs font-black text-cream-faint uppercase tracking-widest mb-2">
                {t('email_subject')}
              </label>
              <input
                className="w-full px-4 py-3 bg-warm-input border border-warm-line rounded-xl text-sm text-cream focus:outline-none focus:ring-2 focus:ring-accent/20"
                value={subject}
                onChange={e => setSubject(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-black text-cream-faint uppercase tracking-widest mb-2">
                {t('email_body')}
              </label>
              <textarea
                rows={14}
                className="w-full px-4 py-3 bg-warm-input border border-warm-line rounded-xl text-sm text-cream font-mono focus:outline-none focus:ring-2 focus:ring-accent/20 resize-y"
                value={body}
                onChange={e => setBody(e.target.value)}
              />
            </div>
            {email && (
              <p className="text-xs text-cream-faint">
                Примач: <span className="text-cream-muted font-medium">{email}</span>
              </p>
            )}
            {!email && (
              <p className="text-xs text-amber-400">
                Добавувачот нема е-пошта — емаилот ќе се евидентира за рачно испраќање.
              </p>
            )}
          </div>
        )}

        <div className="px-8 py-5 border-t border-warm-line flex gap-3 shrink-0">
          <button
            onClick={copyToClipboard}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-warm-line text-sm font-black text-cream-muted hover:bg-surface-2 transition-all"
          >
            <Copy size={15} />
            {t('copy_to_clipboard')}
          </button>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-warm-line text-sm font-black text-cream-muted hover:bg-surface-2 transition-all"
          >
            {t('cancel')}
          </button>
          <button
            onClick={sendNow}
            disabled={sending || loading}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-accent hover:brightness-110 text-[#faf5ee] text-sm font-black uppercase tracking-wide transition-all shadow-card disabled:opacity-50"
          >
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            {t('send_now')}
          </button>
        </div>
      </div>
    </div>
  );
}

interface Props {
  shiftId: string;
}

const SupplierConsumptionSection: React.FC<Props> = ({ shiftId }) => {
  const { t } = useTranslation();
  const [consumption, setConsumption] = useState<SupplierConsumption[]>([]);
  const [emailLog, setEmailLog] = useState<SupplierEmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [previewModal, setPreviewModal] = useState<{ supplierId: string; supplierName: string } | null>(null);

  const load = useCallback(() => {
    Promise.all([
      apiClient.get(`/supplier-consumption?shiftId=${shiftId}`),
      apiClient.get(`/supplier-email-log?shiftId=${shiftId}`),
    ])
      .then(([c, l]) => {
        setConsumption(c.data);
        setEmailLog(l.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [shiftId]);

  useEffect(() => { load(); }, [load]);

  const toggleExpand = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const getEmailStatus = (supplierId: string) =>
    emailLog
      .filter(l => l.supplier_id === supplierId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

  if (loading) return null;
  if (!consumption.length) return null;

  return (
    <>
      <div className="bg-surface border border-warm-line rounded-2xl p-6 mb-6 print:hidden">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-serif italic text-xl text-cream mb-1">{t('supplier_consumption_report')}</h3>
            <p className="text-cream-muted text-sm">{t('per_supplier_breakdown')}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-widest text-cream-faint border-b border-warm-line">
                <th className="text-left pb-3">{t('supplier')}</th>
                <th className="text-right pb-3">{t('products_count')}</th>
                <th className="text-right pb-3">{t('total_value')}</th>
                <th className="text-center pb-3">{t('email_status')}</th>
                <th className="text-right pb-3">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {consumption.map(s => {
                const logEntry = getEmailStatus(s.supplier_id);
                const isExpanded = expanded.has(s.supplier_id);
                return (
                  <React.Fragment key={s.supplier_id}>
                    <tr className="border-b border-warm-line/50 hover:bg-surface-2/30 transition-colors">
                      <td className="py-3 pr-4">
                        <div className="font-medium text-cream">{s.supplier_name}</div>
                        {s.supplier_email && (
                          <div className="text-xs text-cream-faint mt-0.5">{s.supplier_email}</div>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => toggleExpand(s.supplier_id)}
                          className="flex items-center gap-1 ml-auto text-cream-muted hover:text-cream transition-colors font-medium"
                        >
                          {s.product_count} {t('products_count').toLowerCase()}
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      </td>
                      <td className="py-3 text-right font-black text-cream">
                        {fmt(s.total_value)} ден.
                      </td>
                      <td className="py-3 text-center">
                        {logEntry ? <StatusBadge status={logEntry.status} /> : (
                          <span className="text-cream-faint text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => setPreviewModal({ supplierId: s.supplier_id, supplierName: s.supplier_name })}
                          className="flex items-center gap-1.5 ml-auto px-3 py-1.5 rounded-lg bg-accent/10 hover:bg-accent/20 text-accent-light text-xs font-black uppercase tracking-wide transition-all"
                        >
                          <Mail size={13} />
                          {t('compose_emails')}
                        </button>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr>
                        <td colSpan={5} className="pb-3 pt-0">
                          <div className="bg-surface-2/50 rounded-xl p-4 ml-2">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-cream-faint border-b border-warm-line/50">
                                  <th className="text-left pb-1.5 font-black uppercase tracking-wider">Производ</th>
                                  <th className="text-right pb-1.5 font-black uppercase tracking-wider">Количина</th>
                                  <th className="text-center pb-1.5 font-black uppercase tracking-wider">Единица</th>
                                  <th className="text-right pb-1.5 font-black uppercase tracking-wider">Цена/ед.</th>
                                  <th className="text-right pb-1.5 font-black uppercase tracking-wider">Вредност</th>
                                </tr>
                              </thead>
                              <tbody>
                                {s.products.map(p => (
                                  <tr key={p.product_id} className="border-b border-warm-line/30 last:border-0">
                                    <td className="py-1.5 text-cream-muted">{p.product_name}</td>
                                    <td className="py-1.5 text-right text-cream font-medium">{p.quantity}</td>
                                    <td className="py-1.5 text-center text-cream-faint">{p.unit}</td>
                                    <td className="py-1.5 text-right text-cream-faint">{fmt(p.unit_price)} ден.</td>
                                    <td className="py-1.5 text-right text-cream font-black">{fmt(p.total)} ден.</td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr>
                                  <td colSpan={4} className="pt-2 font-black text-cream text-xs">Вкупно</td>
                                  <td className="pt-2 text-right font-black text-cream">{fmt(s.total_value)} ден.</td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Email log */}
        {emailLog.length > 0 && (
          <div className="mt-6 pt-6 border-t border-warm-line">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-cream-faint mb-3">
              {t('email_log')}
            </h4>
            <div className="space-y-2">
              {emailLog.map(l => (
                <div
                  key={l.id}
                  className="flex items-center justify-between py-2 px-3 bg-surface-2/40 rounded-xl text-xs"
                >
                  <div className="flex items-center gap-3">
                    {l.status === 'sent'   && <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />}
                    {l.status === 'failed' && <XCircle size={14} className="text-red-400 shrink-0" />}
                    {l.status === 'manual' && <Clock size={14} className="text-amber-400 shrink-0" />}
                    <div>
                      <span className="font-medium text-cream-muted">{l.supplier_name}</span>
                      {l.subject && <span className="text-cream-faint ml-2">— {l.subject}</span>}
                      {l.error_message && (
                        <p className="text-red-400 text-[10px] mt-0.5">{l.error_message}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <StatusBadge status={l.status} />
                    <span className="text-cream-faint">
                      {new Date(l.created_at).toLocaleTimeString('mk-MK', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {l.status === 'failed' && l.supplier_id && (
                      <button
                        onClick={() => setPreviewModal({ supplierId: l.supplier_id!, supplierName: l.supplier_name })}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-900/30 hover:bg-red-900/50 text-red-400 text-[10px] font-black uppercase tracking-wide transition-all"
                      >
                        <Mail size={11} />
                        {t('resend')}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {previewModal && (
        <EmailPreviewModal
          shiftId={shiftId}
          supplierId={previewModal.supplierId}
          supplierName={previewModal.supplierName}
          onClose={() => setPreviewModal(null)}
          onSent={load}
        />
      )}
    </>
  );
};

export default SupplierConsumptionSection;
