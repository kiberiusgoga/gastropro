import React from 'react';
import { motion } from 'motion/react';
import { MenuItem, Category } from '../types';
import { Plus, Search } from 'lucide-react';

interface MenuListProps {
  items: MenuItem[];
  categories: Category[];
  onAddItem: (item: MenuItem) => void;
}

const MenuList: React.FC<MenuListProps> = ({ items, categories, onAddItem }) => {
  const [selectedCategory, setSelectedCategory] = React.useState<Category | 'Сите'>('Сите');
  const [searchQuery, setSearchQuery] = React.useState('');

  const filteredItems = items.filter(item => {
    if (selectedCategory === 'Дневно мени') {
      return item.isDailyMenu && item.name.toLowerCase().includes(searchQuery.toLowerCase());
    }
    const matchesCategory = selectedCategory === 'Сите' || item.category === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
          {['Сите', 'Дневно мени', ...categories].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat as Category | 'Сите')}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800'
              }`}
            >
              {cat === 'Дневно мени' ? (
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                  Дневно мени
                </span>
              ) : cat}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" size={18} />
          <input
            id="menu-list-search"
            name="menu-list-search"
            type="text"
            placeholder="Пребарај јадење..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-zinc-900 dark:text-zinc-100"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredItems.map((item) => (
          <motion.div
            key={item.id}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden group hover:shadow-lg transition-all"
          >
            <div className="h-40 bg-zinc-100 dark:bg-zinc-800 relative overflow-hidden">
              <img
                src={item.image || `https://picsum.photos/seed/${item.id}/400/300`}
                alt={item.name}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                referrerPolicy="no-referrer"
              />
              <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
                {item.isDailyMenu && (
                  <span className="bg-emerald-500 text-white px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shadow-sm">
                    -{item.dailyMenuDiscount}%
                  </span>
                )}
                <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur px-2 py-1 rounded-lg text-sm font-bold text-zinc-900 dark:text-zinc-100 shadow-sm">
                  {item.isDailyMenu 
                    ? Math.round(item.price * (1 - (item.dailyMenuDiscount || 0) / 100)) 
                    : item.price} ден.
                </div>
              </div>
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 leading-tight">{item.name}</h3>
                <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded">
                  {item.category}
                </span>
              </div>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm line-clamp-2 mb-4">
                {item.description || 'Вкусно јадење подготвено со свежи состојки.'}
              </p>
              <button
                onClick={() => onAddItem(item)}
                className="w-full flex items-center justify-center gap-2 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl hover:bg-emerald-600 dark:hover:bg-emerald-500 transition-colors font-medium"
              >
                <Plus size={18} />
                Додај во нарачка
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default MenuList;
