import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, AlertCircle } from 'lucide-react';
import { Staff, StaffPermissions } from '../types';

interface StaffAuthProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (staff: Staff) => void;
  staff: Staff[];
  requiredPermission?: keyof StaffPermissions;
  title?: string;
}

const StaffAuth: React.FC<StaffAuthProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  staff, 
  requiredPermission,
  title = "Менаџерски пристап"
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const handlePinClick = (num: string) => {
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      if (newPin.length === 4) {
        const authorizedStaff = staff.find(s => s.pin === newPin);
        
        if (authorizedStaff) {
          if (!requiredPermission || authorizedStaff.permissions[requiredPermission]) {
            onSuccess(authorizedStaff);
            setPin('');
            setError(false);
          } else {
            // Staff exists but doesn't have permission
            setError(true);
            setTimeout(() => {
              setPin('');
              setError(false);
            }, 500);
          }
        } else {
          // PIN not found
          setError(true);
          setTimeout(() => {
            setPin('');
            setError(false);
          }, 500);
        }
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-zinc-950/60 backdrop-blur-md"
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative bg-white dark:bg-zinc-900 w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden p-8"
          >
            <div className="flex flex-col items-center text-center mb-8">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-colors ${
                error ? 'bg-red-50 dark:bg-red-900/20 text-red-500' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600'
              }`}>
                {error ? <AlertCircle size={32} /> : <ShieldCheck size={32} />}
              </div>
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{title}</h2>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">Внесете ја вашата 4-цифрена шифра</p>
            </div>

            <div className="flex justify-center gap-4 mb-10">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                    pin.length > i 
                      ? (error ? 'bg-red-500 border-red-500 scale-110' : 'bg-emerald-500 border-emerald-500 scale-110') 
                      : 'border-zinc-200 dark:border-zinc-700 bg-transparent'
                  }`}
                />
              ))}
            </div>

            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handlePinClick(num.toString())}
                  className="h-16 rounded-2xl bg-zinc-50 dark:bg-zinc-800 text-xl font-bold text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-700 active:scale-95 transition-all"
                >
                  {num}
                </button>
              ))}
              <div />
              <button
                key="0"
                type="button"
                onClick={() => handlePinClick('0')}
                className="h-16 rounded-2xl bg-zinc-50 dark:bg-zinc-800 text-xl font-bold text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-700 active:scale-95 transition-all"
              >
                0
              </button>
              <button
                key="C"
                type="button"
                onClick={() => setPin('')}
                className="h-16 rounded-2xl text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 font-bold transition-colors"
              >
                C
              </button>
            </div>

            <button
              onClick={onClose}
              className="mt-8 w-full py-3 text-zinc-400 font-bold hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              Откажи
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default StaffAuth;
