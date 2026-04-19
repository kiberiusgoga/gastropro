import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Product } from '../types';
import { Package, Plus, ArrowUpRight, ArrowDownLeft, AlertTriangle, Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface InventoryViewProps {
  items?: Product[];
  onUpdateStock?: (id: string, amount: number) => void;
  onAddItem?: (item: Omit<Product, 'id' | 'restaurantId'>) => void;
}

const InventoryView: React.FC<InventoryViewProps> = ({ 
  items: propsItems, 
  onUpdateStock: propsOnUpdateStock, 
  onAddItem: propsOnAddItem 
}) => {
  const store = useStore();
  
  const items = propsItems || store.products;
  const onUpdateStock = propsOnUpdateStock || (() => console.warn('onUpdateStock not provided'));
  const onAddItem = propsOnAddItem || (() => console.warn('onAddItem not provided'));

  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItem, setNewItem] = useState({
    name: '',
    unit: 'кг',
    currentStock: 0,
    minStock: 0,
    category: 'Општо'
  });

  const filteredItems = (items || []).filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddItem(newItem);
    setShowAddModal(false);
    setNewItem({
      name: '',
      unit: 'кг',
      currentStock: 0,
      minStock: 0,
      category: 'Општо'
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
          <input
            id="inventory-search"
            name="inventory-search"
            type="text"
            placeholder="Пребарај во магацин..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl w-full md:w-80 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-zinc-900 dark:text-zinc-100"
          />
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-emerald-700 transition-colors"
        >
          <Plus size={20} />
          Нов артикал во магацин
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
            <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800">
              <th className="px-6 py-4 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Артикал</th>
              <th className="px-6 py-4 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Залиха</th>
              <th className="px-6 py-4 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Единица</th>
              <th className="px-6 py-4 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Статус</th>
              <th className="px-6 py-4 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-right">Акции</th>
            </tr>
          </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {(filteredItems || []).map((item) => (
              <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-400">
                      <Package size={18} />
                    </div>
                    <span className="font-bold text-zinc-900 dark:text-zinc-100">{item.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`font-mono font-bold ${item.currentStock <= item.minStock ? 'text-red-600 dark:text-red-400' : 'text-zinc-900 dark:text-zinc-100'}`}>
                    {item.currentStock}
                  </span>
                </td>
                <td className="px-6 py-4 text-zinc-500 dark:text-zinc-400 font-medium">{item.unit}</td>
                <td className="px-6 py-4">
                  {item.currentStock <= item.minStock ? (
                    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-bold border border-red-100 dark:border-red-800">
                      <AlertTriangle size={12} />
                      Критично
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-100 dark:border-emerald-800">
                      Оптимално
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button 
                      onClick={() => onUpdateStock(item.id, 10)}
                      className="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                      title="Влез на роба"
                    >
                      <ArrowUpRight size={18} />
                    </button>
                    <button 
                      onClick={() => onUpdateStock(item.id, -1)}
                      className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Расход"
                    >
                      <ArrowDownLeft size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

    <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-zinc-950/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white dark:bg-zinc-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden p-8"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-100">Нов артикал</h2>
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-zinc-500"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                    Име на артикал
                  </label>
                  <input
                    required
                    type="text"
                    value={newItem.name}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    className="w-full p-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all text-zinc-900 dark:text-zinc-100"
                    placeholder="пр. Пилешки гради"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                      Единица
                    </label>
                    <select
                      value={newItem.unit}
                      onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                      className="w-full p-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all text-zinc-900 dark:text-zinc-100"
                    >
                      <option value="кг">кг</option>
                      <option value="гр">гр</option>
                      <option value="л">л</option>
                      <option value="мл">мл</option>
                      <option value="парче">парче</option>
                      <option value="пакување">пакување</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                      Категорија
                    </label>
                    <input
                      type="text"
                      value={newItem.category}
                      onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                      className="w-full p-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all text-zinc-900 dark:text-zinc-100"
                      placeholder="пр. Месо"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                      Моментална залиха
                    </label>
                    <input
                      required
                      type="number"
                      min="0"
                      value={newItem.currentStock}
                      onChange={(e) => setNewItem({ ...newItem, currentStock: Number(e.target.value) })}
                      className="w-full p-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                      Минимална залиха
                    </label>
                    <input
                      required
                      type="number"
                      min="0"
                      value={newItem.minStock}
                      onChange={(e) => setNewItem({ ...newItem, minStock: Number(e.target.value) })}
                      className="w-full p-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
                >
                  Додади во магацин
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default InventoryView;
