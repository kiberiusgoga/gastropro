import React, { useState, useEffect, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import apiClient from '../../lib/apiClient';
import WarehousesList, { Warehouse } from './WarehousesList';
import CreateWarehouseModal from './CreateWarehouseModal';
import EditWarehouseModal from './EditWarehouseModal';
import DeleteWarehouseDialog from './DeleteWarehouseDialog';

const WarehousesTab: React.FC = () => {
  const { t } = useTranslation();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Warehouse | null>(null);
  const [deleting, setDeleting] = useState<Warehouse | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [whRes, statsRes] = await Promise.all([
        apiClient.get('/warehouses'),
        apiClient.get('/warehouses/stats'),
      ]);

      const statsMap: Record<string, { product_count: number; total_value: number }> = {};
      for (const s of statsRes.data) {
        statsMap[s.warehouse_id] = {
          product_count: Number(s.product_count),
          total_value: Number(s.total_value),
        };
      }

      setWarehouses(
        whRes.data.map((w: any): Warehouse => ({
          id: w.id,
          name: w.name,
          is_main: w.is_main,
          product_count: statsMap[w.id]?.product_count ?? 0,
          total_value: statsMap[w.id]?.total_value ?? 0,
        })),
      );
    } catch {
      toast.error(t('error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const handleCreated = (w: Warehouse) => {
    setWarehouses(prev => [...prev, w]);
    setShowCreate(false);
  };

  const handleUpdated = (w: Warehouse) => {
    setWarehouses(prev => prev.map(x => x.id === w.id ? w : x));
    setEditing(null);
  };

  const handleDeleted = (id: string) => {
    setWarehouses(prev => prev.filter(x => x.id !== id));
    setDeleting(null);
  };

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <p className="text-xs text-cream-faint">{loading ? t('loading') : `${warehouses.length} ${t('warehouses').toLowerCase()}`}</p>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-accent text-[#faf5ee] rounded-btn font-black text-xs uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all">
          <Plus size={13} />
          {t('new_warehouse')}
        </button>
      </div>

      <WarehousesList
        warehouses={warehouses}
        onEdit={setEditing}
        onDelete={setDeleting}
      />

      {showCreate && (
        <CreateWarehouseModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
      {editing && (
        <EditWarehouseModal
          warehouse={editing}
          onClose={() => setEditing(null)}
          onUpdated={handleUpdated}
        />
      )}
      {deleting && (
        <DeleteWarehouseDialog
          warehouse={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={handleDeleted}
        />
      )}
    </>
  );
};

export default WarehousesTab;
