import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { History, ChevronLeft, ChevronRight, TrendingDown, TrendingUp, Minus, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '../../lib/apiClient';
import { useStore } from '../../store/useStore';
import ZReportView from './ZReportView';
import type { ZReportData } from '../../services/zreportService';

interface ShiftRow {
  id: string;
  start_time: string;
  end_time: string | null;
  status: 'open' | 'closed';
  initial_cash: string;
  final_cash: string | null;
  expected_cash: string | null;
  cash_difference: string | null;
  zreport_generated_at: string | null;
  user_id: string;
  user_name: string;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

function duration(start: string, end: string | null) {
  if (!end) return '—';
  const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}ч ${m}мин` : `${m}мин`;
}

function fmtTs(ts: string) {
  return new Date(ts).toLocaleString('mk-MK', { dateStyle: 'short', timeStyle: 'short' });
}

function fmtMoney(n: string | null) {
  if (n === null) return '—';
  return `${Number(n).toLocaleString('mk-MK', { minimumFractionDigits: 2 })} ден.`;
}

const ShiftHistory: React.FC = () => {
  const { user, employees } = useStore();
  const isManager = user?.role === 'Admin' || user?.role === 'Manager';

  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: 20, pages: 1 });
  const [loading, setLoading] = useState(true);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [page, setPage] = useState(1);

  const [viewingZReport, setViewingZReport] = useState<ZReportData | null>(null);
  const [loadingZReport, setLoadingZReport] = useState<string | null>(null);

  const fetchShifts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20', status: 'closed' });
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      if (filterUser && isManager) params.set('user_id', filterUser);

      const res = await apiClient.get(`/shifts?${params}`);
      setShifts(res.data.data);
      setPagination(res.data.pagination);
    } catch {
      toast.error('Грешка при вчитување на историјата на смени');
    } finally {
      setLoading(false);
    }
  }, [page, dateFrom, dateTo, filterUser, isManager]);

  useEffect(() => { fetchShifts(); }, [fetchShifts]);

  const openZReport = async (shiftId: string) => {
    setLoadingZReport(shiftId);
    try {
      const res = await apiClient.get(`/shifts/${shiftId}/zreport`);
      setViewingZReport(res.data);
    } catch {
      toast.error('Грешка при вчитување на Z-извештајот');
    } finally {
      setLoadingZReport(null);
    }
  };

  const waiterOptions = employees.filter(e => e.role === 'Waiter');

  if (viewingZReport) {
    return (
      <div>
        <ZReportView zreport={viewingZReport} onBack={() => setViewingZReport(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <History size={20} className="text-accent-light" />
        <h2 className="text-xl font-bold text-cream">Историја на смени</h2>
        <span className="ml-auto text-xs text-cream-faint font-medium">{pagination.total} вкупно</span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 bg-surface p-4 rounded-2xl border border-warm-line">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-black uppercase tracking-widest text-cream-faint">Од датум</label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => { setDateFrom(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-warm-input border border-warm-line rounded-xl text-sm font-medium text-cream focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/50"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-black uppercase tracking-widest text-cream-faint">До датум</label>
          <input
            type="date"
            value={dateTo}
            onChange={e => { setDateTo(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-warm-input border border-warm-line rounded-xl text-sm font-medium text-cream focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/50"
          />
        </div>
        {isManager && waiterOptions.length > 0 && (
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-cream-faint">Келнер</label>
            <select
              value={filterUser}
              onChange={e => { setFilterUser(e.target.value); setPage(1); }}
              className="px-3 py-2 bg-warm-input border border-warm-line rounded-xl text-sm font-medium text-cream focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/50"
            >
              <option value="">Сите келнери</option>
              {waiterOptions.map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
        )}
        {(dateFrom || dateTo || filterUser) && (
          <div className="flex flex-col justify-end">
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); setFilterUser(''); setPage(1); }}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-bold text-cream-faint hover:text-cream transition-colors"
            >
              <X size={14} />
              Исчисти
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-surface rounded-2xl border border-warm-line overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-cream-faint">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm font-bold">Се вчитува...</span>
          </div>
        ) : shifts.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-cream-muted font-medium">Нема затворени смени</p>
            {(dateFrom || dateTo || filterUser) && (
              <p className="text-xs text-cream-faint mt-1">Пробај со поширок филтер</p>
            )}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] font-black uppercase tracking-widest text-cream-faint border-b border-warm-line bg-surface-2/50">
                    <th className="text-left px-6 py-3">Келнер</th>
                    <th className="text-left px-4 py-3">Отворена</th>
                    <th className="text-left px-4 py-3">Затворена</th>
                    <th className="text-left px-4 py-3">Траење</th>
                    <th className="text-right px-4 py-3">Бруто приход</th>
                    <th className="text-right px-6 py-3">Разлика каса</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-warm-line/50">
                  <AnimatePresence>
                    {shifts.map(shift => {
                      const diff = shift.cash_difference ? Number(shift.cash_difference) : null;
                      const diffColor =
                        diff === null ? 'text-cream-faint' :
                        diff === 0 ? 'text-emerald-400' :
                        Math.abs(diff) <= 50 ? 'text-amber-400' :
                        'text-red-400';

                      return (
                        <motion.tr
                          key={shift.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          onClick={() => openZReport(shift.id)}
                          className="hover:bg-surface-2/50 transition-colors cursor-pointer group"
                        >
                          <td className="px-6 py-4 font-bold text-cream">
                            {shift.user_name}
                          </td>
                          <td className="px-4 py-4 text-cream-faint">{fmtTs(shift.start_time)}</td>
                          <td className="px-4 py-4 text-cream-faint">{shift.end_time ? fmtTs(shift.end_time) : '—'}</td>
                          <td className="px-4 py-4 text-cream-faint">{duration(shift.start_time, shift.end_time)}</td>
                          <td className="px-4 py-4 text-right font-bold text-cream">
                            {shift.final_cash !== null ? fmtMoney(shift.final_cash) : '—'}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {diff !== null ? (
                              <span className={`flex items-center justify-end gap-1 font-black ${diffColor}`}>
                                {diff > 0 ? <TrendingUp size={12} /> : diff < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
                                {diff > 0 ? '+' : ''}{Number(diff).toLocaleString('mk-MK', { minimumFractionDigits: 2 })} ден.
                              </span>
                            ) : '—'}
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-warm-line">
              {shifts.map(shift => {
                const diff = shift.cash_difference ? Number(shift.cash_difference) : null;
                const diffColor =
                  diff === null ? 'text-cream-faint' :
                  diff === 0 ? 'text-emerald-400' :
                  Math.abs(diff) <= 50 ? 'text-amber-400' : 'text-red-400';

                return (
                  <div
                    key={shift.id}
                    onClick={() => openZReport(shift.id)}
                    className="p-4 hover:bg-surface-2/50 active:bg-surface-2 cursor-pointer transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-bold text-cream">{shift.user_name}</span>
                      {diff !== null && (
                        <span className={`text-sm font-black ${diffColor}`}>
                          {diff > 0 ? '+' : ''}{Number(diff).toLocaleString('mk-MK', { minimumFractionDigits: 2 })} ден.
                        </span>
                      )}
                    </div>
                    <div className="flex gap-3 text-xs text-cream-faint font-medium">
                      <span>{fmtTs(shift.start_time)}</span>
                      <span>·</span>
                      <span>{duration(shift.start_time, shift.end_time)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Loading overlay for z-report */}
            {loadingZReport && (
              <div className="flex items-center justify-center py-4 gap-2 text-cream-faint border-t border-warm-line">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-xs font-bold">Се вчитува Z-извештај...</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-cream-faint font-medium">
            Страница {pagination.page} од {pagination.pages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-xl border border-warm-line text-cream-muted hover:bg-surface-2 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
              disabled={page >= pagination.pages}
              className="p-2 rounded-xl border border-warm-line text-cream-muted hover:bg-surface-2 disabled:opacity-40 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShiftHistory;
