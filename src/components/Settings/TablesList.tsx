import React, { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import apiClient from '../../lib/apiClient';
import { Table } from '../../types';
import { Warehouse } from './WarehousesList';

interface Props {
  tables: Table[];
  warehouses: Warehouse[];
  onEdit: (t: Table) => void;
  onDelete: (t: Table) => void;
  onTablesUpdated: (updated: Table[]) => void;
}

const STATUS_CLS: Record<string, string> = {
  free:     'bg-emerald-500/15 text-emerald-300',
  occupied: 'bg-rose-500/15 text-rose-300',
  reserved: 'bg-amber-500/15 text-amber-300',
};

const TableRow: React.FC<{
  table: Table;
  warehouses: Warehouse[];
  isSelected: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onWarehouseChange: (wId: string) => void;
}> = ({ table, warehouses, isSelected, onToggle, onEdit, onDelete, onWarehouseChange }) => {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);

  return (
    <tr className={`border-b border-warm-line/50 last:border-0 hover:bg-surface-2/40 transition-colors ${isSelected ? 'bg-accent/5' : ''}`}>
      <td className="py-3 px-4 w-10">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggle}
          className="w-4 h-4 rounded border-warm-line bg-warm-input accent-[#c2652a] cursor-pointer"
        />
      </td>
      <td className="py-3 px-4 text-cream font-semibold tabular-nums">{table.number}</td>
      <td className="py-3 px-4 text-cream-muted tabular-nums">{table.capacity}</td>
      <td className="py-3 px-4 text-cream-muted">{table.zone || '—'}</td>
      <td className="py-3 px-4">
        {editing ? (
          <select
            autoFocus
            value={table.warehouseId || ''}
            onChange={e => { onWarehouseChange(e.target.value); setEditing(false); }}
            onBlur={() => setEditing(false)}
            className="bg-warm-input border border-warm-line rounded-btn px-2 py-1 text-cream text-sm focus:outline-none focus:border-accent/50"
          >
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 text-cream hover:text-accent-light transition-colors group"
          >
            <span className="text-sm">{table.warehouseName || '—'}</span>
            <Pencil size={11} className="text-cream-faint group-hover:text-accent-light" />
          </button>
        )}
      </td>
      <td className="py-3 px-4">
        <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${STATUS_CLS[table.status] ?? 'bg-cream-faint/15 text-cream-faint'}`}>
          {t(table.status)}
        </span>
      </td>
      <td className="py-3 px-4 text-right">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={onEdit}
            className="p-2 text-cream-faint hover:text-cream hover:bg-surface-2 rounded-xl transition-all"
            title={t('edit_table')}
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-cream-faint hover:text-rose-400 hover:bg-rose-900/20 rounded-xl transition-all"
            title={t('delete_table')}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
};

const TablesList: React.FC<Props> = ({ tables, warehouses, onEdit, onDelete, onTablesUpdated }) => {
  const { t } = useTranslation();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkWarehouseId, setBulkWarehouseId] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);

  const toggleSelect = (id: string) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toggleAll = () =>
    setSelectedIds(prev => prev.length === tables.length ? [] : tables.map(t => t.id));

  const handleInlineWarehouseChange = async (tableId: string, wId: string) => {
    try {
      const res = await apiClient.put(`/tables/${tableId}`, {
        warehouse_id: wId,
        ...(tables.find(t => t.id === tableId) ?? {}),
        number: tables.find(t => t.id === tableId)?.number,
        capacity: tables.find(t => t.id === tableId)?.capacity,
        zone: tables.find(t => t.id === tableId)?.zone,
        status: tables.find(t => t.id === tableId)?.status,
        active: tables.find(t => t.id === tableId)?.active !== false,
      });
      const row = res.data;
      const wName = warehouses.find(w => w.id === wId)?.name;
      onTablesUpdated(tables.map(t =>
        t.id === tableId ? { ...t, warehouseId: row.warehouse_id, warehouseName: wName } : t
      ));
    } catch {
      toast.error(t('error'));
    }
  };

  const handleBulkApply = async () => {
    if (!bulkWarehouseId || selectedIds.length === 0) return;
    setBulkSaving(true);
    try {
      await apiClient.patch('/tables/bulk', { table_ids: selectedIds, warehouse_id: bulkWarehouseId });
      const wName = warehouses.find(w => w.id === bulkWarehouseId)?.name;
      onTablesUpdated(tables.map(t =>
        selectedIds.includes(t.id) ? { ...t, warehouseId: bulkWarehouseId, warehouseName: wName } : t
      ));
      setSelectedIds([]);
      setBulkWarehouseId('');
      toast.success(t('success_edit'));
    } catch {
      toast.error(t('error'));
    } finally {
      setBulkSaving(false);
    }
  };

  if (tables.length === 0) {
    return <div className="py-10 text-center text-cream-faint text-sm">{t('no_data')}</div>;
  }

  const selectedCount = selectedIds.length;
  const selectedLabel = selectedCount === 1 ? t('tables_selected_one', { count: 1 }) : t('tables_selected_many', { count: selectedCount });

  return (
    <div className="overflow-hidden rounded-2xl border border-warm-line">
      {selectedCount > 0 && (
        <div className="bg-surface-2 border-b border-warm-line px-4 py-3 flex items-center gap-3 flex-wrap">
          <span className="text-cream-muted text-sm font-medium">{selectedLabel}</span>
          <div className="flex-1" />
          <span className="text-cream-faint text-xs uppercase tracking-widest">{t('assign_to_warehouse')}:</span>
          <select
            value={bulkWarehouseId}
            onChange={e => setBulkWarehouseId(e.target.value)}
            className="bg-warm-input border border-warm-line rounded-btn px-3 py-1.5 text-cream text-sm focus:outline-none focus:border-accent/50"
          >
            <option value="">— {t('warehouse_selector')} —</option>
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
          <button
            onClick={handleBulkApply}
            disabled={!bulkWarehouseId || bulkSaving}
            className="px-4 py-1.5 bg-accent text-[#faf5ee] rounded-btn font-black text-xs uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all"
          >
            {bulkSaving ? t('loading') : t('apply')}
          </button>
          <button
            onClick={() => { setSelectedIds([]); setBulkWarehouseId(''); }}
            className="px-3 py-1.5 text-cream-muted hover:text-cream text-xs rounded-btn hover:bg-surface transition-all"
          >
            {t('cancel_selection')}
          </button>
        </div>
      )}

      <table className="w-full">
        <thead className="bg-surface-2 border-b border-warm-line">
          <tr>
            <th className="py-3 px-4 w-10">
              <input
                type="checkbox"
                checked={selectedIds.length === tables.length && tables.length > 0}
                onChange={toggleAll}
                className="w-4 h-4 rounded border-warm-line bg-warm-input accent-[#c2652a] cursor-pointer"
              />
            </th>
            <th className="table-header text-left py-3 px-4">{t('table_number')}</th>
            <th className="table-header text-left py-3 px-4">{t('table_capacity')}</th>
            <th className="table-header text-left py-3 px-4">{t('table_zone')}</th>
            <th className="table-header text-left py-3 px-4">{t('warehouse')}</th>
            <th className="table-header text-left py-3 px-4">{t('status')}</th>
            <th className="table-header text-right py-3 px-4 pr-4">{t('actions')}</th>
          </tr>
        </thead>
        <tbody>
          {tables.map(table => (
            <TableRow
              key={table.id}
              table={table}
              warehouses={warehouses}
              isSelected={selectedIds.includes(table.id)}
              onToggle={() => toggleSelect(table.id)}
              onEdit={() => onEdit(table)}
              onDelete={() => onDelete(table)}
              onWarehouseChange={wId => handleInlineWarehouseChange(table.id, wId)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TablesList;
