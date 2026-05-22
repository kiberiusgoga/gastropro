import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '../../lib/apiClient';
import { Table } from '../../types';
import { Warehouse } from './WarehousesList';
import TablesList from './TablesList';
import CreateTableModal from './CreateTableModal';
import EditTableModal from './EditTableModal';
import DeleteTableDialog from './DeleteTableDialog';

const TablesSection: React.FC = () => {
  const { t } = useTranslation();
  const [tables, setTables] = useState<Table[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Table | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Table | null>(null);

  const load = useCallback(async () => {
    try {
      const [tRes, wRes] = await Promise.all([
        apiClient.get('/tables'),
        apiClient.get('/warehouses'),
      ]);
      setTables(tRes.data);
      setWarehouses(wRes.data);
    } catch {
      toast.error(t('error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const mainWarehouseId = warehouses.find(w => w.is_main)?.id ?? '';
  const warehousesInUse = new Set(tables.map(t => t.warehouseId).filter(Boolean)).size;

  if (loading) {
    return <div className="py-8 text-center text-cream-faint text-sm">{t('loading')}</div>;
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <span className="text-cream-faint text-sm">
          {tables.length} {t('tables_section_title').toLowerCase()} · {warehousesInUse} {t('warehouses').toLowerCase()}
        </span>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-accent text-[#faf5ee] rounded-btn font-black text-xs uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all"
        >
          <Plus size={13} />
          {t('new_table')}
        </button>
      </div>

      <TablesList
        tables={tables}
        warehouses={warehouses}
        onEdit={setEditTarget}
        onDelete={setDeleteTarget}
        onTablesUpdated={setTables}
      />

      {showCreate && (
        <CreateTableModal
          warehouses={warehouses}
          mainWarehouseId={mainWarehouseId}
          onClose={() => setShowCreate(false)}
          onCreated={newTable => {
            setTables(prev => [...prev, newTable].sort((a, b) => a.number - b.number));
            setShowCreate(false);
          }}
        />
      )}

      {editTarget && (
        <EditTableModal
          table={editTarget}
          warehouses={warehouses}
          onClose={() => setEditTarget(null)}
          onSaved={saved => {
            setTables(prev => prev.map(t => t.id === saved.id ? saved : t));
            setEditTarget(null);
          }}
        />
      )}

      {deleteTarget && (
        <DeleteTableDialog
          table={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={id => {
            setTables(prev => prev.filter(t => t.id !== id));
            setDeleteTarget(null);
          }}
        />
      )}
    </>
  );
};

export default TablesSection;
