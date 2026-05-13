import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, AlertTriangle, TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import apiClient from '../../lib/apiClient';
import type { ZReportData } from '../../services/zreportService';

interface Props {
  shiftId: string;
  onClose: () => void;
  onClosed: (zreport: ZReportData) => void;
}

const CloseShiftModal: React.FC<Props> = ({ shiftId, onClose, onClosed }) => {
  const { t } = useTranslation();
  const [actualCash, setActualCash] = useState('');
  const [notes, setNotes] = useState('');
  const [preview, setPreview] = useState<ZReportData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiClient.get(`/shifts/${shiftId}/preview`)
      .then(r => setPreview(r.data))
      .catch(() => toast.error('Грешка при вчитување на прегледот'))
      .finally(() => setLoadingPreview(false));
  }, [shiftId]);

  const actual = parseFloat(actualCash) || 0;
  const expected = preview?.expected_cash ?? 0;
  const difference = actual - expected;
  const diffAbs = Math.abs(difference);

  const diffColor =
    difference === 0 ? 'text-emerald-500' :
    diffAbs <= 50 ? 'text-amber-500' : 'text-red-500';

  const diffBg =
    difference === 0 ? 'bg-emerald-500/10 border-emerald-500/20' :
    diffAbs <= 50 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-red-500/10 border-red-500/20';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actualCash.trim()) {
      toast.error('Внеси реален кеш пред да затвориш');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiClient.post(`/shifts/${shiftId}/close`, {
        actual_cash: actual,
        notes: notes || undefined,
      });
      toast.success(t('shift_closed_success'));
      onClosed(res.data.zreport);
    } catch (err: any) {
      const code = err?.response?.data?.code;
      if (code === 'SHIFT_HAS_OPEN_ORDERS') {
        const count = err.response.data.open_order_count;
        toast.error(`Не може да се затвори — има ${count} отворени нарачки`);
      } else if (code === 'SHIFT_ALREADY_CLOSED') {
        toast.error('Сменава е веќе затворена');
      } else {
        toast.error('Грешка при затворање на смената');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-zinc-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={e => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 16 }}
          className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
            <div>
              <h2 className="text-lg font-black dark:text-white uppercase tracking-tight">
                {t('close_shift')}
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">{t('close_shift_subtitle')}</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 transition-colors">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Preview summary */}
            {loadingPreview ? (
              <div className="flex items-center justify-center py-6 text-zinc-400 gap-2">
                <Loader2 size={18} className="animate-spin" />
                <span className="text-sm font-bold">Се вчитува...</span>
              </div>
            ) : preview && (
              <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-500 font-medium">{t('gross_revenue')}</span>
                  <span className="font-black dark:text-white">{preview.totals.gross_revenue.toLocaleString()} ден.</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500 font-medium">{t('order_count')}</span>
                  <span className="font-black dark:text-white">{preview.totals.order_count}</span>
                </div>
                <div className="flex justify-between border-t border-zinc-200 dark:border-zinc-700 pt-2 mt-2">
                  <span className="text-zinc-500 font-medium">{t('expected_cash')}</span>
                  <span className="font-black dark:text-white">{preview.expected_cash.toLocaleString()} ден.</span>
                </div>
              </div>
            )}

            {/* Actual cash input */}
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-2">
                {t('actual_cash')} *
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={actualCash}
                onChange={e => setActualCash(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 dark:text-white transition-all"
                autoFocus
              />
            </div>

            {/* Real-time difference */}
            {actualCash !== '' && preview && (
              <div className={`rounded-xl border p-4 space-y-2 text-sm ${diffBg}`}>
                <div className="flex justify-between">
                  <span className="text-zinc-500 font-medium">{t('expected_cash')}</span>
                  <span className="font-black dark:text-white">{expected.toLocaleString()} ден.</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500 font-medium">{t('actual_cash')}</span>
                  <span className="font-black dark:text-white">{actual.toLocaleString()} ден.</span>
                </div>
                <div className={`flex items-center justify-between pt-2 border-t border-current/10 font-black ${diffColor}`}>
                  <div className="flex items-center gap-1.5">
                    {difference > 0 ? <TrendingUp size={14} /> : difference < 0 ? <TrendingDown size={14} /> : <Minus size={14} />}
                    <span>{t('cash_difference')}</span>
                  </div>
                  <span>
                    {difference > 0 ? '+' : ''}{difference.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ден.
                    {difference > 0 && <span className="ml-1 font-medium opacity-70">({t('surplus')})</span>}
                    {difference < 0 && <span className="ml-1 font-medium opacity-70">({t('shortage')})</span>}
                  </span>
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-2">
                {t('notes')} ({t('optional')})
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                maxLength={1000}
                placeholder="Забелешки за сменава..."
                className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 dark:text-white transition-all"
              />
            </div>

            {/* Warning */}
            <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">{t('close_shift_warning')}</p>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-black uppercase tracking-wide text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={submitting || loadingPreview}
                className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-black uppercase tracking-wide hover:bg-red-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                {t('close_and_generate_z')}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CloseShiftModal;
