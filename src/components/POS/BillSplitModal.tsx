import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Users, List, Calculator, CreditCard, Banknote, CheckCircle2 } from 'lucide-react';
import { Order, SplitPayment } from '../../types';
import { posService } from '../../services/posService';
import { toast } from 'sonner';

interface BillSplitModalProps {
  order: Order;
  onClose: () => void;
  onUpdate: () => void;
}

type SplitMode = 'even' | 'item' | 'guest';

const BillSplitModal: React.FC<BillSplitModalProps> = ({ order, onClose, onUpdate }) => {
  const [mode, setMode] = useState<SplitMode>('even');
  const [guestCount, setGuestCount] = useState(order.guestCount || 2);
  const [splitPayments, setSplitPayments] = useState<SplitPayment[]>(order.splitPayments || []);
  const [guestAssignments, setGuestAssignments] = useState<Record<string, number>>(order.guestAssignments || {});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (mode === 'even') {
      const amountPerGuest = order.totalAmount / guestCount;
      const newSplits: SplitPayment[] = Array.from({ length: guestCount }, (_, i) => ({
        id: `even-${i + 1}`,
        guestIndex: i + 1,
        amount: amountPerGuest,
        status: 'pending',
        method: 'cash'
      }));
      setSplitPayments(newSplits);
    } else if (mode === 'item' || mode === 'guest') {
      // Calculate totals based on assignments
      const guestTotals: Record<number, number> = {};
      order.items.forEach(item => {
        const guestIdx = guestAssignments[item.id] || 1;
        guestTotals[guestIdx] = (guestTotals[guestIdx] || 0) + (item.price * item.quantity);
      });

      const maxGuestIdx = Math.max(...Object.values(guestAssignments), guestCount);
      const newSplits: SplitPayment[] = Array.from({ length: maxGuestIdx }, (_, i) => ({
        id: `guest-${i + 1}`,
        guestIndex: i + 1,
        amount: guestTotals[i + 1] || 0,
        status: 'pending',
        method: 'cash'
      }));
      setSplitPayments(newSplits);
    }
  }, [mode, guestCount, guestAssignments, order.totalAmount, order.items]);

  const handleSaveSplit = async () => {
    setIsSaving(true);
    try {
      await posService.updateOrder(order.id, {
        isSplit: true,
        guestCount,
        guestAssignments,
        splitPayments
      });

      if (allPaid) {
        // Convert split payments to regular payments for closing
        const payments = splitPayments.map(s => ({
          orderId: order.id,
          amount: s.amount,
          method: s.method,
          timestamp: s.timestamp || new Date().toISOString()
        }));
        await posService.closeOrder(order.id, payments);
        toast.success('Нарачката е успешно затворена');
      } else {
        toast.success('Поделбата е зачувана');
      }
      
      onUpdate();
      onClose();
    } catch {
      toast.error('Грешка при зачувување');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAssignItem = (itemId: string, guestIdx: number) => {
    setGuestAssignments(prev => ({
      ...prev,
      [itemId]: guestIdx
    }));
  };

  const handlePaymentStatus = (splitId: string, status: 'paid' | 'pending', method: 'cash' | 'card') => {
    setSplitPayments(prev => prev.map(s => 
      s.id === splitId ? { ...s, status, method, timestamp: status === 'paid' ? new Date().toISOString() : undefined } : s
    ));
  };

  const allPaid = splitPayments.length > 0 && splitPayments.every(s => s.status === 'paid');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white dark:bg-zinc-900 w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-6 border-bottom border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Подели сметка</h2>
            <p className="text-zinc-500 text-sm">Нарачка #{order.id.slice(-6).toUpperCase()}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-zinc-500" />
          </button>
        </div>

        {/* Mode Selector */}
        <div className="p-6 grid grid-cols-3 gap-4">
          <button
            onClick={() => setMode('even')}
            className={`flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all ${
              mode === 'even'
                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                : 'border-zinc-100 dark:border-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700'
            }`}
          >
            <Calculator className="w-6 h-6" />
            <span className="font-medium">Еднакво</span>
          </button>
          <button
            onClick={() => setMode('item')}
            className={`flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all ${
              mode === 'item'
                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                : 'border-zinc-100 dark:border-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700'
            }`}
          >
            <List className="w-6 h-6" />
            <span className="font-medium">По ставка</span>
          </button>
          <button
            onClick={() => setMode('guest')}
            className={`flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all ${
              mode === 'guest'
                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                : 'border-zinc-100 dark:border-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700'
            }`}
          >
            <Users className="w-6 h-6" />
            <span className="font-medium">По гости</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {mode === 'even' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50 p-6 rounded-3xl">
                <span className="text-lg font-medium">Број на гости</span>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setGuestCount(Math.max(2, guestCount - 1))}
                    className="w-10 h-10 rounded-full border border-zinc-200 dark:border-zinc-700 flex items-center justify-center hover:bg-white dark:hover:bg-zinc-800"
                  >
                    -
                  </button>
                  <span className="text-2xl font-bold w-8 text-center">{guestCount}</span>
                  <button
                    onClick={() => setGuestCount(guestCount + 1)}
                    className="w-10 h-10 rounded-full border border-zinc-200 dark:border-zinc-700 flex items-center justify-center hover:bg-white dark:hover:bg-zinc-800"
                  >
                    +
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {splitPayments.map((split) => (
                  <div key={split.id} className="p-4 border border-zinc-100 dark:border-zinc-800 rounded-2xl flex justify-between items-center">
                    <div>
                      <p className="text-sm text-zinc-500">Гост {split.guestIndex}</p>
                      <p className="text-lg font-bold">{split.amount.toLocaleString()} ден.</p>
                    </div>
                    <div className="flex gap-2">
                      {split.status === 'paid' ? (
                        <span className="flex items-center gap-1 text-emerald-500 font-medium">
                          <CheckCircle2 className="w-5 h-5" /> Платено
                        </span>
                      ) : (
                        <>
                          <button
                            onClick={() => handlePaymentStatus(split.id, 'paid', 'cash')}
                            className="p-2 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-xl text-emerald-600 transition-colors"
                            title="Готовина"
                          >
                            <Banknote className="w-6 h-6" />
                          </button>
                          <button
                            onClick={() => handlePaymentStatus(split.id, 'paid', 'card')}
                            className="p-2 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-xl text-blue-600 transition-colors"
                            title="Картичка"
                          >
                            <CreditCard className="w-6 h-6" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(mode === 'item' || mode === 'guest') && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Items List */}
              <div className="space-y-4">
                <h3 className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <List className="w-5 h-5" /> Ставки
                </h3>
                <div className="space-y-2">
                  {order.items.map(item => (
                    <div key={item.id} className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-zinc-500">{item.quantity} x {item.price} ден.</p>
                        </div>
                        <p className="font-bold">{(item.price * item.quantity).toLocaleString()} ден.</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {Array.from({ length: guestCount }).map((_, i) => (
                          <button
                            key={i}
                            onClick={() => handleAssignItem(item.id, i + 1)}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                              (guestAssignments[item.id] || 1) === i + 1
                                ? 'bg-emerald-500 text-white'
                                : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-300'
                            }`}
                          >
                            Гост {i + 1}
                          </button>
                        ))}
                        <button
                          onClick={() => setGuestCount(prev => prev + 1)}
                          className="px-3 py-1 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200"
                        >
                          + Додај гост
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Guest Totals & Payments */}
              <div className="space-y-4">
                <h3 className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <Calculator className="w-5 h-5" /> Преглед по гости
                </h3>
                <div className="space-y-3">
                  {splitPayments.map(split => (
                    <div key={split.id} className="p-4 border border-zinc-100 dark:border-zinc-800 rounded-2xl flex justify-between items-center">
                      <div>
                        <p className="text-sm text-zinc-500">Гост {split.guestIndex}</p>
                        <p className="text-lg font-bold">{split.amount.toLocaleString()} ден.</p>
                      </div>
                      <div className="flex gap-2">
                        {split.status === 'paid' ? (
                          <span className="flex items-center gap-1 text-emerald-500 font-medium">
                            <CheckCircle2 className="w-5 h-5" /> Платено
                          </span>
                        ) : (
                          <>
                            <button
                              onClick={() => handlePaymentStatus(split.id, 'paid', 'cash')}
                              className="p-2 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-xl text-emerald-600 transition-colors"
                            >
                              <Banknote className="w-6 h-6" />
                            </button>
                            <button
                              onClick={() => handlePaymentStatus(split.id, 'paid', 'card')}
                              className="p-2 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-xl text-blue-600 transition-colors"
                            >
                              <CreditCard className="w-6 h-6" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-zinc-100 dark:border-zinc-800 flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 py-4 rounded-2xl border border-zinc-200 dark:border-zinc-700 font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            Откажи
          </button>
          <button
            onClick={handleSaveSplit}
            disabled={isSaving}
            className={`flex-1 py-4 rounded-2xl font-bold transition-all ${
              allPaid
                ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/30'
                : 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-90'
            }`}
          >
            {isSaving ? 'Се зачувува...' : allPaid ? 'Затвори нарачка' : 'Зачувај поделба'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default BillSplitModal;
