import React, { useEffect, useState, useCallback } from 'react';
import {
  Clock, Users, TrendingUp, AlertTriangle, Plus, Pencil, Trash2,
  Download, Save, Loader2, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import apiClient from '../../lib/apiClient';
import { useStore } from '../../store/useStore';
import ClockWidget from './ClockWidget';
import ManualEntryModal from './ManualEntryModal';

// ─── Types ────────────────────────────────────────────────────────────────────

interface HrSummary {
  active_employees: number;
  currently_clocked_in: number;
  total_hours_this_week: number;
  total_hours_this_month: number;
  overtime_this_week: number;
  top_hours_user: { name: string; hours: number } | null;
}

interface WeeklyRow {
  user_id: string;
  user_name: string;
  user_role: string;
  week_start: string;
  entry_count: number;
  total_hours: number;
  overtime: number;
}

interface WorkEntry {
  id: string;
  user_id: string;
  user_name: string;
  user_role: string;
  clock_in: string;
  clock_out: string | null;
  break_minutes: number;
  hours_worked: number | null;
  notes: string | null;
}

interface HrSettings {
  weekly_overtime_threshold: number;
  daily_overtime_threshold: number;
  week_starts_on: number;
  default_break_minutes: number;
}

interface Employee { id: string; name: string; role: string; }

// ─── KPI Card ─────────────────────────────────────────────────────────────────

const KpiCard: React.FC<{
  label: string; value: string | number; icon: React.ElementType;
  color: string; highlight?: boolean;
}> = ({ label, value, icon: Icon, color, highlight }) => (
  <div className={`rounded-card border p-4 md:p-6 flex flex-col gap-3 ${
    highlight ? 'border-amber-500/30 bg-amber-500/5' : 'border-warm-line bg-surface'
  }`}>
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
      <Icon size={18} />
    </div>
    <div>
      <p className="text-[10px] font-black text-cream-faint uppercase tracking-widest mb-1">{label}</p>
      <p className="text-2xl font-black text-cream">{value}</p>
    </div>
  </div>
);

const inputCls = 'px-3 py-2 bg-warm-input border border-warm-line rounded-xl text-sm font-medium text-cream focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/50 transition-all';

// ─── HRPage ───────────────────────────────────────────────────────────────────

const HRPage: React.FC = () => {
  const { t } = useTranslation();
  const { user, employees } = useStore();
  const isManager = ['Admin', 'Manager'].includes(user?.role ?? '');

  const [summary, setSummary] = useState<HrSummary | null>(null);
  const [weekly, setWeekly] = useState<WeeklyRow[]>([]);
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [settings, setSettings] = useState<HrSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterUser, setFilterUser] = useState('');
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 28);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Modals
  const [showManual, setShowManual] = useState(false);
  const [editingEntry, setEditingEntry] = useState<WorkEntry | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Settings edit state
  const [settingsForm, setSettingsForm] = useState<HrSettings>({
    weekly_overtime_threshold: 40,
    daily_overtime_threshold: 8,
    week_starts_on: 1,
    default_break_minutes: 30,
  });
  const [savingSettings, setSavingSettings] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterUser) params.set('user_id', filterUser);
      if (fromDate)   params.set('from_date', fromDate);
      if (toDate)     params.set('to_date', toDate);

      const promises: Promise<any>[] = [
        apiClient.get(`/work-entries?${params}`),
      ];
      if (isManager) {
        promises.push(
          apiClient.get('/work-hours/summary'),
          apiClient.get(`/work-hours/weekly?from_date=${fromDate}&to_date=${toDate}`),
          apiClient.get('/hr-settings'),
        );
      }
      const results = await Promise.all(promises);
      setEntries(results[0].data);
      if (isManager) {
        setSummary(results[1].data);
        setWeekly(results[2].data);
        const s = results[3].data;
        setSettings(s);
        setSettingsForm({
          weekly_overtime_threshold: Number(s.weekly_overtime_threshold),
          daily_overtime_threshold: Number(s.daily_overtime_threshold),
          week_starts_on: Number(s.week_starts_on),
          default_break_minutes: Number(s.default_break_minutes),
        });
      }
    } catch (e) {
      toast.error(t('error'));
    } finally {
      setLoading(false);
    }
  }, [filterUser, fromDate, toDate, isManager, t]);

  useEffect(() => { load(); }, [load]);

  const deleteEntry = async (id: string) => {
    if (!confirm(t('confirm'))) return;
    try {
      await apiClient.delete(`/work-entries/${id}`);
      toast.success(t('success'));
      load();
    } catch {
      toast.error(t('error'));
    }
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      await apiClient.put('/hr-settings', settingsForm);
      toast.success(t('save'));
      setShowSettings(false);
      load();
    } catch {
      toast.error(t('error'));
    } finally {
      setSavingSettings(false);
    }
  };

  const exportCsv = () => {
    const headers = [t('employee'), 'Role', t('weekly_view'), t('total_hours'), t('overtime'), t('hr_entries')];
    const rows = weekly.map(r => [
      r.user_name, r.user_role,
      new Date(r.week_start).toLocaleDateString(),
      r.total_hours, r.overtime, r.entry_count,
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `work-hours-${fromDate}-${toDate}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const empList: Employee[] = employees
    .filter(e => e.active !== false)
    .map(e => ({ id: e.id, name: e.name, role: e.role }));

  return (
    <div className="space-y-6 pb-12 text-cream">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-accent rounded-btn flex items-center justify-center shadow-lg">
            <Clock size={20} className="text-[#faf5ee]" />
          </div>
          <h1 className="text-2xl font-black text-cream uppercase tracking-tight">{t('work_hours_title')}</h1>
        </div>
        {isManager && (
          <div className="flex gap-2">
            <button onClick={() => setShowSettings(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-surface border border-warm-line text-cream-muted rounded-btn font-black text-xs uppercase tracking-widest hover:text-cream transition-all">
              <Save size={13} /> {t('hr_settings_title')}
            </button>
            <button onClick={exportCsv}
              className="flex items-center gap-2 px-4 py-2.5 bg-surface border border-warm-line text-cream-muted rounded-btn font-black text-xs uppercase tracking-widest hover:text-cream transition-all">
              <Download size={13} /> {t('export_csv')}
            </button>
          </div>
        )}
      </div>

      {/* ── Clock Widget ── */}
      <ClockWidget onClockOut={load} />

      {/* ── KPI Cards (managers only) ── */}
      {isManager && summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <KpiCard label={t('active_employees_hr')} value={summary.active_employees}
            icon={Users} color="bg-blue-500/15 text-blue-400" />
          <KpiCard label={t('currently_clocked_in_count')} value={summary.currently_clocked_in}
            icon={Clock} color="bg-emerald-500/15 text-emerald-400" />
          <KpiCard label={t('total_hours_week')} value={`${summary.total_hours_this_week}h`}
            icon={TrendingUp} color="bg-accent/15 text-accent-light" />
          <KpiCard label={t('overtime_this_week')} value={`${summary.overtime_this_week}h`}
            icon={AlertTriangle} color="bg-amber-500/15 text-amber-400"
            highlight={summary.overtime_this_week > 0} />
        </div>
      )}

      {/* ── Filters ── */}
      {isManager && (
        <div className="flex flex-wrap gap-3 bg-surface border border-warm-line rounded-2xl p-4">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-cream-faint">{t('from_date')}</label>
            <input type="date" className={inputCls} value={fromDate}
              onChange={e => setFromDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-cream-faint">{t('to_date')}</label>
            <input type="date" className={inputCls} value={toDate}
              onChange={e => setToDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-cream-faint">{t('employee')}</label>
            <select className={inputCls} value={filterUser} onChange={e => setFilterUser(e.target.value)}>
              <option value="">{t('all_employees')}</option>
              {empList.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col justify-end">
            <button onClick={() => setShowManual(true)}
              className="flex items-center gap-2 px-4 py-2 bg-accent text-[#faf5ee] rounded-btn font-black text-xs uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all">
              <Plus size={14} /> {t('add_manual_entry')}
            </button>
          </div>
        </div>
      )}

      {/* ── Weekly Aggregation Table ── */}
      {isManager && weekly.length > 0 && (
        <div className="bg-surface border border-warm-line rounded-card overflow-hidden">
          <div className="px-6 py-4 border-b border-warm-line flex items-center justify-between">
            <h2 className="text-xs font-black text-cream uppercase tracking-widest">{t('weekly_view')}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-2 border-b border-warm-line">
                <tr>
                  {[t('employee'), 'Role', t('weekly_view'), t('total_hours'), t('overtime'), t('hr_entries')].map(h => (
                    <th key={h} className="text-left text-[10px] font-black text-cream-faint uppercase tracking-widest py-3 px-4">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weekly.map((row, i) => (
                  <tr key={i} className="border-b border-warm-line/40 last:border-0 hover:bg-surface-2/30 transition-colors">
                    <td className="py-3 px-4 font-bold text-cream text-sm">{row.user_name}</td>
                    <td className="py-3 px-4 text-cream-muted text-xs">{row.user_role}</td>
                    <td className="py-3 px-4 text-cream-muted text-xs">
                      {new Date(row.week_start).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 font-black text-cream">{row.total_hours}h</td>
                    <td className="py-3 px-4">
                      {row.overtime > 0 ? (
                        <span className="px-2 py-0.5 bg-amber-500/15 text-amber-400 text-[10px] font-black rounded-lg uppercase">
                          +{row.overtime}h
                        </span>
                      ) : (
                        <span className="text-cream-faint text-xs">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-cream-muted text-sm">{row.entry_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Entries Table ── */}
      <div className="bg-surface border border-warm-line rounded-card overflow-hidden">
        <div className="px-6 py-4 border-b border-warm-line">
          <h2 className="text-xs font-black text-cream uppercase tracking-widest">{t('hr_entries')}</h2>
        </div>
        {loading ? (
          <div className="py-12 flex items-center justify-center gap-2 text-cream-faint">
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="py-12 text-center text-cream-faint text-sm">{t('no_entries_found')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-2 border-b border-warm-line">
                <tr>
                  {[...(isManager ? [t('employee')] : []),
                    t('clock_in_time'), t('clock_out_time'),
                    t('break_minutes_label'), t('hours_worked'), t('hr_notes'), ''
                  ].map((h, i) => (
                    <th key={i} className="text-left text-[10px] font-black text-cream-faint uppercase tracking-widest py-3 px-4 last:w-20">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map(e => (
                  <tr key={e.id} className="border-b border-warm-line/40 last:border-0 hover:bg-surface-2/30 transition-colors">
                    {isManager && (
                      <td className="py-3 px-4">
                        <p className="font-bold text-cream text-sm">{e.user_name}</p>
                        <p className="text-[10px] text-cream-faint">{e.user_role}</p>
                      </td>
                    )}
                    <td className="py-3 px-4 text-sm text-cream">
                      {new Date(e.clock_in).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="py-3 px-4 text-sm text-cream-muted">
                      {e.clock_out
                        ? new Date(e.clock_out).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
                        : <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] font-black rounded">Active</span>
                      }
                    </td>
                    <td className="py-3 px-4 text-sm text-cream-muted">{e.break_minutes}m</td>
                    <td className="py-3 px-4 font-black text-cream">
                      {e.hours_worked != null ? `${e.hours_worked}h` : '—'}
                    </td>
                    <td className="py-3 px-4 text-xs text-cream-faint max-w-[120px] truncate">
                      {e.notes ?? '—'}
                    </td>
                    <td className="py-3 px-4">
                      {isManager && e.clock_out && (
                        <div className="flex gap-1">
                          <button onClick={() => setEditingEntry(e)}
                            className="p-1.5 text-cream-faint hover:text-cream hover:bg-surface-2 rounded-lg transition-all">
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => deleteEntry(e.id)}
                            className="p-1.5 text-cream-faint hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {showManual && (
        <ManualEntryModal
          employees={empList}
          onSaved={() => { setShowManual(false); load(); }}
          onClose={() => setShowManual(false)}
        />
      )}

      {editingEntry && (
        <EditEntryModal
          entry={editingEntry}
          onSaved={() => { setEditingEntry(null); load(); }}
          onClose={() => setEditingEntry(null)}
        />
      )}

      {showSettings && settings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-base/80 backdrop-blur-sm">
          <div className="bg-surface border border-warm-line rounded-3xl p-8 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-black text-cream uppercase tracking-widest">{t('hr_settings_title')}</h2>
              <button onClick={() => setShowSettings(false)} className="p-2 text-cream-faint hover:text-cream">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              {[
                { key: 'weekly_overtime_threshold', label: t('weekly_overtime_threshold') },
                { key: 'daily_overtime_threshold', label: t('daily_overtime_threshold') },
                { key: 'default_break_minutes', label: t('default_break') },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs font-black text-cream-faint uppercase tracking-widest mb-2">{label}</label>
                  <input type="number" min={0}
                    className="w-full px-4 py-3 bg-warm-input border border-warm-line rounded-xl text-sm text-cream focus:outline-none focus:ring-2 focus:ring-accent/20"
                    value={(settingsForm as any)[key]}
                    onChange={e => setSettingsForm(f => ({ ...f, [key]: parseFloat(e.target.value) || 0 }))} />
                </div>
              ))}
              <div>
                <label className="block text-xs font-black text-cream-faint uppercase tracking-widest mb-2">{t('week_starts_on')}</label>
                <select className="w-full px-4 py-3 bg-warm-input border border-warm-line rounded-xl text-sm text-cream focus:outline-none focus:ring-2 focus:ring-accent/20"
                  value={settingsForm.week_starts_on}
                  onChange={e => setSettingsForm(f => ({ ...f, week_starts_on: parseInt(e.target.value) }))}>
                  <option value={1}>{t('monday')}</option>
                  <option value={0}>{t('sunday')}</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowSettings(false)} className="flex-1 px-5 py-3 bg-surface-2 text-cream-muted rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-warm-input transition-all">
                {t('cancel')}
              </button>
              <button onClick={saveSettings} disabled={savingSettings}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-accent text-[#faf5ee] rounded-2xl font-black text-xs uppercase tracking-widest hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all">
                {savingSettings ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                {t('save_changes')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── EditEntryModal ────────────────────────────────────────────────────────────

interface EditEntryModalProps {
  entry: WorkEntry;
  onSaved: () => void;
  onClose: () => void;
}

const toLocalDatetime = (iso: string) =>
  new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000)
    .toISOString().slice(0, 16);

const EditEntryModal: React.FC<EditEntryModalProps> = ({ entry, onSaved, onClose }) => {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    clock_in: toLocalDatetime(entry.clock_in),
    clock_out: entry.clock_out ? toLocalDatetime(entry.clock_out) : '',
    break_minutes: entry.break_minutes ?? 0,
    notes: entry.notes ?? '',
  });

  const save = async () => {
    setSaving(true);
    try {
      await apiClient.put(`/work-entries/${entry.id}`, {
        clock_in:      new Date(form.clock_in).toISOString(),
        clock_out:     form.clock_out ? new Date(form.clock_out).toISOString() : null,
        break_minutes: Number(form.break_minutes),
        notes:         form.notes || null,
      });
      toast.success(t('success'));
      onSaved();
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? t('error'));
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full px-4 py-3 bg-warm-input border border-warm-line rounded-xl text-sm text-cream focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-base/80 backdrop-blur-sm">
      <div className="bg-surface border border-warm-line rounded-3xl p-8 w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-black text-cream uppercase tracking-widest">{t('manual_entry')}</h2>
          <button onClick={onClose} className="p-2 text-cream-faint hover:text-cream"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-black text-cream-faint uppercase tracking-widest mb-2">{t('clock_in_time')}</label>
            <input type="datetime-local" className={inputCls} value={form.clock_in}
              onChange={e => setForm(f => ({ ...f, clock_in: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-black text-cream-faint uppercase tracking-widest mb-2">{t('clock_out_time')}</label>
            <input type="datetime-local" className={inputCls} value={form.clock_out}
              onChange={e => setForm(f => ({ ...f, clock_out: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-black text-cream-faint uppercase tracking-widest mb-2">{t('break_minutes_label')}</label>
            <input type="number" min={0} max={480} className={inputCls} value={form.break_minutes}
              onChange={e => setForm(f => ({ ...f, break_minutes: parseInt(e.target.value) || 0 }))} />
          </div>
          <div>
            <label className="block text-xs font-black text-cream-faint uppercase tracking-widest mb-2">{t('hr_notes')}</label>
            <textarea rows={2} className={`${inputCls} resize-none`} value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 px-5 py-3 bg-surface-2 text-cream-muted rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-warm-input transition-all">
            {t('cancel')}
          </button>
          <button onClick={save} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-accent text-[#faf5ee] rounded-2xl font-black text-xs uppercase tracking-widest hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {t('save')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default HRPage;
