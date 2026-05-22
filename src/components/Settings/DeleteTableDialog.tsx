import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import apiClient from '../../lib/apiClient';
import { Table } from '../../types';

interface Props {
  table: Table;
  onClose: () => void;
  onDeleted: (id: string) => void;
}

const DeleteTableDialog: React.FC<Props> = ({ table, onClose, onDeleted }) => {
  const { t } = useTranslation();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    setDeleting(true);
    setError('');
    try {
      await apiClient.delete(`/tables/${table.id}`);
      toast.success(t('success_delete'));
      onDeleted(table.id);
    } catch (err: any) {
      const code: string = err?.response?.data?.code ?? '';
      if (code === 'TABLE_HAS_ACTIVE_ORDERS') {
        setError(t('table_has_active_orders'));
      } else {
        toast.error(t('error'));
        onClose();
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface border border-warm-line rounded-card shadow-card-lg w-full max-w-sm">
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-2xl bg-rose-900/30 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={18} className="text-rose-400" />
            </div>
            <div>
              <h3 className="text-sm font-black text-cream">{t('delete_table')}</h3>
              <p className="text-sm text-cream-muted mt-1">
                {t('confirm_delete')} <span className="text-cream font-semibold">#{table.number}</span>?
              </p>
            </div>
          </div>

          {error && (
            <div className="px-4 py-3 bg-rose-900/20 border border-rose-900/40 rounded-xl">
              <p className="text-xs text-rose-400">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-warm-line text-cream rounded-btn font-black text-xs uppercase tracking-widest hover:bg-surface-2 transition-all">
              {t('cancel')}
            </button>
            <button onClick={handleConfirm} disabled={deleting}
              className="flex-1 px-4 py-2.5 bg-rose-600 text-white rounded-btn font-black text-xs uppercase tracking-widest hover:bg-rose-500 active:scale-95 disabled:opacity-50 transition-all">
              {deleting ? t('loading') : t('delete')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteTableDialog;
