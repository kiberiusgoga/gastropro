import React, { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRightLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '../../lib/apiClient';
import { ProductCombobox } from './ProductCombobox';

interface Warehouse {
  id: string;
  name: string;
  is_main: boolean;
}

interface Product {
  id: string;
  name: string;
  unit: string;
}

interface TransferFormProps {
  warehouses: Warehouse[];
  products: Product[];
  onSuccess: () => void;
}

const inputCls = 'w-full px-4 py-2.5 bg-warm-input border border-warm-line rounded-btn text-sm text-cream focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/50 transition-all placeholder:text-cream-faint';
const labelCls = 'block text-xs font-black text-cream-faint uppercase tracking-widest mb-2';

export const TransferForm: React.FC<TransferFormProps> = ({ warehouses, products, onSuccess }) => {
  const { t } = useTranslation();

  const [sourceId, setSourceId] = useState('');
  const [destId, setDestId] = useState('');
  const [productId, setProductId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sourceEqDest = Boolean(sourceId && destId && sourceId === destId);
  const isValid = sourceId && destId && productId && quantity && parseFloat(quantity) > 0 && !sourceEqDest;

  const reset = () => {
    setSourceId('');
    setDestId('');
    setProductId(null);
    setQuantity('');
    setNote('');
    setError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await apiClient.post('/transfers', {
        source_warehouse_id: sourceId,
        destination_warehouse_id: destId,
        product_id: productId,
        quantity: parseFloat(quantity),
        note: note.trim() || undefined,
      });
      reset();
      toast.success(t('transfer_created'));
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || t('transfer_failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-surface border border-warm-line rounded-card p-6 mb-6">
      <h2 className="font-serif italic text-xl text-cream mb-6">{t('new_transfer')}</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Source warehouse */}
        <div>
          <label className={labelCls}>{t('source_warehouse')}</label>
          <select
            value={sourceId}
            onChange={(e) => { setSourceId(e.target.value); setError(null); }}
            className={inputCls}
            required
          >
            <option value="">— {t('select_source')} —</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>

        {/* Destination warehouse */}
        <div>
          <label className={labelCls}>{t('destination_warehouse')}</label>
          <select
            value={destId}
            onChange={(e) => { setDestId(e.target.value); setError(null); }}
            className={`${inputCls} ${sourceEqDest ? 'border-rose-500 focus:border-rose-500' : ''}`}
            required
          >
            <option value="">— {t('select_destination')} —</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
          {sourceEqDest && (
            <p className="text-rose-300 text-xs mt-1">{t('source_dest_must_differ')}</p>
          )}
        </div>

        {/* Product combobox */}
        <div>
          <label className={labelCls}>{t('product')}</label>
          <ProductCombobox
            products={products}
            value={productId}
            onChange={setProductId}
            placeholder={t('search_product_placeholder')}
          />
        </div>

        {/* Quantity */}
        <div>
          <label className={labelCls}>{t('quantity')}</label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            min="0.001"
            step="0.001"
            placeholder="0.000"
            className={inputCls}
            required
          />
        </div>
      </div>

      {/* Note full-width */}
      <div className="mb-6">
        <label className={labelCls}>{t('note_optional')}</label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          placeholder={t('transfer_note_placeholder')}
          className={inputCls}
        />
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-btn px-4 py-3 mb-4 text-rose-300 text-sm">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={reset}
          className="px-4 py-2.5 border border-warm-line text-cream-muted rounded-btn text-xs font-black uppercase tracking-widest hover:bg-surface-2 hover:text-cream transition-all"
        >
          {t('clear')}
        </button>
        <button
          type="submit"
          disabled={!isValid || isSubmitting}
          className="px-6 py-2.5 bg-accent hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed text-[#faf5ee] rounded-btn font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95"
        >
          {isSubmitting ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              {t('creating')}...
            </>
          ) : (
            <>
              <ArrowRightLeft size={15} />
              {t('create_transfer')}
            </>
          )}
        </button>
      </div>
    </form>
  );
};

export default TransferForm;
