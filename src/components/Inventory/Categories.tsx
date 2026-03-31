import React, { useState, useEffect } from 'react';
import { Category } from '../../types';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, X, CheckCircle2, Layers } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { categoryService } from '../../services/productService';

const Categories = () => {
  const { categories, fetchCategories } = useStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const { t } = useTranslation();

  useEffect(() => {
    if (!categories.length) fetchCategories();
  }, [categories.length, fetchCategories]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCategory) {
        await categoryService.update(editingCategory.id, { name });
        toast.success(t('success_update'));
      } else {
        await categoryService.create({ name });
        toast.success(t('success_add'));
      }
      setIsModalOpen(false);
      setName('');
      setEditingCategory(null);
      fetchCategories();
    } catch {
      toast.error(t('error'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('confirm_delete'))) return;
    try {
      await categoryService.delete(id);
      toast.success(t('success_delete'));
      fetchCategories();
    } catch {
      toast.error(t('error'));
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">{t('categories')}</h2>
          <p className="text-slate-500 font-medium">{t('manage_product_categories')}</p>
        </div>
        <button onClick={() => { setEditingCategory(null); setName(''); setIsModalOpen(true); }} className="btn btn-primary">
          <Plus size={20} />
          {t('add_category')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map((cat) => (
          <div key={cat.id} className="card p-6 flex items-center justify-between hover:shadow-lg transition-all group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Layers size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">{cat.name}</h3>
            </div>
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => { setEditingCategory(cat); setName(cat.name); setIsModalOpen(true); }}
                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
              >
                <Edit2 size={18} />
              </button>
              <button 
                onClick={() => handleDelete(cat.id)}
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-900">{editingCategory ? t('edit_category') : t('add_category')}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-white hover:text-slate-900 rounded-full transition-all shadow-sm">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div>
                <label className="label">{t('category_name')}</label>
                <input 
                  type="text" 
                  className="input" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="pt-4 flex items-center justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
                  {t('cancel')}
                </button>
                <button type="submit" className="btn btn-primary px-8">
                  <CheckCircle2 size={20} />
                  {t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Categories;
