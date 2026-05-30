import React, { useState } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import apiClient from '../../lib/apiClient';

interface Employee { id: string; name: string; role: string; }

interface ManualEntryModalProps {
  employees: Employee[];
  onSaved: () => void;
  onClose: () => void;
}

const inputCls = 'w-full px-4 py-3 bg-warm-input border border-warm-line rounded-xl text-sm font-medium text-cream focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/50 transition-all';

const ManualEntryModal: React.FC<ManualEntryModalProps> = ({ employees, onSaved, onClose }) => {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    user_id: employees[0]?.id ?? '',
    clock_in: '',
    clock_out: '',
    break_minutes: 0,
    notes: '',
  });

  const submit = async () => {
    if (!form.user_id || !form.clock_in || !form.clock_out) {
      toast.error(t('error'));
      return;
    }
    setSaving(true);
    try {
      await apiClient.post('/work-entries', {
        ...form,
        clock_in: new Date(form.clock_in).toISOString(),
        clock_out: new Date(form.clock_out).toISOString(),
        break_minutes: Number(form.break_minutes),
      });
      toast.success(t('clocked_in_success'));
      onSaved();
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? t('error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-base/80 backdrop-blur-sm">
      <div className="bg-surface border border-warm-line rounded-3xl p-8 w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-black text-cream uppercase tracking-widest">{t('add_manual_entry')}</h2>
          <button onClick={onClose} className="p-2 text-cream-faint hover:text-cream transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-black text-cream-faint uppercase tracking-widest mb-2">{t('employee')}</label>
            <select className={inputCls} value={form.user_id} onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))}>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.role})</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
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
          </div>

          <div>
            <label className="block text-xs font-black text-cream-faint uppercase tracking-widest mb-2">{t('break_minutes_label')}</label>
            <input type="number" min={0} max={480} className={inputCls} value={form.break_minutes}
              onChange={e => setForm(f => ({ ...f, break_minutes: parseInt(e.target.value) || 0 }))}
              placeholder={t('break_minutes_placeholder')} />
          </div>

          <div>
            <label className="block text-xs font-black text-cream-faint uppercase tracking-widest mb-2">{t('hr_notes')}</label>
            <textarea rows={2} className={`${inputCls} resize-none`} value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="…" />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 px-5 py-3 bg-surface-2 text-cream-muted rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-warm-input transition-all">
            {t('cancel')}
          </button>
          <button onClick={submit} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-accent text-[#faf5ee] rounded-2xl font-black text-xs uppercase tracking-widest hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {t('save')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManualEntryModal;
