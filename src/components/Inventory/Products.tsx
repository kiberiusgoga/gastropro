import React, { useState, useEffect } from 'react';
import { Product } from '../../types';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Package,
  AlertTriangle,
  CheckCircle2,
  X,
  Info
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { cn } from '../../utils/cn';
import { productService } from '../../services/productService';
import { CostOrMargin } from '../UI/CostOrMargin';

const Products = () => {
  const { products, categories, fetchProducts, fetchCategories } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    if (!products.length) fetchProducts();
    if (!categories.length) fetchCategories();
  }, [products.length, categories.length, fetchProducts, fetchCategories]);

  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    unit: 'pcs' as 'pcs' | 'kg' | 'l' | 'box',
    purchasePrice: 0,
    sellingPrice: 0,
    categoryId: '',
    preparationStation: 'kitchen' as 'grill' | 'salad' | 'bar' | 'kitchen' | 'dessert',
    minStock: 5,
    currentStock: 0,
    defaultExpiryDays: null as number | null,
  });

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        barcode: product.barcode,
        unit: product.unit,
        purchasePrice: product.purchasePrice,
        sellingPrice: product.sellingPrice,
        categoryId: product.categoryId,
        preparationStation: product.preparationStation || 'kitchen',
        minStock: product.minStock,
        currentStock: product.currentStock,
        defaultExpiryDays: product.defaultExpiryDays ?? null,
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: '',
        barcode: '',
        unit: 'pcs',
        purchasePrice: 0,
        sellingPrice: 0,
        categoryId: categories[0]?.id || '',
        preparationStation: 'kitchen',
        minStock: 5,
        currentStock: 0,
        defaultExpiryDays: null,
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        await productService.update(editingProduct.id, formData);
        toast.success(t('success_update'));
      } else {
        await productService.create(formData);
        toast.success(t('success_add'));
      }
      setIsModalOpen(false);
      fetchProducts();
    } catch {
      toast.error(t('error'));
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm(t('confirm_delete'))) {
      try {
        await productService.delete(id);
        toast.success(t('success_delete'));
        fetchProducts();
      } catch {
        toast.error(t('error'));
      }
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.barcode.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || p.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-serif italic text-cream tracking-tight">{t('products')}</h2>
          <p className="text-cream-muted font-medium">{products.length} {t('total_products')}</p>
        </div>
        <button onClick={() => handleOpenModal()} className="btn btn-primary">
          <Plus size={20} />
          {t('add_product')}
        </button>
      </div>

      <div className="card p-4 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-cream-faint" size={18} />
          <input
            type="text"
            className="input pl-10"
            placeholder={t('search')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="text-cream-faint" size={18} />
          <select
            className="input min-w-[150px]"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="all">{t('all_categories')}</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse">
            <thead>
              <tr className="bg-surface-2 border-b border-warm-line">
                <th className="table-header">{t('name')}</th>
                <th className="table-header">{t('barcode')}</th>
                <th className="table-header">{t('category')}</th>
                <th className="table-header">{t('cost_or_margin')}</th>
                <th className="table-header">{t('selling_price')}</th>
                <th className="table-header">{t('current_stock')}</th>
                <th className="table-header text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-line">
              {filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-surface-2/50 transition-colors">
                  <td className="table-cell">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-accent/10 text-accent-light flex items-center justify-center">
                        <Package size={16} />
                      </div>
                      <span className="font-bold text-cream">{product.name}</span>
                    </div>
                  </td>
                  <td className="table-cell">
                    <span className="font-mono text-xs bg-surface-2 px-2 py-1 rounded text-cream-faint">
                      {product.barcode || '-'}
                    </span>
                  </td>
                  <td className="table-cell text-cream-muted">
                    {categories.find(c => c.id === product.categoryId)?.name || '-'}
                  </td>
                  <td className="table-cell">
                    <CostOrMargin
                      purchaseCost={product.purchaseCost ?? product.purchasePrice}
                      marginPercent={product.marginPercent}
                      productType={product.productType}
                    />
                  </td>
                  <td className="table-cell font-bold text-accent-light">{product.sellingPrice.toLocaleString()} ден.</td>
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "font-bold",
                        product.currentStock <= product.minStock ? "text-rose-400" : "text-emerald-400"
                      )}>
                        {product.currentStock} {product.unit}
                      </span>
                      {product.currentStock <= product.minStock && (
                        <AlertTriangle size={14} className="text-rose-400" />
                      )}
                    </div>
                  </td>
                  <td className="table-cell text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpenModal(product)}
                        className="p-2 text-cream-faint hover:text-accent-light hover:bg-accent/10 rounded-lg transition-all"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="p-2 text-cream-faint hover:text-rose-400 hover:bg-rose-900/20 rounded-lg transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredProducts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-cream-faint">
            <Package size={64} className="mb-4 opacity-10" />
            <p className="text-lg font-medium">{t('no_products_found')}</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-base/80 backdrop-blur-sm">
          <div className="bg-surface border border-warm-line w-full max-w-2xl rounded-2xl shadow-card-lg overflow-hidden">
            <div className="px-8 py-6 border-b border-warm-line flex items-center justify-between bg-surface-2/50">
              <h3 className="text-xl font-serif italic text-cream">
                {editingProduct ? t('edit_product') : t('add_product')}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-cream-faint hover:bg-surface-2 hover:text-cream rounded-full transition-all"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-cream-muted mb-2">{t('name')}</label>
                    <input
                      type="text"
                      className="input"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-cream-muted mb-2">{t('barcode')}</label>
                    <input
                      type="text"
                      className="input"
                      value={formData.barcode}
                      onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-cream-muted mb-2">{t('category')}</label>
                    <select
                      className="input"
                      value={formData.categoryId}
                      onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                      required
                    >
                      <option value="">{t('select_category')}</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-cream-muted mb-2">Preparation Station</label>
                    <select
                      className="input"
                      value={formData.preparationStation}
                      onChange={(e) => setFormData({ ...formData, preparationStation: e.target.value as 'grill' | 'salad' | 'bar' | 'kitchen' | 'dessert' })}
                    >
                      <option value="kitchen">Kitchen</option>
                      <option value="grill">Grill</option>
                      <option value="salad">Salad</option>
                      <option value="bar">Bar</option>
                      <option value="dessert">Dessert</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-cream-muted mb-2">{t('unit')}</label>
                    <select
                      className="input"
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value as 'pcs' | 'kg' | 'l' | 'box' })}
                    >
                      <option value="pcs">pcs</option>
                      <option value="kg">kg</option>
                      <option value="l">l</option>
                      <option value="box">box</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-cream-muted mb-2">{t('purchase_price')}</label>
                    <input
                      type="number"
                      className="input"
                      step="0.01"
                      min="0.01"
                      placeholder={t('purchase_price_placeholder')}
                      value={formData.purchasePrice || ''}
                      onChange={(e) => setFormData({ ...formData, purchasePrice: Number(e.target.value) })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-cream-muted mb-2">{t('selling_price')}</label>
                    <input
                      type="number"
                      className="input"
                      value={formData.sellingPrice}
                      onChange={(e) => setFormData({ ...formData, sellingPrice: Number(e.target.value) })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-cream-muted mb-2">{t('min_stock')}</label>
                    <input
                      type="number"
                      className="input"
                      value={formData.minStock}
                      onChange={(e) => setFormData({ ...formData, minStock: Number(e.target.value) })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-cream-muted mb-2">{t('current_stock')}</label>
                    <input
                      type="number"
                      className="input"
                      value={formData.currentStock}
                      onChange={(e) => setFormData({ ...formData, currentStock: Number(e.target.value) })}
                      disabled={!!editingProduct}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-cream-muted mb-2">{t('default_expiry_days_label')}</label>
                    <input
                      type="number"
                      className="input"
                      min="1"
                      max="3650"
                      placeholder={t('default_expiry_days_placeholder')}
                      value={formData.defaultExpiryDays ?? ''}
                      onChange={(e) => setFormData({ ...formData, defaultExpiryDays: e.target.value ? Number(e.target.value) : null })}
                    />
                    <p className="text-xs text-cream-faint mt-1">{t('default_expiry_days_help')}</p>
                  </div>
                </div>
              </div>
              {!editingProduct && formData.currentStock > 0 && (
                <div className="mt-4 bg-accent/10 border border-accent/30 rounded-btn px-4 py-3 flex items-start gap-3">
                  <Info size={16} className="text-accent-light shrink-0 mt-0.5" />
                  <p className="text-sm text-accent-light">{t('initial_inventory_banner')}</p>
                </div>
              )}
              <div className="mt-10 flex items-center justify-end gap-3">
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

export default Products;
