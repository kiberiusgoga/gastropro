import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import {
  Plus, Pencil, Trash2, Lock, ChevronUp, ChevronDown,
  Save, X, GripVertical, Tag,
} from 'lucide-react';
import { MenuCategory } from '../../types';
import { menuService } from '../../services/menuService';

// ── Colour palette ────────────────────────────────────────────────────────────
const COLORS = [
  '#ef4444','#f97316','#eab308','#22c55e',
  '#14b8a6','#3b82f6','#8b5cf6','#ec4899',
  '#64748b','#1e293b',
];

// ── Emoji/icon shortlist ──────────────────────────────────────────────────────
const ICONS = ['🍕','🍝','🥩','🐟','🥗','🍹','🍰','🍲','🥪','🌮','🍜','🫕','🥘','🍱','🫙','🧆'];

// ── Small helpers ─────────────────────────────────────────────────────────────
const inputCls = 'w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all';

const SystemBadge = () => {
  const { t } = useTranslation();
  return (
    <span className="flex items-center gap-1 px-2 py-0.5 bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 rounded-lg text-[10px] font-black uppercase tracking-widest">
      <Lock size={9} />
      {t('cat_type_system')}
    </span>
  );
};

// ── Edit / Create modal ───────────────────────────────────────────────────────
interface CategoryFormState {
  name: string;
  icon: string;
  color: string;
}

interface CategoryModalProps {
  initial?: MenuCategory;
  onSave: (data: CategoryFormState) => Promise<void>;
  onClose: () => void;
}

