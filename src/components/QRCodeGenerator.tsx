import React from 'react';
import { Table } from '../types';
import { QrCode, X, Download, Printer } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface QRCodeGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  table: Table | null;
}

const QRCodeGenerator: React.FC<QRCodeGeneratorProps> = ({ isOpen, onClose, table }) => {
  if (!table) return null;

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
            className="relative bg-white dark:bg-zinc-900 w-full max-w-sm rounded-[3rem] shadow-2xl overflow-hidden p-10 text-center"
          >
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-100">QR Код за Маса {table.number}</h2>
              <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-zinc-500">
                <X size={20} />
              </button>
            </div>

            <div className="p-8 bg-zinc-50 dark:bg-zinc-800/50 rounded-[2.5rem] border-2 border-dashed border-zinc-200 dark:border-zinc-700 mb-8 flex flex-col items-center">
              <div className="w-48 h-48 bg-white dark:bg-zinc-800 p-4 rounded-3xl shadow-inner flex items-center justify-center">
                <QrCode size={120} className="text-zinc-900 dark:text-zinc-100" />
              </div>
              <p className="mt-6 text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                Скенирај за дигитално мени
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button className="flex items-center justify-center gap-2 py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-2xl font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
                <Download size={18} />
                Преземи
              </button>
              <button className="flex items-center justify-center gap-2 py-4 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-2xl font-bold hover:bg-emerald-600 dark:hover:bg-emerald-500 transition-colors">
                <Printer size={18} />
                Печати
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default QRCodeGenerator;
