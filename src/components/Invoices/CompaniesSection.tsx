import React, { useState, useEffect } from 'react';
import { Building2, Pencil, Trash2, X, Save, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import apiClient from '../../lib/apiClient';
import { Company } from '../../types';

const inputCls = 'w-full px-4 py-3 bg-warm-input border border-warm-line rounded-xl text-sm font-medium text-cream focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/50 transition-all';

interface CompanyFormData {
  name: string;
  tin: string;
  embs: string;
  address: string;
  city: string;
  postal_code: string;
  contact_person: string;
  email: string;
  phone: string;
  bank_account: string;
  payment_terms_days: number;
  notes: string;
}

const emptyForm = (): CompanyFormData => ({
  name: '', tin: '', embs: '', address: '', city: '', postal_code: '',
  contact_person: '', email: '', phone: '', bank_account: '',
  payment_terms_days: 15, notes: '',
});

function validateForm(d: CompanyFormData): string | null {
  if (!d.name.trim() || d.name.length < 2) return 'Назив е задолжителен (мин. 2 знаци)';
  if (!d.tin || d.tin.length !== 13 || !/^\d+$/.test(d.tin)) return 'ЕДБ мора да биде точно 13 цифри';
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return 'Невалидна е-маил адреса';
  if (d.payment_terms_days < 1 || d.payment_terms_days > 365) return 'Рокот мора да биде 1–365 денови';
  return null;
}

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

function Modal({ title, onClose, children }: ModalProps) {
  return (
    <div className="fixed inset-0 bg-base/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-warm-line rounded-2xl shadow-card-lg w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-warm-line flex items-center justify-between shrink-0">
          <h3 className="text-lg font-bold text-cream">{title}</h3>
          <button onClick={onClose} className="text-cream-faint hover:text-cream transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

interface CompanyFormProps {
  data: CompanyFormData;
  onChange: (patch: Partial<CompanyFormData>) => void;
}

function CompanyForm({ data, onChange }: CompanyFormProps) {
  const { t } = useTranslation();
  const f = (label: string, key: keyof CompanyFormData, placeholder?: string, type = 'text') => (
    <div>
      <label className="block text-xs font-black text-cream-faint uppercase tracking-widest mb-1.5">{label}</label>
      <input
        type={type}
        className={inputCls}
        value={String(data[key])}
        placeholder={placeholder}
        onChange={e => onChange({ [key]: type === 'number' ? parseInt(e.target.value) || 0 : e.target.value } as any)}
      />
    </div>
  );
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="md:col-span-2">{f('Назив *', 'name', 'Компанија ДООЕЛ')}</div>
      {f(`${t('tin')} *`, 'tin', '4030000000000')}
      {f(t('embs'), 'embs', '1234567')}
      <div className="md:col-span-2">{f('Адреса', 'address', 'Ул. Партизанска 1')}</div>
      {f(t('city'), 'city', 'Скопје')}
      {f(t('postal_code'), 'postal_code', '1000')}
      {f(t('contact_person'), 'contact_person', 'Марко Марковски')}
      {f('Е-маил', 'email', 'info@kompanija.mk', 'email')}
      {f('Телефон', 'phone', '+389 2 000 000')}
      {f(t('bank_account'), 'bank_account', '300-0000000000-00')}
      {f(t('payment_terms_days'), 'payment_terms_days', '15', 'number')}
      <div className="md:col-span-2">
        <label className="block text-xs font-black text-cream-faint uppercase tracking-widest mb-1.5">Забелешки</label>
        <textarea
          className={inputCls}
          rows={2}
          value={data.notes}
          onChange={e => onChange({ notes: e.target.value })}
          placeholder="Интерни белешки..."
        />
      </div>
    </div>
  );
}

interface Props {
  onCompaniesChange?: (companies: Company[]) => void;
}

export function CompaniesSection({ onCompaniesChange }: Props) {
  const { t } = useTranslation();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [deleting, setDeleting] = useState<Company | null>(null);
  const [form, setForm] = useState<CompanyFormData>(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const res = await apiClient.get('/companies');
      setCompanies(res.data);
      onCompaniesChange?.(res.data);
    } catch { toast.error('Грешка при вчитување на компании'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm(emptyForm()); setCreating(true); };
  const openEdit = (c: Company) => {
    setForm({
      name: c.name, tin: c.tin, embs: c.embs ?? '', address: c.address ?? '',
      city: c.city ?? '', postal_code: c.postalCode ?? '',
      contact_person: c.contactPerson ?? '', email: c.email ?? '',
      phone: c.phone ?? '', bank_account: c.bankAccount ?? '',
      payment_terms_days: c.paymentTermsDays, notes: c.notes ?? '',
    });
    setEditing(c);
  };

  const save = async () => {
    const err = validateForm(form);
    if (err) { toast.error(err); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name, tin: form.tin, embs: form.embs || undefined,
        address: form.address || undefined, city: form.city || undefined,
        postal_code: form.postal_code || undefined,
        contact_person: form.contact_person || undefined,
        email: form.email || undefined, phone: form.phone || undefined,
        bank_account: form.bank_account || undefined,
        payment_terms_days: form.payment_terms_days,
        notes: form.notes || undefined,
      };
      if (creating) {
        await apiClient.post('/companies', payload);
        toast.success('Компанијата е додадена');
        setCreating(false);
      } else if (editing) {
        await apiClient.put(`/companies/${editing.id}`, payload);
        toast.success('Компанијата е зачувана');
        setEditing(null);
      }
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Грешка при зачувување');
    } finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await apiClient.delete(`/companies/${deleting.id}`);
      toast.success('Компанијата е избришана');
      setDeleting(null);
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Грешка при бришење');
    }
  };

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Building2 size={20} className="text-cream-muted" />
          <h2 className="text-sm font-black text-cream uppercase tracking-widest">{t('companies')}</h2>
          {companies.length > 0 && (
            <span className="bg-surface-2 text-cream-muted text-xs font-bold px-2 py-0.5 rounded-full">
              {companies.length}
            </span>
          )}
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-[#faf5ee] rounded-xl font-black text-xs uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all"
        >
          {t('new_company')}
        </button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-cream-faint text-sm">Вчитување...</div>
      ) : companies.length === 0 ? (
        <div className="py-10 text-center border border-dashed border-warm-line rounded-2xl">
          <Building2 size={32} className="text-cream-faint mx-auto mb-3" />
          <p className="text-cream-muted text-sm font-medium">Нема компании</p>
          <p className="text-cream-faint text-xs mt-1">Додај компанија за Б2Б фактурирање</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-warm-line">
                {['Назив', t('tin'), 'Контакт', 'Рок (дни)', ''].map(h => (
                  <th key={h} className="text-left text-[10px] font-black text-cream-faint uppercase tracking-widest py-2 px-3 first:pl-0">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {companies.map(c => (
                <tr key={c.id} className="border-b border-warm-line/50 hover:bg-surface-2/30 transition-colors">
                  <td className="py-3 px-3 pl-0">
                    <p className="text-sm font-bold text-cream">{c.name}</p>
                    {c.address && <p className="text-xs text-cream-faint mt-0.5">{c.address}</p>}
                  </td>
                  <td className="py-3 px-3 text-sm text-cream-muted font-mono">{c.tin}</td>
                  <td className="py-3 px-3">
                    {c.contactPerson && <p className="text-sm text-cream-muted">{c.contactPerson}</p>}
                    {c.email && <p className="text-xs text-cream-faint">{c.email}</p>}
                  </td>
                  <td className="py-3 px-3 text-sm text-cream-muted">{c.paymentTermsDays}</td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => openEdit(c)}
                        className="p-1.5 text-cream-faint hover:text-cream hover:bg-surface-2 rounded-lg transition-colors">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => setDeleting(c)}
                        className="p-1.5 text-cream-faint hover:text-rose-400 hover:bg-rose-900/20 rounded-lg transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Modal */}
      {(creating || editing) && (
        <Modal title={creating ? t('new_company') : t('edit_company')} onClose={() => { setCreating(false); setEditing(null); }}>
          <CompanyForm data={form} onChange={patch => setForm(s => ({ ...s, ...patch }))} />
          <div className="flex gap-3 mt-6 justify-end">
            <button onClick={() => { setCreating(false); setEditing(null); }}
              className="px-5 py-2.5 bg-surface-2 text-cream-muted rounded-xl font-black text-xs uppercase tracking-widest hover:bg-warm-input transition-all">
              Откажи
            </button>
            <button onClick={save} disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-accent text-[#faf5ee] rounded-xl font-black text-xs uppercase tracking-widest hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all">
              <Save size={13} />
              {saving ? 'Зачувување...' : 'Зачувај'}
            </button>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation */}
      {deleting && (
        <Modal title={t('delete_company')} onClose={() => setDeleting(null)}>
          {Number((deleting as any).invoice_count) > 0 ? (
            <div className="flex items-start gap-3 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl">
              <AlertCircle size={18} className="text-rose-400 mt-0.5 shrink-0" />
              <p className="text-sm text-rose-300">
                Не може да се избрише — компанијата има <strong>{(deleting as any).invoice_count}</strong> активни фактури.
              </p>
            </div>
          ) : (
            <>
              <p className="text-cream-muted text-sm mb-6">
                Дали сте сигурни дека сакате да ја избришете компанијата <strong className="text-cream">{deleting.name}</strong>?
              </p>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setDeleting(null)}
                  className="px-5 py-2.5 bg-surface-2 text-cream-muted rounded-xl font-black text-xs uppercase tracking-widest hover:bg-warm-input transition-all">
                  Откажи
                </button>
                <button onClick={confirmDelete}
                  className="px-5 py-2.5 bg-rose-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-rose-700 transition-all">
                  Избриши
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
