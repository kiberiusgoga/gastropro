import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Search, 
  LayoutGrid, 
  Image as ImageIcon,
  X
} from 'lucide-react';
import { menuService } from '../../services/menuService';
import { bundleService } from '../../services/inventoryService';
import { MenuItem, MenuCategory, Bundle } from '../../types';
import { toast } from 'sonner';

const MenuManagement: React.FC = () => {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  // Form state
  const [formData, setFormData] = useState<Partial<MenuItem>>({
    name: '',
    description: '',
    price: 0,
    menuCategoryId: '',
    bundleId: '',
    active: true
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [menuItems, menuCats, invBundles] = await Promise.all([
        menuService.getItems(),
        menuService.getCategories(),
        bundleService.getAll()
      ]);
      setItems(menuItems);
      setCategories(menuCats);
      setBundles(invBundles);
    } catch {
      toast.error('Грешка при вчитување на податоци');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveItem = async () => {
    try {
      if (editingItem) {
        await menuService.updateItem(editingItem.id, formData);
        toast.success('Производот е ажуриран');
      } else {
        await menuService.createItem(formData);
        toast.success('Производот е додаден');
      }
      setShowItemModal(false);
      loadData();
    } catch {
      toast.error('Грешка при зачувување');
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!window.confirm('Дали сте сигурни?')) return;
    try {
      await menuService.deleteItem(id);
      toast.success('Производот е избришан');
      loadData();
    } catch {
      toast.error('Грешка при бришење');
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.menuCategoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Мени Менаџмент</h1>
          <p className="text-gray-500">Управувајте со производите и категориите во вашето мени</p>
        </div>
        <button
          onClick={() => {
            setEditingItem(null);
            setFormData({ name: '', description: '', price: 0, menuCategoryId: '', bundleId: '', active: true });
            setShowItemModal(true);
          }}
          className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
        >
          <Plus className="w-5 h-5 mr-2" />
          Додај Производ
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Пребарај производи..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary"
        >
          <option value="all">Сите Категории</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredItems.map(item => (
          <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden group">
            <div className="aspect-video bg-gray-100 relative">
              {item.imageUrl ? (
                <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <ImageIcon className="w-12 h-12" />
                </div>
              )}
              <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => {
                    setEditingItem(item);
                    setFormData(item);
                    setShowItemModal(true);
                  }}
                  className="p-2 bg-white rounded-full shadow-lg text-blue-600 hover:bg-blue-50"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteItem(item.id)}
                  className="p-2 bg-white rounded-full shadow-lg text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-4">
              <div className="flex justify-between items-start mb-1">
                <h3 className="font-bold text-gray-900">{item.name}</h3>
                <span className="text-primary font-bold">{item.price} ден.</span>
              </div>
              <p className="text-sm text-gray-500 line-clamp-2 mb-3">{item.description || 'Нема опис'}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs px-2 py-1 bg-gray-100 rounded-full text-gray-600">
                  {categories.find(c => c.id === item.menuCategoryId)?.name || 'Нема категорија'}
                </span>
                {item.bundleId && (
                  <span className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-full flex items-center">
                    <LayoutGrid className="w-3 h-3 mr-1" />
                    Норматив
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Item Modal */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">{editingItem ? 'Уреди Производ' : 'Нов Производ'}</h2>
              <button onClick={() => setShowItemModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Име на производ</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Категорија</label>
                  <select
                    value={formData.menuCategoryId}
                    onChange={(e) => setFormData({ ...formData, menuCategoryId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Избери категорија</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Цена (ден.)</label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Норматив (Inventory Bundle)</label>
                  <select
                    value={formData.bundleId}
                    onChange={(e) => setFormData({ ...formData, bundleId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Без норматив</option>
                    {bundles.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Поврзете со норматив за автоматско одземање на состојки.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Опис</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="active"
                    checked={formData.active}
                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                    className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                  />
                  <label htmlFor="active" className="ml-2 text-sm font-medium text-gray-700">Активен во мени</label>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8 pt-6 border-t border-gray-100">
              <button
                onClick={() => setShowItemModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Откажи
              </button>
              <button
                onClick={handleSaveItem}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
              >
                Зачувај
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MenuManagement;
