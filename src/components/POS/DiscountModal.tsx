import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Percent, Tag, ShieldCheck, AlertCircle } from 'lucide-react';
import { Discount, Order } from '../../types';
import { discountService } from '../../services/discountService';
import { useStore } from '../../store/useStore';
import { toast } from 'sonner';

interface DiscountModalProps {
  order: Order;
  onClose: () => void;
  onApply: (discount: Discount | null) => void;
}

const DiscountModal: React.FC<DiscountModalProps> = ({ order, onClose, onApply }) => {
  const { user } = useStore();
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDiscounts = async () => {
      try {
        const data = await discountService.getAll();
        setDiscounts(data);
      } catch {
        toast.error('Грешка при вчитување на попусти');
      } finally {
        setLoading(false);
      }
    };
    fetchDiscounts();
  }, []);

  const isManager = user?.role === 'Admin' || user?.role === 'Manager';

  const handleSelect = (discount: Discount) => {
    if (discount.requiresManagerApproval && !isManager) {
      toast.error('Овој попуст бара одобрување од менаџер');
      return;
    }
    onApply(discount);
  };

  const handleRemove = () => {
    onApply(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b p-4">
          <h3 className="text-xl font-bold text-gray-800">Примени попуст</h3>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-gray-100">
            <X className="h-6 w-6 text-gray-500" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
              <p className="mt-2 text-gray-500">Се вчитуваат попусти...</p>
            </div>
          ) : discounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertCircle className="h-12 w-12 text-gray-300" />
              <p className="mt-2 text-gray-500 text-lg">Нема достапни попусти</p>
            </div>
          ) : (
            <div className="space-y-3">
              {discounts.map((discount) => (
                <button
                  key={discount.id}
                  onClick={() => handleSelect(discount)}
                  className={`flex w-full items-center justify-between rounded-xl border p-4 transition-all hover:border-primary hover:bg-primary/5 ${
                    order.discountId === discount.id ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                      {discount.type === 'percentage' ? <Percent className="h-5 w-5" /> : <Tag className="h-5 w-5" />}
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-gray-800">{discount.name}</p>
                      <p className="text-sm text-gray-500">
                        {discount.type === 'percentage' ? `${discount.value}%` : `${discount.value} ден.`}
                      </p>
                    </div>
                  </div>
                  {discount.requiresManagerApproval && (
                    <div className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-700">
                      <ShieldCheck className="h-3 w-3" />
                      МЕНАЏЕР
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="border-t p-4">
          {order.discountId && (
            <button
              onClick={handleRemove}
              className="mb-3 w-full rounded-xl border border-red-200 py-3 font-bold text-red-600 hover:bg-red-50"
            >
              Отстрани попуст
            </button>
          )}
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-gray-100 py-3 font-bold text-gray-700 hover:bg-gray-200"
          >
            Затвори
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default DiscountModal;
