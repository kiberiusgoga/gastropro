import React, { useState, useEffect } from 'react';
import {
  Store,
  Printer,
  Lock,
  Save,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Wifi,
  Monitor,
  Tag,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import apiClient from '../../lib/apiClient';
import { useStore } from '../../store/useStore';
import { Printer as PrinterType } from '../../types';
import CategoryManager from '../../components/Settings/CategoryManager';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RestaurantSettings {
  name: string;
  address: string;
  phone: string;
  tax_number: string;
  currency: string;
  timezone: string;
}

interface NewPrinter {
  name: string;
  type: 'receipt' | 'kitchen' | 'bar';
  connection_type: 'browser' | 'network';
  ip_address: string;
  port: string;
  station: string;
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

const Section: React.FC<{ icon: React.ElementType; title: string; subtitle: string; children: React.ReactNode }> = ({
  icon: Icon, title, subtitle, children,
}) => (
  <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-3xl overflow-hidden">
    <div className="px-8 py-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-4">
      <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center">
        <Icon size={20} className="text-zinc-600 dark:text-zinc-300" />
      </div>
      <div>
        <h2 className="text-sm font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-widest">{title}</h2>
        <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>
      </div>
    </div>
    <div className="p-8">{children}</div>
  </div>
);

// ─── Field ────────────────────────────────────────────────────────────────────

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-xs font-black text-zinc-500 uppercase tracking-widest mb-2">{label}</label>
    {children}
  </div>
);

const inputCls = "w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all";

// ─── Main component ───────────────────────────────────────────────────────────

const SettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useStore();

  // Restaurant info
  const [info, setInfo] = useState<RestaurantSettings>({
    name: '', address: '', phone: '', tax_number: '', currency: 'MKD', timezone: 'Europe/Skopje',
  });
  const [savingInfo, setSavingInfo] = useState(false);

  // Printers
  const [printers, setPrinters] = useState<PrinterType[]>([]);
  const [showAddPrinter, setShowAddPrinter] = useState(false);
  const [newPrinter, setNewPrinter] = useState<NewPrinter>({
    name: '', type: 'receipt', connection_type: 'browser', ip_address: '', port: '9100', station: '',
  });
  const [savingPrinter, setSavingPrinter] = useState(false);

  // Password
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });
  const [savingPwd, setSavingPwd] = useState(false);

  // ── Load data ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user?.restaurantId) return;

    apiClient.get(`/restaurants/${user.restaurantId}`).then(res => {
      const r = res.data;
      setInfo({
        name:       r.name        ?? '',
        address:    r.address     ?? '',
        phone:      r.phone       ?? '',
        tax_number: r.tax_number  ?? '',
        currency:   r.currency    ?? 'MKD',
        timezone:   r.timezone    ?? 'Europe/Skopje',
      });
    }).catch(console.error);

    apiClient.get('/printers').then(res => {
      setPrinters(res.data.map((r: any): PrinterType => ({
        id: r.id,
        restaurantId: r.restaurant_id,
        name: r.name,
        type: r.type,
        connectionType: r.connection_type,
        ipAddress: r.ip_address,
        port: r.port,
        active: r.active,
        station: r.station,
      })));
    }).catch(console.error);
  }, [user?.restaurantId]);

  // ── Save restaurant info ───────────────────────────────────────────────────

  const saveInfo = async () => {
    if (!info.name.trim()) { toast.error('Името е задолжително'); return; }
    setSavingInfo(true);
    try {
      await apiClient.put(`/restaurants/${user?.restaurantId}`, {
        name:       info.name,
        address:    info.address,
        phone:      info.phone,
        tax_number: info.tax_number,
        currency:   info.currency,
        timezone:   info.timezone,
      });
      toast.success('Информациите се зачувани');
    } catch {
      toast.error('Грешка при зачувување');
    } finally {
      setSavingInfo(false);
    }
  };

  // ── Printer CRUD ───────────────────────────────────────────────────────────

  const addPrinter = async () => {
    if (!newPrinter.name.trim()) { toast.error('Внесете ime на принтер'); return; }
    setSavingPrinter(true);
    try {
      const res = await apiClient.post('/printers', {
        name:            newPrinter.name,
        type:            newPrinter.type,
        connection_type: newPrinter.connection_type,
        ip_address:      newPrinter.connection_type === 'network' ? newPrinter.ip_address : null,
        port:            newPrinter.connection_type === 'network' ? Number(newPrinter.port) : null,
        station:         newPrinter.station || null,
        active:          true,
      });
      const added: PrinterType = {
        id: res.data.id,
        restaurantId: res.data.restaurant_id,
        name: res.data.name,
        type: res.data.type,
        connectionType: res.data.connection_type,
        ipAddress: res.data.ip_address,
        port: res.data.port,
        active: res.data.active,
        station: res.data.station,
      };
      setPrinters(prev => [...prev, added]);
      setShowAddPrinter(false);
      setNewPrinter({ name: '', type: 'receipt', connection_type: 'browser', ip_address: '', port: '9100', station: '' });
      toast.success('Принтерот е додаден');
    } catch {
      toast.error('Грешка при додавање');
    } finally {
      setSavingPrinter(false);
    }
  };

  const deletePrinter = async (id: string) => {
    try {
      await apiClient.delete(`/printers/${id}`);
      setPrinters(prev => prev.filter(p => p.id !== id));
      toast.success('Принтерот е избришан');
    } catch {
      toast.error('Грешка при бришење');
    }
  };

  const togglePrinterActive = async (printer: PrinterType) => {
    try {
      await apiClient.put(`/printers/${printer.id}`, {
        name: printer.name, type: printer.type,
        connection_type: printer.connectionType,
        ip_address: printer.ipAddress, port: printer.port,
        station: printer.station, active: !printer.active,
      });
      setPrinters(prev => prev.map(p => p.id === printer.id ? { ...p, active: !p.active } : p));
    } catch {
      toast.error('Грешка');
    }
  };

  // ── Change password ────────────────────────────────────────────────────────

  const changePassword = async () => {
    if (!pwd.current || !pwd.next) { toast.error('Пополнете ги полињата'); return; }
    if (pwd.next !== pwd.confirm)  { toast.error('Лозинките не се совпаѓаат'); return; }
    if (pwd.next.length < 6)       { toast.error('Лозинката мора да биде минимум 6 знаци'); return; }
    setSavingPwd(true);
    try {
      await apiClient.put('/auth/change-password', { currentPassword: pwd.current, newPassword: pwd.next });
      toast.success('Лозинката е сменета');
      setPwd({ current: '', next: '', confirm: '' });
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Грешка при промена на лозинка');
    } finally {
      setSavingPwd(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const PRINTER_TYPE_LABEL: Record<string, string> = { receipt: 'Сметка', kitchen: 'Кујна', bar: 'Шанк' };
  const STATION_LABEL: Record<string, string> = { kitchen: 'Кујна', bar: 'Шанк', grill: 'Скара', dessert: 'Десерти', salad: 'Салати' };

  return (
    <div className="space-y-8 pb-16">
      <div>
        <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">Подесувања</h1>
        <p className="text-sm text-zinc-500 mt-1">Управување со ресторанот и системот</p>
      </div>

      {/* ── Restaurant Info ── */}
      <Section icon={Store} title="Информации за ресторан" subtitle="Основни податоци кои се прикажуваат на сметките">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="Назив на ресторан">
            <input className={inputCls} value={info.name}
              onChange={e => setInfo(s => ({ ...s, name: e.target.value }))} placeholder="GastroPro Restaurant" />
          </Field>
          <Field label="Адреса">
            <input className={inputCls} value={info.address}
              onChange={e => setInfo(s => ({ ...s, address: e.target.value }))} placeholder="Ул. Партизанска бб, Скопје" />
          </Field>
          <Field label="Телефон">
            <input className={inputCls} value={info.phone}
              onChange={e => setInfo(s => ({ ...s, phone: e.target.value }))} placeholder="+389 2 123 456" />
          </Field>
          <Field label="ДДВ Број">
            <input className={inputCls} value={info.tax_number}
              onChange={e => setInfo(s => ({ ...s, tax_number: e.target.value }))} placeholder="MK4030000000000" />
          </Field>
          <Field label="Валута">
            <select className={inputCls} value={info.currency}
              onChange={e => setInfo(s => ({ ...s, currency: e.target.value }))}>
              <option value="MKD">MKD — Македонски денар</option>
              <option value="EUR">EUR — Евро</option>
              <option value="USD">USD — Американски долар</option>
            </select>
          </Field>
          <Field label="Временска зона">
            <select className={inputCls} value={info.timezone}
              onChange={e => setInfo(s => ({ ...s, timezone: e.target.value }))}>
              <option value="Europe/Skopje">Europe/Skopje (UTC+1/+2)</option>
              <option value="Europe/Belgrade">Europe/Belgrade</option>
              <option value="Europe/Sofia">Europe/Sofia</option>
            </select>
          </Field>
        </div>
        <div className="mt-6 flex justify-end">
          <button onClick={saveInfo} disabled={savingInfo}
            className="flex items-center gap-2 px-6 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 disabled:opacity-50 transition-all">
            <Save size={15} />
            {savingInfo ? 'Зачувување...' : 'Зачувај промени'}
          </button>
        </div>
      </Section>

      {/* ── Printers ── */}
      <Section icon={Printer} title="Принтери" subtitle="Конфигурација на thermal и мрежни принтери">
        <div className="space-y-3 mb-6">
          {printers.length === 0 && (
            <div className="py-10 text-center text-zinc-400 text-sm">Нема конфигурирани принтери</div>
          )}
          {printers.map(p => (
            <div key={p.id}
              className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-700">
              <div className="flex items-center gap-4">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${p.active ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-zinc-100 dark:bg-zinc-700'}`}>
                  {p.connectionType === 'network'
                    ? <Wifi size={16} className={p.active ? 'text-emerald-600' : 'text-zinc-400'} />
                    : <Monitor size={16} className={p.active ? 'text-emerald-600' : 'text-zinc-400'} />}
                </div>
                <div>
                  <p className="text-sm font-black text-zinc-900 dark:text-zinc-100">{p.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                      {PRINTER_TYPE_LABEL[p.type] ?? p.type}
                    </span>
                    {p.station && (
                      <span className="text-[10px] font-bold text-zinc-400">· {STATION_LABEL[p.station] ?? p.station}</span>
                    )}
                    {p.connectionType === 'network' && p.ipAddress && (
                      <span className="text-[10px] font-mono text-zinc-400">{p.ipAddress}:{p.port ?? 9100}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => togglePrinterActive(p)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                    p.active
                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-400'
                  }`}>
                  {p.active ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                  {p.active ? 'Активен' : 'Неактивен'}
                </button>
                <button onClick={() => deletePrinter(p.id)}
                  className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {showAddPrinter ? (
          <div className="border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-2xl p-6 space-y-4">
            <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest">Нов принтер</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Назив">
                <input className={inputCls} value={newPrinter.name}
                  onChange={e => setNewPrinter(s => ({ ...s, name: e.target.value }))} placeholder="Касa — Сметки" />
              </Field>
              <Field label="Тип">
                <select className={inputCls} value={newPrinter.type}
                  onChange={e => setNewPrinter(s => ({ ...s, type: e.target.value as any }))}>
                  <option value="receipt">Сметка (Receipt)</option>
                  <option value="kitchen">Кујна (Kitchen)</option>
                  <option value="bar">Шанк (Bar)</option>
                </select>
              </Field>
              <Field label="Врска">
                <select className={inputCls} value={newPrinter.connection_type}
                  onChange={e => setNewPrinter(s => ({ ...s, connection_type: e.target.value as any }))}>
                  <option value="browser">Browser (window.print)</option>
                  <option value="network">Мрежен (ESC/POS TCP)</option>
                </select>
              </Field>
              <Field label="Станица (опционално)">
                <select className={inputCls} value={newPrinter.station}
                  onChange={e => setNewPrinter(s => ({ ...s, station: e.target.value }))}>
                  <option value="">— без станица —</option>
                  <option value="kitchen">Кујна</option>
                  <option value="bar">Шанк</option>
                  <option value="grill">Скара</option>
                  <option value="dessert">Десерти</option>
                  <option value="salad">Салати</option>
                </select>
              </Field>
              {newPrinter.connection_type === 'network' && (
                <>
                  <Field label="IP адреса">
                    <input className={inputCls} value={newPrinter.ip_address}
                      onChange={e => setNewPrinter(s => ({ ...s, ip_address: e.target.value }))} placeholder="192.168.1.100" />
                  </Field>
                  <Field label="Порт">
                    <input className={inputCls} type="number" value={newPrinter.port}
                      onChange={e => setNewPrinter(s => ({ ...s, port: e.target.value }))} placeholder="9100" />
                  </Field>
                </>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowAddPrinter(false)}
                className="px-5 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-zinc-200 transition-all">
                Откажи
              </button>
              <button onClick={addPrinter} disabled={savingPrinter}
                className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 disabled:opacity-50 transition-all">
                <Save size={13} />
                {savingPrinter ? 'Зачувување...' : 'Зачувај принтер'}
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowAddPrinter(true)}
            className="flex items-center gap-2 px-5 py-3 border-2 border-dashed border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-zinc-400 rounded-2xl font-black text-xs uppercase tracking-widest transition-all w-full justify-center">
            <Plus size={16} />
            Додај принтер
          </button>
        )}
      </Section>

      {/* ── Menu Categories ── */}
      <Section icon={Tag} title={t('cat_settings_title')} subtitle={t('cat_settings_subtitle')}>
        <CategoryManager />
      </Section>

      {/* ── Change Password ── */}
      <Section icon={Lock} title="Промени лозинка" subtitle="Смена на лозинка за тековната сметка">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Field label="Тековна лозинка">
            <input type="password" className={inputCls} value={pwd.current}
              onChange={e => setPwd(s => ({ ...s, current: e.target.value }))} placeholder="••••••••" />
          </Field>
          <Field label="Нова лозинка">
            <input type="password" className={inputCls} value={pwd.next}
              onChange={e => setPwd(s => ({ ...s, next: e.target.value }))} placeholder="••••••••" />
          </Field>
          <Field label="Потврди нова лозинка">
            <input type="password" className={inputCls} value={pwd.confirm}
              onChange={e => setPwd(s => ({ ...s, confirm: e.target.value }))} placeholder="••••••••" />
          </Field>
        </div>
        {pwd.next && pwd.confirm && pwd.next !== pwd.confirm && (
          <p className="mt-3 text-xs text-red-500 flex items-center gap-1.5">
            <AlertCircle size={12} /> Лозинките не се совпаѓаат
          </p>
        )}
        <div className="mt-6 flex justify-end">
          <button onClick={changePassword} disabled={savingPwd}
            className="flex items-center gap-2 px-6 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 disabled:opacity-50 transition-all">
            <Lock size={15} />
            {savingPwd ? 'Зачувување...' : 'Промени лозинка'}
          </button>
        </div>
      </Section>
    </div>
  );
};

export default SettingsPage;