const CategoryModal: React.FC<CategoryModalProps> = ({ initial, onSave, onClose }) => {
  const { t } = useTranslation();
  const [form, setForm] = useState<CategoryFormState>({
    name: initial?.name ?? '',
    icon: initial?.icon ?? '',
    color: initial?.color ?? '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error(t('cat_name_required')); return; }
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Грешка при зачувување');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100 dark:border-zinc-800">
          <h2 className="text-sm font-black uppercase tracking-widest text-zinc-900 dark:text-zinc-100">
            {initial ? t('cat_edit_title') : t('cat_create_title')}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all">
            <X size={16} className="text-zinc-500" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-xs font-black text-zinc-500 uppercase tracking-widest mb-2">{t('name')}</label>
            <input
              className={inputCls}
              value={form.name}
              onChange={e => setForm(s => ({ ...s, name: e.target.value }))}
              placeholder="Пр. Специјалитети"
              autoFocus
            />
          </div>

          {/* Icon */}
          <div>
            <label className="block text-xs font-black text-zinc-500 uppercase tracking-widest mb-2">{t('cat_icon_label')}</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {ICONS.map(em => (
                <button
                  key={em}
                  onClick={() => setForm(s => ({ ...s, icon: s.icon === em ? '' : em }))}
                  className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center transition-all border-2 ${
                    form.icon === em
                      ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-100 dark:bg-zinc-700 scale-110'
                      : 'border-transparent hover:border-zinc-200 dark:hover:border-zinc-600'
                  }`}
                >
                  {em}
                </button>
              ))}
            </div>
            <input
              className={inputCls}
              value={form.icon}
              onChange={e => setForm(s => ({ ...s, icon: e.target.value }))}
              placeholder={t('cat_icon_placeholder')}
            />
          </div>

          {/* Color */}
          <div>
            <label className="block text-xs font-black text-zinc-500 uppercase tracking-widest mb-2">{t('cat_color_label')}</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setForm(s => ({ ...s, color: s.color === c ? '' : c }))}
                  style={{ backgroundColor: c }}
                  className={`w-7 h-7 rounded-xl transition-all border-2 ${
                    form.color === c ? 'border-zinc-900 dark:border-zinc-100 scale-125' : 'border-transparent'
                  }`}
                />
              ))}
            </div>
            <input
              className={inputCls}
              value={form.color}
              onChange={e => setForm(s => ({ ...s, color: e.target.value }))}
              placeholder={t('cat_color_placeholder')}
            />
          </div>
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose}
            className="flex-1 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-zinc-200 transition-all">
            {t('cancel')}
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 disabled:opacity-50 transition-all">
            <Save size={13} />
            {saving ? `${t('save')}...` : t('save')}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
const CategoryManager: React.FC = () => {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; cat?: MenuCategory } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await menuService.getCategories();
      setCategories(data.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)));
    } catch {
      toast.error(t('cat_load_error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  // ── Reorder helpers ──────────────────────────────────────────────────────────
  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= categories.length) return;
    const next = [...categories];
    [next[index], next[target]] = [next[target], next[index]];
    const reindexed = next.map((c, i) => ({ ...c, sortOrder: i }));
    setCategories(reindexed);
    try {
      await menuService.reorderCategories(reindexed.map(c => ({ id: c.id, sort_order: c.sortOrder })));
    } catch {
      toast.error(t('cat_reorder_error'));
      load();
    }
  };

  // ── Create ───────────────────────────────────────────────────────────────────
  const handleCreate = async (form: { name: string; icon: string; color: string }) => {
    const created = await menuService.createCategory({
      name: form.name,
      icon: form.icon || undefined,
      color: form.color || undefined,
      sortOrder: categories.length,
    });
    if (created) setCategories(prev => [...prev, created]);
    toast.success(t('cat_created'));
  };

  // ── Edit ─────────────────────────────────────────────────────────────────────
  const handleEdit = async (form: { name: string; icon: string; color: string }) => {
    if (!modal?.cat) return;
    const updated = await menuService.updateCategory(modal.cat.id, {
      name: form.name,
      icon: form.icon || undefined,
      color: form.color || undefined,
    });
    if (updated) setCategories(prev => prev.map(c => c.id === updated.id ? updated : c));
    toast.success(t('cat_updated'));
  };

  // ── Delete ───────────────────────────────────────────────────────────────────
  const handleDelete = async (cat: MenuCategory) => {
    if (!window.confirm(t('cat_delete_confirm', { name: cat.name }))) return;
    setDeletingId(cat.id);
    try {
      await menuService.deleteCategory(cat.id);
      setCategories(prev => prev.filter(c => c.id !== cat.id));
      toast.success(t('cat_deleted'));
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? t('error');
      toast.error(msg);
    } finally {
      setDeletingId(null);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  if (loading) {
    return <div className="py-10 text-center text-zinc-400 text-sm">{t('loading')}</div>;
  }

  return (
    <>
      <div className="space-y-2">
        {categories.length === 0 && (
          <div className="py-10 text-center text-zinc-400 text-sm flex flex-col items-center gap-2">
            <Tag size={32} strokeWidth={1} />
            {t('cat_empty')}
          </div>
        )}

        {categories.map((cat, idx) => {
          const isSystem = cat.type === 'system';
          const accent = cat.color || '#64748b';

          return (
            <div key={cat.id}
              className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-700/60 rounded-2xl group transition-all hover:shadow-sm">

              {/* Drag handle / order indicator */}
              <GripVertical size={16} className="text-zinc-300 dark:text-zinc-600 shrink-0" />

              {/* Color dot + icon */}
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                style={{ backgroundColor: accent + '22', border: `2px solid ${accent}33` }}>
                {cat.icon
                  ? <span className="text-base leading-none">{cat.icon}</span>
                  : <span className="w-3 h-3 rounded-full" style={{ backgroundColor: accent }} />
                }
              </div>

              {/* Name + badges */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-black text-zinc-900 dark:text-zinc-100 truncate">{cat.name}</span>
                  {isSystem && <SystemBadge />}
                  {cat.itemCount !== undefined && (
                    <span className="text-[10px] font-bold text-zinc-400">
                      {t('cat_items_count', { count: cat.itemCount })}
                    </span>
                  )}
                </div>
              </div>

              {/* Reorder arrows */}
              <div className="flex flex-col gap-0.5 shrink-0">
                <button
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                  className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-20 transition-all"
                >
                  <ChevronUp size={12} />
                </button>
                <button
                  onClick={() => move(idx, 1)}
                  disabled={idx === categories.length - 1}
                  className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-20 transition-all"
                >
                  <ChevronDown size={12} />
                </button>
              </div>

              {/* Edit — always visible; for system cats opens modal but name will be read-only in future */}
              {!isSystem && (
                <button
                  onClick={() => setModal({ mode: 'edit', cat })}
                  className="p-2 rounded-xl text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                  title={t('edit')}
                >
                  <Pencil size={14} />
                </button>
              )}

              {/* Delete — only custom */}
              {!isSystem && (
                <button
                  onClick={() => handleDelete(cat)}
                  disabled={deletingId === cat.id}
                  className="p-2 rounded-xl text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40 transition-all"
                  title={t('delete')}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Add button */}
      <button
        onClick={() => setModal({ mode: 'create' })}
        className="mt-4 flex items-center gap-2 px-5 py-3 border-2 border-dashed border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-zinc-400 rounded-2xl font-black text-xs uppercase tracking-widest transition-all w-full justify-center"
      >
        <Plus size={16} />
        {t('add_category')}
      </button>

      {/* Modal */}
      {modal && (
        <CategoryModal
          initial={modal.mode === 'edit' ? modal.cat : undefined}
          onSave={modal.mode === 'create' ? handleCreate : handleEdit}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
};

export default CategoryManager;
