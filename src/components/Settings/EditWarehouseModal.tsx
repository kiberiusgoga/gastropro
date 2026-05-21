import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import apiClient from '../../lib/apiClient';
import { Warehouse } from './WarehousesList';

interface Props {
  warehouse: Warehouse;
  onClose: () => void;
  onUpdated: (w: Warehouse) => void;
}

const inputCls = 'w-full px-4 py-3 bg-warm-input border border-warm-line rounded-btn text-sm font-medium text-cream focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/50 transition-all placeholder:text-cream-faint';

const EditWarehouseModal: React.FC<Props> = ({ warehouse, onClose, onUpdated }) => {
  const { t } = useTranslation();
  const [name, setName] = useState(warehouse.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await apiClient.put(`/warehouses/${warehouse.id}`, { name: name.trim() });
      const updated: Warehouse = {
        ...warehouse,
        name: res.data.name,
      };
      toast.success(t('success_update'));
      onUpdated(updated);
    } catch (err: any) {
      if (err?.response?.status === 409) {
        setError(t('warehouse_name_exists'));
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
          <h2 className="text-sm font-black text-cream uppercase tracking-widest">{t('edit_warehouse')}</h2>
          <button onClick={onClose} className="p-1.5 text-cream-faint hover:text-cream hover:bg-surface-2 rounded-lg transition-all">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-black text-cream-faint uppercase tracking-widest mb-2">
              {t('warehouse_name')}
            </label>
            <input
              className={inputCls}
              value={name}
              onChange={e => { setName(e.target.value); setError(''); }}
              autoFocus
            />
            {error && (
              <p className="mt-2 text-xs text-rose-400">{error}</p>
            )}
            {warehouse.is_main && (
              <p className="mt-2 text-xs text-cream-faint">
                {t('cannot_delete_main')}
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-surface-2 text-cream-muted rounded-btn font-black text-xs uppercase tracking-widest hover:bg-warm-input transition-all">
              {t('cancel')}
            </button>
            <button type="submit" disabled={saving || !name.trim() || name.trim() === warehouse.name}
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

export default EditWarehouseModal;
