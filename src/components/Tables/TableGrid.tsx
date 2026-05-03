import React from 'react';
import { motion } from 'motion/react';
import { Table } from '../../types';
import { Users, CheckCircle2, Clock, AlertCircle, QrCode } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface TableGridProps {
  tables: Table[];
  onTableClick: (table: Table) => void;
  onShowQRCode: (table: Table) => void;
  onSeed?: () => void;
  isAdmin?: boolean;
}

const TableGrid: React.FC<TableGridProps> = ({ tables, onTableClick, onShowQRCode, onSeed, isAdmin }) => {
  const { t } = useTranslation();

  if (tables.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-sm">
        <Users size={48} className="text-zinc-200 dark:text-zinc-800 mb-4" />
        <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">Нема пронајдено маси</h3>
        <p className="text-zinc-500 dark:text-zinc-400 mb-8 text-center max-w-md">
          Вашиот ресторан сè уште нема конфигурирано маси. 
          {isAdmin && ' Како администратор, можете да ги генерирате почетните маси.'}
        </p>
        {isAdmin && onSeed && (
          <button
            onClick={onSeed}
            className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-900/20 flex items-center gap-2"
          >
            <CheckCircle2 size={20} />
            Генерирај почетни маси
          </button>
        )}
      </div>
    );
  }

  const getStatusColor = (status: Table['status']) => {
    switch (status) {
      case 'free': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'occupied': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'reserved': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      default: return 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20';
    }
  };

  const getStatusIcon = (status: Table['status']) => {
    switch (status) {
      case 'free': return <CheckCircle2 size={16} />;
      case 'occupied': return <Clock size={16} />;
      case 'reserved': return <AlertCircle size={16} />;
    }
  };

  const getStatusLabel = (status: Table['status']) => {
    switch (status) {
      case 'free': return t('free');
      case 'occupied': return t('occupied');
      case 'reserved': return t('reserved');
    }
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
      {tables.map((table) => (
        <motion.div
          key={table.id}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onTableClick(table)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onTableClick(table);
            }
          }}
          className={`p-6 rounded-2xl border bg-white dark:bg-zinc-900 shadow-sm flex flex-col items-center gap-4 transition-all hover:shadow-md group relative cursor-pointer ${
            table.status === 'occupied' ? 'border-orange-200 dark:border-orange-900/40' : 'border-zinc-100 dark:border-zinc-800'
          }`}
        >
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onShowQRCode(table);
            }}
            className="absolute top-4 right-4 p-2 text-zinc-300 dark:text-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all opacity-0 group-hover:opacity-100"
          >
            <QrCode size={18} />
          </button>
          <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
            table.status === 'free' ? 'bg-emerald-50 dark:bg-emerald-900/20' :
            table.status === 'occupied' ? 'bg-orange-50 dark:bg-orange-900/20' : 'bg-blue-50 dark:bg-blue-900/20'
          }`}>
            <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{table.number}</span>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 text-zinc-500 dark:text-zinc-400 text-sm mb-2">
              <Users size={14} />
              <span>{table.capacity} {t('persons')}</span>
            </div>
            
            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(table.status)}`}>
              {getStatusIcon(table.status)}
              {getStatusLabel(table.status)}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

export default TableGrid;
