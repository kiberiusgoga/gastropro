import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import apiClient from '../../lib/apiClient';
import { Table } from '../../types';
import { Warehouse } from './WarehousesList';

interface Props {
  table: Table;
  warehouses: Warehouse[];
  onClose: () => void;
  onSaved: (t: Table) => void;
}

const inputCls = 'w-full px-4 py-3 bg-warm-input border border-warm-line rounded-btn text-sm font-medium text-cream focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/50 transition-all placeholder:text-cream-faint';
const labelCls = 'block text-xs font-black text-cream-faint uppercase tracking-widest mb-2';

const EditTableModal: React.FC<Props> = ({ table, warehouses, onClose, onSaved }) => {
  const { t } = useTranslation();
  const [number, setNumber] = useState(String(table.number));
  const [capacity, setCapacity] = useState(String(table.capacity));
  const [zone, setZone] = useState(table.zone || '');
  const [warehouseId, setWarehouseId] = useState(table.warehouseId || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const unchanged =
    parseInt(number) === table.number &&
    parseInt(capacity) === table.capacity &&
    zone === (table.zone || '') &&
    warehouseId === (table.warehouseId || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (unchanged) return;
    setSaving(true);
    setError('');
    try {
      const res = await apiClient.put(`/tables/${table.id}`, {
        number: parseInt(number),
        capacity: parseInt(capacity) || table.capacity,
        zone: zone.trim() || table.zone,
        status: table.status,
        active: table.active !== false,
        warehouse_id: warehouseId || undefined,
      });
      const row = res.data;
      toast.success(t('success_edit'));
      onSaved({
        id: row.id,
        restaurantId: row.restaurant_id,
        number: row.number,
        capacity: row.capacity,
        zone: row.zone,
        status: row.status,
        active: row.active,
        warehouseId: row.warehouse_id,
        warehouseName: warehouses.find(w => w.id === row.warehouse_id)?.name,
      });
    } catch (err: any) {
      if (err?.response?.status === 409) {
        setError(t('table_number_exists'));
      } else {
        toast.error(t('error'));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface border border-warm-line rounded-card shadow-card-lg w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-5 border-b border-warm-line">
          <h2 className="text-sm font-black text-cream uppercase tracking-widest">{t('edit_table')}</h2>
          <button onClick={onClose} className="p-1.5 text-cream-faint hover:text-cream hover:bg-surface-2 rounded-lg transition-all">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{t('table_number')}</label>
              <input
                className={inputCls}
                type="number"
                min="1"
                value={number}
                onChange={e => { setNumber(e.target.value); setError(''); }}
                autoFocus
              />
            </div>
            <div>
              <label className={labelCls}>{t('table_capacity')}</label>
              <input
                className={inputCls}
                type="number"
                min="1"
                max="99"
                value={capacity}
                onChange={e => setCapacity(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>{t('table_zone')}</label>
            <input
              className={inputCls}
              value={zone}
              onChange={e => setZone(e.target.value)}
            />
          </div>

          <div>
            <label className={labelCls}>{t('warehouse')}</label>
            <select
              className={inputCls}
              value={warehouseId}
              onChange={e => setWarehouseId(e.target.value)}
            >
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}{w.is_main ? ` (${t('main_warehouse_label')})` : ''}</option>
              ))}
            </select>
          </div>

          {error && <p className="text-xs text-rose-400">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-surface-2 text-cream-muted rounded-btn font-black text-xs uppercase tracking-widest hover:bg-warm-input transition-all">
              {t('cancel')}
            </button>
            <button type="submit" disabled={saving || unchanged}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-accent text-[#faf5ee] rounded-btn font-black text-xs uppercase tracking-widest hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all">
              <Save size={13} />
              {saving ? t('loading') : t('save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditTableModal;
