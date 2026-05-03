import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MenuItem, MenuCategory } from '../types';
import { menuService } from '../services/menuService';
import { recipeService, RecipeIngredient, InventoryProduct } from '../services/recipeService';
import { useStore } from '../store/useStore';
import { toast } from 'sonner';
import { Plus, Search, Edit2, Trash2, ToggleLeft, ToggleRight, X, ChefHat, FlaskConical, AlertTriangle, Trash } from 'lucide-react';

const STATIONS = ['kitchen', 'bar', 'grill', 'pastry'];

// ============================================================
// Dozvoleni recipe_unit vrednosti spored inventory_item.unit
// ============================================================
function allowedUnitsFor(inventoryUnit: string): string[] {
  switch (inventoryUnit) {
    case 'kg':  return ['g', 'kg'];
    case 'l':   return ['ml', 'l'];
    case 'pcs': return ['pcs'];
    case 'box': return ['box'];
    default:    return [inventoryUnit];
  }
}

// ============================================================
// RecipeTab — tab za normativ vnatre vo Add/Edit modalot
// ============================================================
const RecipeTab: React.FC<{ menuItemId: string }> = ({ menuItemId }) => {
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [addForm, setAddForm] = useState({ inventory_item_id: '', quantity: '', recipe_unit: '' });
  const [adding, setAdding] = useState(false);

  const selectedProduct = products.find(p => p.id === addForm.inventory_item_id) ?? null;
  const unitOptions = selectedProduct ? allowedUnitsFor(selectedProduct.unit) : [];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rec, prods] = await Promise.all([
        recipeService.getRecipe(menuItemId).catch(() => []),
        recipeService.getInventoryProducts().catch(() => []),
      ]);
      const safeRec = Array.isArray(rec) ? rec : [];
      const safeProds = Array.isArray(prods) ? prods : [];
      setIngredients(safeRec);
      setProducts(safeProds);
      if (!addForm.inventory_item_id && safeProds.length > 0) {
        const first = safeProds[0];
        setAddForm(f => ({ ...f, inventory_item_id: first.id, recipe_unit: allowedUnitsFor(first.unit)[0] }));
      }
    } catch {
      setIngredients([]);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [menuItemId]);

  useEffect(() => { load(); }, [load]);

  // Koga se menuva izbraniot proizvod, go resetira recipe_unit
  const handleProductChange = (productId: string) => {
    const prod = products.find(p => p.id === productId);
    const units = prod ? allowedUnitsFor(prod.unit) : [];
    setAddForm(f => ({ ...f, inventory_item_id: productId, recipe_unit: units[0] ?? '' }));
  };

  const handleAdd = async () => {
    if (!addForm.inventory_item_id || !addForm.quantity || !addForm.recipe_unit) {
      toast.error('Пополни ги сите полиња');
      return;
    }
    setAdding(true);
    try {
      await recipeService.addIngredient(menuItemId, {
        inventory_item_id: addForm.inventory_item_id,
        quantity: Number(addForm.quantity),
        recipe_unit: addForm.recipe_unit,
      });
      setAddForm(f => ({ ...f, quantity: '' }));
      await load();
      toast.success('Состојката е додадена');
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Грешка при додавање');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (rid: string) => {
    try {
      await recipeService.deleteIngredient(menuItemId, rid);
      setIngredients(prev => prev.filter(i => i.id !== rid));
      toast.success('Состојката е избришана');
    } catch {
      toast.error('Грешка при бришење');
    }
  };

  const inputCls = 'px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 dark:text-white';

  if (loading) return (
    <div className="flex items-center justify-center py-12 text-zinc-400 gap-2">
      <FlaskConical size={20} className="animate-pulse" />
      <span className="text-sm font-bold">Се вчитува нормативот...</span>
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-black text-zinc-700 dark:text-zinc-200">Состојки за подготовка</p>
        <p className="text-xs text-zinc-400 mt-0.5">
          Овие количини ќе се одземат од магацин при секоја продажба
        </p>
      </div>

      {/* Tabela so sostojki */}
      {ingredients.length === 0 ? (
        <div className="text-center py-8 bg-zinc-50 dark:bg-zinc-800 rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-700">
          <FlaskConical size={28} className="mx-auto mb-2 text-zinc-300 dark:text-zinc-600" />
          <p className="text-sm font-bold text-zinc-400">Нема дефиниран норматив</p>
          <p className="text-xs text-zinc-400 mt-0.5">Додај состојка за да почнеш</p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/60">
                <th className="text-left px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-zinc-400">Состојка</th>
                <th className="text-right px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-zinc-400">Количина</th>
                <th className="text-right px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-zinc-400">Залиха</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {ingredients.map(ing => {
                const sufficient = ing.current_stock >= ing.quantity;
                return (
                  <tr key={ing.id} className="group">
                    <td className="px-4 py-3 font-bold text-zinc-800 dark:text-zinc-200">{ing.ingredient_name}</td>
                    <td className="px-4 py-3 text-right font-mono text-zinc-600 dark:text-zinc-400">
                      {ing.quantity} {ing.recipe_unit}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                        sufficient
                          ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                          : 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400'
                      }`}>
                        {!sufficient && <AlertTriangle size={10} />}
                        {ing.current_stock} {ing.inventory_unit}
                      </span>
                    </td>
                    <td className="px-2 py-3">
                      <button
                        onClick={() => handleDelete(ing.id)}
                        className="p-1.5 text-zinc-300 dark:text-zinc-600 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Forma za dodavanje sostojok */}
      <div className="bg-zinc-50 dark:bg-zinc-800/40 rounded-xl p-4 space-y-3 border border-zinc-100 dark:border-zinc-800">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Додај состојка</p>
        <div className="grid grid-cols-[1fr_80px_80px_36px] gap-2 items-end">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1 block">Производ</label>
            <select
              value={addForm.inventory_item_id}
              onChange={e => handleProductChange(e.target.value)}
              className={`w-full ${inputCls}`}
            >
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1 block">Кол.</label>
            <input
              type="number"
              min="0.001"
              step="0.001"
              value={addForm.quantity}
              onChange={e => setAddForm(f => ({ ...f, quantity: e.target.value }))}
              placeholder="0"
              className={inputCls}
            />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1 block">Јед.</label>
            <select
              value={addForm.recipe_unit}
              onChange={e => setAddForm(f => ({ ...f, recipe_unit: e.target.value }))}
              className={inputCls}
            >
              {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <button
            onClick={handleAdd}
            disabled={adding}
            className="h-[38px] w-9 flex items-center justify-center bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-lg transition-all disabled:opacity-50 shadow-sm"
          >
            <Plus size={16} strokeWidth={3} />
          </button>
        </div>
      </div>
    </div>
  );
};

const emptyForm = (): Partial<MenuItem> => ({
  name: '',
  description: '',
  price: 0,
  menuCategoryId: '',
  available: true,
  active: true,
  preparationStation: 'kitchen',
});

const MenuList: React.FC = () => {
  const { user } = useStore();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<MenuItem | null>(null);
  const [form, setForm] = useState<Partial<MenuItem>>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [modalTab, setModalTab] = useState<'details' | 'recipe'>('details');
  // catAssignments: categoryId → price override string ('' = no override)
  const [catAssignments, setCatAssignments] = useState<Record<string, string>>({});
  // origCatIds: category IDs before editing — used for diff on save
  const [origCatIds, setOrigCatIds] = useState<string[]>([]);

  useEffect(() => {
    fetchData();
  }, [user?.restaurantId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [itemsData, catsData] = await Promise.all([
        menuService.getItems(),
        menuService.getCategories(),
      ]);
      setItems(itemsData);
      setCategories(catsData);
    } catch {
      toast.error('Грешка при вчитување на менито');
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const inCategory =
        selectedCategoryId === 'all' ||
        (item.categoryIds && item.categoryIds.length > 0
          ? item.categoryIds.includes(selectedCategoryId)
          : item.menuCategoryId === selectedCategoryId);
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      return inCategory && matchesSearch;
    });
  }, [items, selectedCategoryId, searchQuery]);

  const openAdd = () => {
    setEditItem(null);
    setForm(emptyForm());
    setCatAssignments({});
    setOrigCatIds([]);
    setModalTab('details');
    setShowModal(true);
  };

  const openEdit = async (item: MenuItem) => {
    setEditItem(item);
    setForm({
      name: item.name,
      description: item.description || '',
      price: item.price,
      menuCategoryId: item.menuCategoryId,
      available: item.available,
      active: item.active,
      preparationStation: item.preparationStation,
    });
    setModalTab('details');
    setShowModal(true);
    // Load junction assignments
    const raw = await menuService.getItemCategories(item.id).catch(() => []);
    let assignments: Record<string, string> = {};
    for (const r of raw) {
      assignments[r.category_id] = r.price_override != null ? String(r.price_override) : '';
    }
    // Fallback: if junction is empty (migration not yet run), seed from menuCategoryId
    if (Object.keys(assignments).length === 0 && item.menuCategoryId) {
      assignments[item.menuCategoryId] = '';
    }
    setCatAssignments(assignments);
    setOrigCatIds(Object.keys(assignments));
  };

  const toggleCategory = (catId: string) => {
    setCatAssignments(prev => {
      if (catId in prev) {
        const next = { ...prev };
        delete next[catId];
        return next;
      }
      return { ...prev, [catId]: '' };
    });
  };

  const syncCategories = async (itemId: string, assignments: Record<string, string>, prevIds: string[]) => {
    for (const oldId of prevIds) {
      if (!(oldId in assignments)) {
        await menuService.removeItemCategory(itemId, oldId).catch(() => {});
      }
    }
    for (const [catId, priceStr] of Object.entries(assignments)) {
      const priceOverride = priceStr !== '' ? Number(priceStr) : null;
      await menuService.assignItemCategory(itemId, catId, priceOverride).catch(() => {});
    }
  };

  const handleSave = async () => {
    const selectedCatIds = Object.keys(catAssignments);
    if (!form.name || selectedCatIds.length === 0 || !form.price) {
      toast.error('Пополни ги сите задолжителни полиња');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, menuCategoryId: selectedCatIds[0] };
      if (editItem) {
        const updated = await menuService.updateItem(editItem.id, payload);
        if (updated) setItems(prev => prev.map(i => i.id === editItem.id ? { ...i, ...updated } : i));
        await syncCategories(editItem.id, catAssignments, origCatIds);
        toast.success('Артиклот е ажуриран');
      } else {
        const created = await menuService.createItem(payload);
        if (created) {
          setItems(prev => [...prev, created]);
          await syncCategories(created.id, catAssignments, []);
          toast.success('Артиклот е додаден');
        }
      }
      setShowModal(false);
    } catch {
      toast.error('Грешка при зачувување');
    } finally {
      setSaving(false);
    }
  };

  // Кога корисникот кликнува на табот Норматив:
  // - ако артиклот веќе постои → само го менуваме табот
  // - ако е нов артикл → прво го зачувуваме (без затворање на модалот), па го менуваме табот
  const handleSwitchToRecipe = async () => {
    if (editItem) { setModalTab('recipe'); return; }
    const selectedCatIds = Object.keys(catAssignments);
    if (!form.name || selectedCatIds.length === 0 || !form.price) {
      toast.error('Пополни Назив, Цена и Категорија пред да додадеш норматив');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, menuCategoryId: selectedCatIds[0] };
      const created = await menuService.createItem(payload);
      if (created) {
        setItems(prev => [...prev, created]);
        await syncCategories(created.id, catAssignments, []);
        setOrigCatIds(selectedCatIds);
        setEditItem(created);
        setModalTab('recipe');
        toast.success('Артиклот е зачуван — сега додај состојки');
      }
    } catch {
      toast.error('Грешка при зачувување');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await menuService.deleteItem(id);
      setItems(prev => prev.filter(i => i.id !== id));
      setDeleteConfirm(null);
      toast.success('Артиклот е избришан');
    } catch {
      toast.error('Грешка при бришење');
    }
  };

  const toggleAvailable = async (item: MenuItem) => {
    try {
      const updated = await menuService.updateItem(item.id, { available: !item.available });
      if (updated) {
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, available: !item.available } : i));
      }
    } catch {
      toast.error('Грешка при промена на достапност');
    }
  };

  const categoryName = (id: string) =>
    categories.find(c => c.id === id)?.name ?? '—';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-zinc-400">
        <ChefHat className="animate-pulse" size={28} />
        <span className="font-bold uppercase tracking-widest text-sm">Вчитување...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight dark:text-white">Мени</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{items.length} артикли · {categories.length} категории</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-zinc-950 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
        >
          <Plus size={18} strokeWidth={3} />
          Додај артикл
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide flex-1">
          <button
            onClick={() => setSelectedCategoryId('all')}
            className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all shrink-0 ${
              selectedCategoryId === 'all'
                ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow'
                : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400'
            }`}
          >
            Сите ({items.length})
          </button>
          {categories.filter(c => c.active !== false).map(cat => {
            const count = cat.itemCount !== undefined
              ? cat.itemCount
              : items.filter(i =>
                  i.categoryIds && i.categoryIds.length > 0
                    ? i.categoryIds.includes(cat.id)
                    : i.menuCategoryId === cat.id
                ).length;
            const isActive = selectedCategoryId === cat.id;
            const accent = cat.color || '#10b981';
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategoryId(cat.id)}
                style={isActive ? { backgroundColor: accent, borderColor: accent } : {}}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all shrink-0 border-2 ${
                  isActive
                    ? 'text-white shadow-md'
                    : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600'
                }`}
              >
                {cat.icon && <span className="text-base leading-none">{cat.icon}</span>}
                {!cat.icon && (
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: isActive ? 'rgba(255,255,255,0.7)' : accent }}
                  />
                )}
                {cat.name}
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-lg ${
                  isActive ? 'bg-white/20 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
          <input
            type="text"
            placeholder="Пребарај..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl w-56 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 dark:text-white transition-all"
          />
        </div>
      </div>

      {/* Grid */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-20 text-zinc-400">
          <ChefHat size={40} className="mx-auto mb-4 opacity-30" />
          <p className="font-bold">Нема артикли</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          <AnimatePresence mode="popLayout">
            {filteredItems.map(item => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`bg-white dark:bg-zinc-900 rounded-2xl border overflow-hidden group transition-all ${
                  item.available
                    ? 'border-zinc-100 dark:border-zinc-800 hover:shadow-lg hover:border-emerald-200 dark:hover:border-emerald-800'
                    : 'border-zinc-200 dark:border-zinc-700 opacity-60'
                }`}
              >
                {/* Image */}
                <div className="h-36 bg-zinc-100 dark:bg-zinc-800 relative overflow-hidden">
                  <img
                    src={item.imageUrl || `https://picsum.photos/seed/${item.id}/400/300`}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                  {!item.available && (
                    <div className="absolute inset-0 bg-zinc-900/50 flex items-center justify-center">
                      <span className="text-white text-xs font-black uppercase tracking-widest bg-zinc-900/80 px-3 py-1 rounded-full">
                        Недостапно
                      </span>
                    </div>
                  )}
                  <div className="absolute top-2 right-2 bg-white/90 dark:bg-zinc-900/90 backdrop-blur px-2 py-1 rounded-lg text-sm font-black text-zinc-900 dark:text-zinc-100 shadow">
                    {item.displayedPrice ?? item.price} ден.
                  </div>
                </div>

                {/* Content */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-bold text-zinc-900 dark:text-zinc-100 leading-tight text-sm">{item.name}</h3>
                    <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded shrink-0">
                      {item.categoryName || categoryName(item.menuCategoryId)}
                    </span>
                  </div>
                  {item.description && (
                    <p className="text-zinc-400 text-xs line-clamp-1 mb-3">{item.description}</p>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                    <button
                      onClick={() => toggleAvailable(item)}
                      className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                      title={item.available ? 'Означи недостапно' : 'Означи достапно'}
                    >
                      {item.available
                        ? <ToggleRight size={18} className="text-emerald-500" />
                        : <ToggleLeft size={18} />}
                    </button>
                    <div className="flex-1" />
                    <button
                      onClick={() => openEdit(item)}
                      className="p-1.5 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(item.id)}
                      className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={e => e.target === e.currentTarget && setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg"
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-6 pt-6 pb-0">
                <h2 className="text-lg font-black dark:text-white">
                  {editItem ? 'Уреди артикл' : 'Нов артикл'}
                </h2>
                <button onClick={() => setShowModal(false)} className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>

              {/* Tab switcher */}
              <div className="flex gap-1 mx-6 mt-4 bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1">
                <button
                  onClick={() => setModalTab('details')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                    modalTab === 'details'
                      ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow'
                      : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
                >
                  <ChefHat size={13} />
                  Детали
                </button>
                <button
                  onClick={handleSwitchToRecipe}
                  disabled={saving}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                    modalTab === 'recipe'
                      ? 'bg-white dark:bg-zinc-700 text-emerald-600 dark:text-emerald-400 shadow'
                      : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
                >
                  <FlaskConical size={13} />
                  Норматив
                </button>
              </div>

              {/* Tab content */}
              <div className="p-6">
                {modalTab === 'details' ? (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-1.5 block">Назив *</label>
                      <input
                        type="text"
                        value={form.name || ''}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 dark:text-white"
                        placeholder="Пр. Маргарита"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-1.5 block">Цена (ден) *</label>
                      <input
                        type="number"
                        min={0}
                        value={form.price || ''}
                        onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))}
                        className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-2 block">
                        Категории * {Object.keys(catAssignments).length > 0 && (
                          <span className="ml-1 normal-case font-medium text-emerald-600">
                            ({Object.keys(catAssignments).length} избрани)
                          </span>
                        )}
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {categories.filter(c => c.active !== false).map(cat => {
                          const selected = cat.id in catAssignments;
                          const accent = cat.color || '#10b981';
                          return (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => toggleCategory(cat.id)}
                              style={selected ? { backgroundColor: accent + '22', borderColor: accent, color: accent } : {}}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all ${
                                selected
                                  ? 'shadow-sm'
                                  : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-zinc-400 dark:hover:border-zinc-500'
                              }`}
                            >
                              {cat.icon && <span className="text-sm leading-none">{cat.icon}</span>}
                              {cat.name}
                            </button>
                          );
                        })}
                      </div>

                      {/* Price overrides per category */}
                      {Object.keys(catAssignments).length > 0 && (
                        <div className="mt-3 p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-100 dark:border-zinc-700 space-y-2">
                          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">
                            Ценовно отстапување по категорија (опционално)
                          </p>
                          {Object.keys(catAssignments).map(catId => {
                            const cat = categories.find(c => c.id === catId);
                            return (
                              <div key={catId} className="flex items-center gap-2">
                                <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300 w-28 truncate shrink-0">
                                  {cat?.icon} {cat?.name}
                                </span>
                                <input
                                  type="number"
                                  min={0}
                                  value={catAssignments[catId]}
                                  onChange={e => setCatAssignments(prev => ({ ...prev, [catId]: e.target.value }))}
                                  placeholder={`Основна: ${form.price ?? 0} ден.`}
                                  className="flex-1 px-3 py-1.5 bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 dark:text-white"
                                />
                                <span className="text-xs text-zinc-400 shrink-0">ден.</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-1.5 block">Опис</label>
                      <textarea
                        value={form.description || ''}
                        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                        rows={2}
                        className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 dark:text-white resize-none"
                        placeholder="Краток опис..."
                      />
                    </div>

                    <div>
                      <label className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-1.5 block">Станица за подготовка</label>
                      <select
                        value={form.preparationStation || 'kitchen'}
                        onChange={e => setForm(f => ({ ...f, preparationStation: e.target.value as any }))}
                        className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 dark:text-white"
                      >
                        {STATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
                      <span className="text-sm font-bold dark:text-zinc-200">Достапно на мени</span>
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, available: !f.available }))}
                        className="transition-colors"
                      >
                        {form.available
                          ? <ToggleRight size={28} className="text-emerald-500" />
                          : <ToggleLeft size={28} className="text-zinc-400" />}
                      </button>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => setShowModal(false)}
                        className="flex-1 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all"
                      >
                        Откажи
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 py-2.5 bg-emerald-500 text-zinc-950 rounded-xl text-sm font-black uppercase tracking-wide hover:bg-emerald-400 transition-all disabled:opacity-50"
                      >
                        {saving ? 'Зачувување...' : editItem ? 'Зачувај' : 'Додај'}
                      </button>
                    </div>
                  </div>
                ) : (
                  editItem && <RecipeTab menuItemId={editItem.id} />
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirm */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center"
            >
              <Trash2 size={32} className="text-rose-500 mx-auto mb-3" />
              <h3 className="font-black text-lg dark:text-white mb-2">Избриши артикл?</h3>
              <p className="text-zinc-500 text-sm mb-6">Оваа акција не може да се поврати.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all"
                >
                  Откажи
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  className="flex-1 py-2.5 bg-rose-500 text-white rounded-xl font-black text-sm hover:bg-rose-600 transition-all"
                >
                  Избриши
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MenuList;
