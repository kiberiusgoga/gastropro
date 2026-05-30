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
  Warehouse,
  LayoutGrid,
  Mail,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import apiClient from '../../lib/apiClient';
import { useStore } from '../../store/useStore';
import { Printer as PrinterType } from '../../types';
import CategoryManager from '../../components/Settings/CategoryManager';
import WarehousesTab from '../../components/Settings/WarehousesTab';
import TablesSection from '../../components/Settings/TablesSection';

interface RestaurantSettings {
  name: string;
  address: string;
  phone: string;
  tax_number: string;
  currency: string;
  timezone: string;
  edb: string;
  bank_account: string;
  city: string;
  postal_code: string;
}

interface NewPrinter {
  name: string;
  type: 'receipt' | 'kitchen' | 'bar';
  connection_type: 'browser' | 'network';
  ip_address: string;
  port: string;
  station: string;
}

const Section: React.FC<{ icon: React.ElementType; title: string; subtitle: string; children: React.ReactNode }> = ({
  icon: Icon, title, subtitle, children,
}) => (
  <div className="bg-surface border border-warm-line rounded-3xl overflow-hidden">
    <div className="px-8 py-6 border-b border-warm-line flex items-center gap-4">
      <div className="w-10 h-10 bg-surface-2 rounded-2xl flex items-center justify-center">
        <Icon size={20} className="text-cream-muted" />
      </div>
      <div>
        <h2 className="text-sm font-black text-cream uppercase tracking-widest">{title}</h2>
        <p className="text-xs text-cream-faint mt-0.5">{subtitle}</p>
      </div>
    </div>
    <div className="p-8">{children}</div>
  </div>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-xs font-black text-cream-faint uppercase tracking-widest mb-2">{label}</label>
    {children}
  </div>
);

const inputCls = "w-full px-4 py-3 bg-warm-input border border-warm-line rounded-xl text-sm font-medium text-cream focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/50 transition-all";

const SettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useStore();

  const [info, setInfo] = useState<RestaurantSettings>({
    name: '', address: '', phone: '', tax_number: '', currency: 'MKD', timezone: 'Europe/Skopje',
    edb: '', bank_account: '', city: '', postal_code: '',
  });
  const [savingInfo, setSavingInfo] = useState(false);

  const [printers, setPrinters] = useState<PrinterType[]>([]);
  const [showAddPrinter, setShowAddPrinter] = useState(false);
  const [newPrinter, setNewPrinter] = useState<NewPrinter>({
    name: '', type: 'receipt', connection_type: 'browser', ip_address: '', port: '9100', station: '',
  });
  const [savingPrinter, setSavingPrinter] = useState(false);

  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });
  const [savingPwd, setSavingPwd] = useState(false);

  const [emailCfg, setEmailCfg] = useState({
    smtpHost: '', smtpPort: 587, smtpUser: '', smtpPass: '', smtpFrom: '',
    autoSendOnZClose: false,
    subjectTemplate: 'Дневна потрошувачка — {date} — {restaurant_name}',
    bodyTemplate: '',
  });
  const [savingEmail, setSavingEmail] = useState(false);
  const [testEmailTo, setTestEmailTo] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  useEffect(() => {
    if (!user?.restaurantId) return;

    apiClient.get(`/restaurants/${user.restaurantId}`).then(res => {
      const r = res.data;
      setInfo({
        name:         r.name         ?? '',
        address:      r.address      ?? '',
        phone:        r.phone        ?? '',
        tax_number:   r.tax_number   ?? '',
        currency:     r.currency     ?? 'MKD',
        timezone:     r.timezone     ?? 'Europe/Skopje',
        edb:          r.edb          ?? '',
        bank_account: r.bank_account ?? '',
        city:         r.city         ?? '',
        postal_code:  r.postal_code  ?? '',
      });
    }).catch(console.error);

    apiClient.get('/email-settings').then(res => {
      const d = res.data;
      setEmailCfg({
        smtpHost: d.smtpHost ?? '',
        smtpPort: d.smtpPort ?? 587,
        smtpUser: d.smtpUser ?? '',
        smtpPass: d.smtpPass ?? '',
        smtpFrom: d.smtpFrom ?? '',
        autoSendOnZClose: d.autoSendOnZClose ?? false,
        subjectTemplate: d.subjectTemplate ?? '',
        bodyTemplate: d.bodyTemplate ?? '',
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

  const saveInfo = async () => {
    if (!info.name.trim()) { toast.error('Името е задолжително'); return; }
    setSavingInfo(true);
    try {
      await apiClient.put(`/restaurants/${user?.restaurantId}`, {
        name:         info.name,
        address:      info.address,
        phone:        info.phone,
        tax_number:   info.tax_number,
        currency:     info.currency,
        timezone:     info.timezone,
        edb:          info.edb || null,
        bank_account: info.bank_account || null,
        city:         info.city || null,
        postal_code:  info.postal_code || null,
      });
      toast.success('Информациите се зачувани');
    } catch {
      toast.error('Грешка при зачувување');
    } finally {
      setSavingInfo(false);
    }
  };

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

  const saveEmailSettings = async () => {
    setSavingEmail(true);
    try {
      await apiClient.put('/email-settings', emailCfg);
      toast.success('Е-пошта подесувањата се зачувани');
    } catch {
      toast.error('Грешка при зачувување');
    } finally {
      setSavingEmail(false);
    }
  };

  const sendTestEmail = async () => {
    if (!testEmailTo.trim()) { toast.error('Внесете е-пошта адреса'); return; }
    setSendingTest(true);
    try {
      await apiClient.post('/email-settings/test', { to: testEmailTo });
      toast.success('Тест емаилот е пратен');
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'SMTP грешка');
    } finally {
      setSendingTest(false);
    }
  };

  const PRINTER_TYPE_LABEL: Record<string, string> = { receipt: 'Сметка', kitchen: 'Кујна', bar: 'Шанк' };
  const STATION_LABEL: Record<string, string> = { kitchen: 'Кујна', bar: 'Шанк', grill: 'Скара', dessert: 'Десерти', salad: 'Салати' };

  return (
    <div className="space-y-8 pb-16">
      <div>
        <h1 className="text-2xl font-black text-cream uppercase tracking-tight">{t('settings')}</h1>
        <p className="text-sm text-cream-faint mt-1">{t('settings_subtitle')}</p>
      </div>

      <Section icon={Store} title={t('restaurant_info')} subtitle={t('restaurant_info_subtitle')}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label={t('restaurant_name_label')}>
            <input className={inputCls} value={info.name}
              onChange={e => setInfo(s => ({ ...s, name: e.target.value }))} placeholder="GastroPro Restaurant" />
          </Field>
          <Field label={t('address')}>
            <input className={inputCls} value={info.address}
              onChange={e => setInfo(s => ({ ...s, address: e.target.value }))} placeholder="Ул. Партизанска бб, Скопје" />
          </Field>
          <Field label={t('phone')}>
            <input className={inputCls} value={info.phone}
              onChange={e => setInfo(s => ({ ...s, phone: e.target.value }))} placeholder="+389 2 123 456" />
          </Field>
          <Field label={t('tax_number')}>
            <input className={inputCls} value={info.tax_number}
              onChange={e => setInfo(s => ({ ...s, tax_number: e.target.value }))} placeholder="MK4030000000000" />
          </Field>
          <Field label={t('currency')}>
            <select className={inputCls} value={info.currency}
              onChange={e => setInfo(s => ({ ...s, currency: e.target.value }))}>
              <option value="MKD">MKD — Македонски денар</option>
              <option value="EUR">EUR — Евро</option>
              <option value="USD">USD — Американски долар</option>
            </select>
          </Field>
          <Field label={t('timezone')}>
            <select className={inputCls} value={info.timezone}
              onChange={e => setInfo(s => ({ ...s, timezone: e.target.value }))}>
              <option value="Europe/Skopje">Europe/Skopje (UTC+1/+2)</option>
              <option value="Europe/Belgrade">Europe/Belgrade</option>
              <option value="Europe/Sofia">Europe/Sofia</option>
            </select>
          </Field>
        </div>

        <div className="mt-6 pt-6 border-t border-warm-line">
          <p className="text-xs font-black text-cream-faint uppercase tracking-widest mb-4">
            {t('billing_section')}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label={t('edb')}>
              <input className={inputCls} value={info.edb}
                onChange={e => setInfo(s => ({ ...s, edb: e.target.value }))}
                placeholder="4030000000000" maxLength={13} />
            </Field>
            <Field label={t('bank_account')}>
              <input className={inputCls} value={info.bank_account}
                onChange={e => setInfo(s => ({ ...s, bank_account: e.target.value }))}
                placeholder="300-0000000000-00" />
            </Field>
            <Field label={t('city')}>
              <input className={inputCls} value={info.city}
                onChange={e => setInfo(s => ({ ...s, city: e.target.value }))}
                placeholder="Скопје" />
            </Field>
            <Field label={t('postal_code')}>
              <input className={inputCls} value={info.postal_code}
                onChange={e => setInfo(s => ({ ...s, postal_code: e.target.value }))}
                placeholder="1000" />
            </Field>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button onClick={saveInfo} disabled={savingInfo}
            className="flex items-center gap-2 px-6 py-3 bg-accent text-[#faf5ee] rounded-2xl font-black text-xs uppercase tracking-widest hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all">
            <Save size={15} />
            {savingInfo ? t('saving') : t('save_changes')}
          </button>
        </div>
      </Section>

      <Section icon={Printer} title={t('printers_section')} subtitle={t('printers_subtitle')}>
        <div className="space-y-3 mb-6">
          {printers.length === 0 && (
            <div className="py-10 text-center text-cream-faint text-sm">{t('no_printers')}</div>
          )}
          {printers.map(p => (
            <div key={p.id}
              className="flex items-center justify-between p-4 bg-surface-2/50 rounded-2xl border border-warm-line">
              <div className="flex items-center gap-4">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${p.active ? 'bg-emerald-900/30' : 'bg-surface-2'}`}>
                  {p.connectionType === 'network'
                    ? <Wifi size={16} className={p.active ? 'text-emerald-400' : 'text-cream-faint'} />
                    : <Monitor size={16} className={p.active ? 'text-emerald-400' : 'text-cream-faint'} />}
                </div>
                <div>
                  <p className="text-sm font-black text-cream">{p.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-bold text-cream-faint uppercase tracking-wider">
                      {PRINTER_TYPE_LABEL[p.type] ?? p.type}
                    </span>
                    {p.station && (
                      <span className="text-[10px] font-bold text-cream-faint">· {STATION_LABEL[p.station] ?? p.station}</span>
                    )}
                    {p.connectionType === 'network' && p.ipAddress && (
                      <span className="text-[10px] font-mono text-cream-faint">{p.ipAddress}:{p.port ?? 9100}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => togglePrinterActive(p)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                    p.active
                      ? 'bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50'
                      : 'bg-surface-2 text-cream-faint hover:bg-warm-input'
                  }`}>
                  {p.active ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                  {p.active ? t('active') : t('inactive')}
                </button>
                <button onClick={() => deletePrinter(p.id)}
                  className="p-2 text-cream-faint hover:text-rose-400 hover:bg-rose-900/20 rounded-xl transition-all">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {showAddPrinter ? (
          <div className="border-2 border-dashed border-warm-line rounded-2xl p-6 space-y-4">
            <h3 className="text-xs font-black text-cream-faint uppercase tracking-widest">{t('new_printer')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label={t('printer_name_label')}>
                <input className={inputCls} value={newPrinter.name}
                  onChange={e => setNewPrinter(s => ({ ...s, name: e.target.value }))} placeholder="Касa — Сметки" />
              </Field>
              <Field label={t('printer_type_label')}>
                <select className={inputCls} value={newPrinter.type}
                  onChange={e => setNewPrinter(s => ({ ...s, type: e.target.value as any }))}>
                  <option value="receipt">Сметка (Receipt)</option>
                  <option value="kitchen">Кујна (Kitchen)</option>
                  <option value="bar">Шанк (Bar)</option>
                </select>
              </Field>
              <Field label={t('printer_connection')}>
                <select className={inputCls} value={newPrinter.connection_type}
                  onChange={e => setNewPrinter(s => ({ ...s, connection_type: e.target.value as any }))}>
                  <option value="browser">Browser (window.print)</option>
                  <option value="network">Мрежен (ESC/POS TCP)</option>
                </select>
              </Field>
              <Field label={t('printer_station')}>
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
                  <Field label={t('ip_address')}>
                    <input className={inputCls} value={newPrinter.ip_address}
                      onChange={e => setNewPrinter(s => ({ ...s, ip_address: e.target.value }))} placeholder="192.168.1.100" />
                  </Field>
                  <Field label={t('port')}>
                    <input className={inputCls} type="number" value={newPrinter.port}
                      onChange={e => setNewPrinter(s => ({ ...s, port: e.target.value }))} placeholder="9100" />
                  </Field>
                </>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowAddPrinter(false)}
                className="px-5 py-2.5 bg-surface-2 text-cream-muted rounded-xl font-black text-xs uppercase tracking-widest hover:bg-warm-input transition-all">
                {t('cancel')}
              </button>
              <button onClick={addPrinter} disabled={savingPrinter}
                className="flex items-center gap-2 px-5 py-2.5 bg-accent text-[#faf5ee] rounded-xl font-black text-xs uppercase tracking-widest hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all">
                <Save size={13} />
                {savingPrinter ? t('saving') : t('save_printer')}
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowAddPrinter(true)}
            className="flex items-center gap-2 px-5 py-3 border-2 border-dashed border-warm-line text-cream-faint hover:text-cream hover:border-warm-line-strong rounded-2xl font-black text-xs uppercase tracking-widest transition-all w-full justify-center">
            <Plus size={16} />
            {t('add_printer')}
          </button>
        )}
      </Section>

      <Section icon={Tag} title={t('cat_settings_title')} subtitle={t('cat_settings_subtitle')}>
        <CategoryManager />
      </Section>

      <Section icon={Warehouse} title={t('warehouses')} subtitle={t('warehouses_subtitle')}>
        <WarehousesTab />
      </Section>

      <Section icon={LayoutGrid} title={t('tables_section_title')} subtitle={t('tables_subtitle')}>
        <TablesSection />
      </Section>

      <Section icon={Mail} title={t('email_settings')} subtitle="SMTP конфигурација за испраќање извештаи до добавувачи">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label={t('smtp_host')}>
            <input className={inputCls} value={emailCfg.smtpHost}
              onChange={e => setEmailCfg(s => ({ ...s, smtpHost: e.target.value }))}
              placeholder="smtp.gmail.com" />
          </Field>
          <Field label={t('smtp_port')}>
            <input type="number" className={inputCls} value={emailCfg.smtpPort}
              onChange={e => setEmailCfg(s => ({ ...s, smtpPort: Number(e.target.value) }))} />
          </Field>
          <Field label={t('smtp_user')}>
            <input className={inputCls} value={emailCfg.smtpUser}
              onChange={e => setEmailCfg(s => ({ ...s, smtpUser: e.target.value }))}
              placeholder="restaurant@gmail.com" />
          </Field>
          <Field label={t('password')}>
            <input type="password" className={inputCls} value={emailCfg.smtpPass}
              onChange={e => setEmailCfg(s => ({ ...s, smtpPass: e.target.value }))}
              placeholder="••••••••" />
          </Field>
          <Field label={t('smtp_from')}>
            <input className={inputCls} value={emailCfg.smtpFrom}
              onChange={e => setEmailCfg(s => ({ ...s, smtpFrom: e.target.value }))}
              placeholder="GastroPro <noreply@restaurant.mk>" />
          </Field>
          <Field label={t('email_subject_label')}>
            <input className={inputCls} value={emailCfg.subjectTemplate}
              onChange={e => setEmailCfg(s => ({ ...s, subjectTemplate: e.target.value }))} />
          </Field>
        </div>
        <div className="mt-5">
          <label className="flex items-center gap-3 cursor-pointer w-fit">
            <div
              onClick={() => setEmailCfg(s => ({ ...s, autoSendOnZClose: !s.autoSendOnZClose }))}
              className={`w-10 h-5 rounded-full transition-colors relative ${emailCfg.autoSendOnZClose ? 'bg-accent' : 'bg-surface-2 border border-warm-line'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${emailCfg.autoSendOnZClose ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-sm text-cream-muted font-medium">{t('auto_send_on_z_close')}</span>
          </label>
          <p className="text-xs text-cream-faint mt-1.5 ml-14">
            {t('auto_send_description')}
          </p>
        </div>
        <div className="mt-6 pt-6 border-t border-warm-line">
          <p className="text-xs font-black text-cream-faint uppercase tracking-widest mb-4">{t('test_send')}</p>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Field label={t('test_email_address')}>
                <input className={inputCls} type="email" value={testEmailTo}
                  onChange={e => setTestEmailTo(e.target.value)}
                  placeholder="test@example.com" />
              </Field>
            </div>
            <button
              onClick={sendTestEmail}
              disabled={sendingTest}
              className="flex items-center gap-2 px-5 py-3 bg-surface-2 border border-warm-line text-cream-muted rounded-2xl font-black text-xs uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all shrink-0"
            >
              <Send size={14} />
              {sendingTest ? 'Испраќање...' : t('send_test_email')}
            </button>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button onClick={saveEmailSettings} disabled={savingEmail}
            className="flex items-center gap-2 px-6 py-3 bg-accent text-[#faf5ee] rounded-2xl font-black text-xs uppercase tracking-widest hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all">
            <Save size={15} />
            {savingEmail ? 'Зачувување...' : t('save')}
          </button>
        </div>
      </Section>

      <Section icon={Lock} title={t('change_password')} subtitle={t('change_password_subtitle')}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Field label={t('current_password')}>
            <input type="password" className={inputCls} value={pwd.current}
              onChange={e => setPwd(s => ({ ...s, current: e.target.value }))} placeholder="••••••••" />
          </Field>
          <Field label={t('new_password')}>
            <input type="password" className={inputCls} value={pwd.next}
              onChange={e => setPwd(s => ({ ...s, next: e.target.value }))} placeholder="••••••••" />
          </Field>
          <Field label={t('confirm_new_password')}>
            <input type="password" className={inputCls} value={pwd.confirm}
              onChange={e => setPwd(s => ({ ...s, confirm: e.target.value }))} placeholder="••••••••" />
          </Field>
        </div>
        {pwd.next && pwd.confirm && pwd.next !== pwd.confirm && (
          <p className="mt-3 text-xs text-red-400 flex items-center gap-1.5">
            <AlertCircle size={12} /> {t('passwords_mismatch')}
          </p>
        )}
        <div className="mt-6 flex justify-end">
          <button onClick={changePassword} disabled={savingPwd}
            className="flex items-center gap-2 px-6 py-3 bg-accent text-[#faf5ee] rounded-2xl font-black text-xs uppercase tracking-widest hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all">
            <Lock size={15} />
            {savingPwd ? t('saving') : t('change_password')}
          </button>
        </div>
      </Section>
    </div>
  );
};

export default SettingsPage;
