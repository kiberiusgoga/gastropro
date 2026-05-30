import React, { useEffect, useState } from 'react';
import { Clock, Play, Square, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import apiClient from '../../lib/apiClient';

interface WorkEntry {
  id: string;
  clock_in: string;
  clock_out: string | null;
}

interface ClockWidgetProps {
  onClockOut?: () => void;
}

function formatElapsed(clockIn: string): string {
  const diff = Math.floor((Date.now() - new Date(clockIn).getTime()) / 1000);
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  return `${h}ч ${m}мин`;
}

const ClockWidget: React.FC<ClockWidgetProps> = ({ onClockOut }) => {
  const { t } = useTranslation();
  const [entry, setEntry] = useState<WorkEntry | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const [showClockOutModal, setShowClockOutModal] = useState(false);

  useEffect(() => {
    apiClient.get('/work-entries/current')
      .then(r => setEntry(r.data))
      .catch(() => setEntry(null));
  }, []);

  useEffect(() => {
    if (!entry) return;
    const id = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(id);
  }, [entry]);

  const clockIn = async () => {
    setLoading(true);
    try {
      const r = await apiClient.post('/work-entries/clock-in');
      setEntry(r.data);
      toast.success(t('clocked_in_success'));
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? t('error'));
    } finally {
      setLoading(false);
    }
  };

  const doClockOut = async (breakMinutes: number, notes: string) => {
    setLoading(true);
    try {
      await apiClient.post('/work-entries/clock-out', { break_minutes: breakMinutes, notes: notes || undefined });
      setEntry(null);
      setShowClockOutModal(false);
      toast.success(t('clocked_out_success'));
      onClockOut?.();
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? t('error'));
    } finally {
      setLoading(false);
    }
  };

  if (entry === undefined) {
    return (
      <div className="rounded-card border border-warm-line bg-surface p-4 flex items-center gap-3">
        <Loader2 size={18} className="animate-spin text-cream-faint" />
        <span className="text-sm text-cream-faint">…</span>
      </div>
    );
  }

  return (
    <>
      <div className={`rounded-card border p-4 flex flex-col sm:flex-row sm:items-center gap-4 ${
        entry ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-warm-line bg-surface'
      }`}>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          entry ? 'bg-emerald-500/15' : 'bg-surface-2'
        }`}>
          <Clock size={20} className={entry ? 'text-emerald-400' : 'text-cream-faint'} />
        </div>

        <div className="flex-1">
          {entry ? (
            <>
              <p className="text-sm font-black text-cream uppercase tracking-wide">{t('currently_working')}</p>
              <p className="text-xs text-cream-faint mt-0.5">
                {t('since')} {new Date(entry.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {' · '}
                <span className="text-emerald-400 font-bold">{formatElapsed(entry.clock_in)}</span>
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-black text-cream uppercase tracking-wide">{t('not_clocked_in')}</p>
              <p className="text-xs text-cream-faint mt-0.5">{t('hr_clock_in')} {t('since').toLowerCase()} …</p>
            </>
          )}
        </div>

        {entry ? (
          <button
            onClick={() => setShowClockOutModal(true)}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-rose-500 text-white rounded-btn font-black text-xs uppercase tracking-widest hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all"
          >
            <Square size={14} />
            {t('hr_clock_out')}
          </button>
        ) : (
          <button
            onClick={clockIn}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white rounded-btn font-black text-xs uppercase tracking-widest hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            {t('hr_clock_in')}
          </button>
        )}
      </div>

      {showClockOutModal && entry && (
        <ClockOutModal
          clockIn={entry.clock_in}
          onConfirm={doClockOut}
          onClose={() => setShowClockOutModal(false)}
          loading={loading}
        />
      )}
    </>
  );
};

interface ClockOutModalProps {
  clockIn: string;
  onConfirm: (breakMinutes: number, notes: string) => void;
  onClose: () => void;
  loading: boolean;
}

export const ClockOutModal: React.FC<ClockOutModalProps> = ({ clockIn, onConfirm, onClose, loading }) => {
  const { t } = useTranslation();
  const [breakMin, setBreakMin] = useState(30);
  const [notes, setNotes] = useState('');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-base/80 backdrop-blur-sm">
      <div className="bg-surface border border-warm-line rounded-3xl p-8 w-full max-w-md shadow-xl">
        <h2 className="text-lg font-black text-cream uppercase tracking-widest mb-6">{t('clock_out_confirm')}</h2>

        <div className="mb-5 p-4 bg-surface-2 rounded-2xl">
          <p className="text-xs text-cream-faint uppercase tracking-widest mb-1">{t('elapsed_time')}</p>
          <p className="text-2xl font-black text-cream">{formatElapsed(clockIn)}</p>
          <p className="text-xs text-cream-faint mt-1">{t('since')} {new Date(clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-xs font-black text-cream-faint uppercase tracking-widest mb-2">
              {t('break_minutes_label')}
            </label>
            <input
              type="number"
              min={0} max={480}
              value={breakMin}
              onChange={e => setBreakMin(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full px-4 py-3 bg-warm-input border border-warm-line rounded-xl text-sm text-cream focus:outline-none focus:ring-2 focus:ring-accent/20"
              placeholder={t('break_minutes_placeholder')}
            />
          </div>
          <div>
            <label className="block text-xs font-black text-cream-faint uppercase tracking-widest mb-2">
              {t('hr_notes')}
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 bg-warm-input border border-warm-line rounded-xl text-sm text-cream focus:outline-none focus:ring-2 focus:ring-accent/20 resize-none"
              placeholder="…"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-5 py-3 bg-surface-2 text-cream-muted rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-warm-input transition-all"
          >
            {t('cancel')}
          </button>
          <button
            onClick={() => onConfirm(breakMin, notes)}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-rose-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Square size={13} />}
            {t('hr_clock_out')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClockWidget;
