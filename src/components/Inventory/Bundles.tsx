import React, { useState, useEffect } from 'react';
import { Bundle } from '../../types';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { 
  Plus, 
  Layers, 
  Trash2, 
  Edit2, 
  CheckCircle2, 
  X, 
  Settings2,
  ListChecks
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { bundleService } from '../../services/inventoryService';

const Bundles = () => {
  const { bundles, products, loading, fetchBundles, fetchProducts } = useStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBundle, setEditingBundle] = useState<Bundle | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    if (!bundles.length) fetchBundles();
    if (!products.length) fetchProducts();
  }, [bundles.length, products.length, fetchBundles, fetchProducts]);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    sellingPrice: 0,
  });
  const [items, setItems] = useState<{ productId: string, quantity: number }[]>([]);

  const handleAddItem = () => {
    setItems([...items, { productId: '', quantity: 1 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof typeof items[0], value: string | number) => {
    const newItems = [...items];
    if (field === 'productId') {
      newItems[index].productId = value as string;
    } else if (field === 'quantity') {
      newItems[index].quantity = value as number;
    }
    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      toast.error(t('add_at_least_one_item'));
      return;
    }

    try {
      if (editingBundle) {
        await bundleService.update(editingBundle.id, {
          ...formData,
          items
        });
        toast.success(t('success_update'));
      } else {
        await bundleService.create({
          ...formData,
          items
        });
        toast.success(t('success_add'));
      }
      setIsModalOpen(false);
      setItems([]);
      setFormData({ name: '', sellingPrice: 0 });
      setEditingBundle(null);
      fetchBundles();
    } catch {
      toast.error(t('error'));
    }
  };

  const handleEdit = (bundle: Bundle) => {
    setEditingBundle(bundle);
    setFormData({
      name: bundle.name,
      sellingPrice: bundle.sellingPrice
    });
    // Map items from bundle to the format expected by the form
    if (bundle.items) {
      setItems(bundle.items.map(item => ({
        productId: item.product_id,
        quantity: item.quantity
      })));
    } else {
      setItems([]);
    }
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('confirm_delete'))) return;
    try {
      await bundleService.delete(id);
      toast.success(t('success_delete'));
      fetchBundles();
    } catch {
      toast.error(t('error'));
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">{t('bundles')}</h2>
          <p className="text-slate-500 font-medium">{t('normatives_and_recipes')}</p>
        </div>
        <button onClick={() => { setEditingBundle(null); setIsModalOpen(true); }} className="btn btn-primary">
          <Plus size={20} />
          {t('new_bundle')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {bundles.map((bundle) => (
          <div key={bundle.id} className="card p-6 flex flex-col gap-4 hover:shadow-lg transition-all group">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Layers size={24} />
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleEdit(bundle)}
                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                >
                  <Edit2 size={18} />
                </button>
                <button 
                  onClick={() => handleDelete(bundle.id)}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">{bundle.name}</h3>
              <p className="text-2xl font-black text-indigo-600">{bundle.sellingPrice.toLocaleString()} ден.</p>
            </div>
            <div className="pt-4 border-t border-slate-100">
              <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-3 flex items-center gap-2">
                <ListChecks size={14} />
                {t('components')}
              </p>
              <div className="space-y-2">
                {bundle.items && bundle.items.length > 0 ? (
                  bundle.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm text-slate-600">
                      <span>{item.product_name}</span>
                      <span className="font-mono font-bold">{item.quantity} {item.unit}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 italic">{t('no_items')}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {bundles.length === 0 && !loading.bundles && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Layers size={64} className="mb-4 opacity-10" />
          <p className="text-lg font-medium">{t('no_bundles_found')}</p>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
              <h3 className="text-xl font-bold text-slate-900">{editingBundle ? t('edit_bundle') : t('new_bundle')}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-white hover:text-slate-900 rounded-full transition-all shadow-sm">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                <div>
                  <label className="label">{t('bundle_name')}</label>
                  <input 
                    type="text" 
                    className="input" 
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                    placeholder="пр. Пица Капричиоза"
                  />
                </div>
                <div>
                  <label className="label">{t('selling_price')}</label>
                  <input 
                    type="number" 
                    className="input" 
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({...formData, sellingPrice: Number(e.target.value)})}
                    required
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Settings2 size={20} className="text-indigo-600" />
                    {t('normative_components')}
                  </h4>
                  <button type="button" onClick={handleAddItem} className="btn btn-secondary py-1.5 text-sm">
                    <Plus size={16} />
                    {t('add_component')}
                  </button>
                </div>

                <div className="space-y-3">
                  {items.map((item, index) => (
                    <div key={index} className="flex flex-col md:flex-row items-end gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex-1 w-full">
                        <label className="label text-xs">{t('product')}</label>
                        <select 
                          className="input"
                          value={item.productId}
                          onChange={(e) => handleItemChange(index, 'productId', e.target.value)}
                          required
                        >
                          <option value="">{t('select_product')}</option>
                          {products.map(p => (
                            <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
                          ))}
                        </select>
                      </div>
                      <div className="w-full md:w-40">
                        <label className="label text-xs">{t('quantity')}</label>
                        <div className="relative">
                          <input 
                            type="number" 
                            className="input pr-12" 
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, 'quantity', Number(e.target.value))}
                            required
                            min="0.001"
                            step="0.001"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 uppercase">
                            {products.find(p => p.id === item.productId)?.unit || ''}
                          </span>
                        </div>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => handleRemoveItem(index)}
                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  ))}

                  {items.length === 0 && (
                    <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400">
                      <p>{t('no_components_added')}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-10 flex items-center justify-end gap-3 pt-6 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
                  {t('cancel')}
                </button>
                <button type="submit" className="btn btn-primary px-10 py-4 text-lg">
                  <CheckCircle2 size={24} />
                  {t('save_bundle')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Bundles;
