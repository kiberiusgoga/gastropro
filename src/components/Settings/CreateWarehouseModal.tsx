import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import apiClient from '../../lib/apiClient';
import { Warehouse } from './WarehousesList';

interface Props {
  onClose: () => void;
  onCreated: (w: Warehouse) => void;
}

const inputCls = 'w-full px-4 py-3 bg-warm-input border border-warm-line rounded-btn text-sm font-medium text-cream focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/50 transition-all placeholder:text-cream-faint';

const CreateWarehouseModal: React.FC<Props> = ({ onClose, onCreated }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await apiClient.post('/warehouses', { name: name.trim() });
      const created: Warehouse = {
        id: res.data.id,
        name: res.data.name,
        is_main: res.data.is_main,
        product_count: 0,
        total_value: 0,
      };
      toast.success(t('success_add'));
      onCreated(created);
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
          <h2 className="text-sm font-black text-cream uppercase tracking-widest">{t('new_warehouse')}</h2>
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
              placeholder="пр. Тераса, Шанк, Резерва..."
              autoFocus
            />
            {error && (
              <p className="mt-2 text-xs text-rose-400">{error}</p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-surface-2 text-cream-muted rounded-btn font-black text-xs uppercase tracking-widest hover:bg-warm-input transition-all">
              {t('cancel')}
            </button>
            <button type="submit" disabled={saving || !name.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-accent text-[#faf5ee] rounded-btn font-black text-xs uppercase tracking-widest hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all">
              <Plus size={13} />
              {saving ? t('loading') : t('new_warehouse')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateWarehouseModal;
