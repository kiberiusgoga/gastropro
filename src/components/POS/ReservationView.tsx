import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  Users,
  Plus,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { format, addDays, subDays } from 'date-fns';
import { reservationService } from '../../services/reservationService';
import { tableService } from '../../services/posService';
import { Reservation, Table } from '../../types';
import { toast } from 'sonner';
import { useStore } from '../../store/useStore';

const inputCls = 'w-full px-4 py-3 bg-warm-input border border-warm-line rounded-2xl focus:outline-none focus:ring-4 focus:ring-accent/20 focus:border-accent/50 transition-all text-cream font-medium';
const labelCls = 'block text-[10px] font-black text-cream-faint uppercase tracking-widest mb-2';

const ReservationView = () => {
  const { user } = useStore();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newReservation, setNewReservation] = useState<Partial<Reservation>>({
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '19:00',
    numberOfGuests: 2,
    status: 'reserved'
  });

  const [reminders, setReminders] = useState<Reservation[]>([]);
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [resData, tableData, reminderData] = await Promise.all([
        reservationService.getByDate(format(selectedDate, 'yyyy-MM-dd')),
        tableService.getAll(),
        reservationService.getReminders()
      ]);
      setReservations(resData);
      setTables(tableData);
      setReminders(reminderData);
    } catch (error) {
      console.error('Error loading reservations:', error);
      toast.error('Грешка при вчитување на резервации');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAutoAssign = async () => {
    if (!newReservation.date || !newReservation.time || !newReservation.numberOfGuests) {
      toast.error('Ве молиме внесете датум, време и број на гости');
      return;
    }
    setIsAutoAssigning(true);
    try {
      const table = await reservationService.autoAssignTable(
        newReservation.date,
        newReservation.time,
        newReservation.numberOfGuests
      );
      if (table) {
        setNewReservation({ ...newReservation, tableId: table.id, tableNumber: table.number });
        toast.success(`Автоматски доделена Маса ${table.number}`);
      } else {
        toast.error('Нема слободна маса за избраниот термин');
      }
    } catch {
      toast.error('Грешка при автоматско доделување');
    } finally {
      setIsAutoAssigning(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!newReservation.customerName || !newReservation.tableId) {
        toast.error('Ве молиме пополнете ги задолжителните полиња');
        return;
      }
      const reservationData = {
        ...newReservation,
        restaurantId: user?.restaurantId || '',
        customerId: newReservation.customerId || 'walk-in',
      } as Omit<Reservation, 'id' | 'createdAt'>;

      await reservationService.create(reservationData);
      toast.success('Резервацијата е успешно креирана');
      setShowAddModal(false);
      loadData();
    } catch (error) {
      console.error('Error creating reservation:', error);
      toast.error('Грешка при креирање на резервација');
    }
  };

  const updateStatus = async (id: string, status: Reservation['status']) => {
    try {
      await reservationService.update(id, { status });
      toast.success('Статусот е ажуриран');
      loadData();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Грешка при ажурирање на статус');
    }
  };

  const statusBadge = (status: string) => {
    if (status === 'reserved') return 'bg-accent/15 text-accent-light border border-accent/30';
    if (status === 'arrived')  return 'bg-emerald-900/20 text-emerald-400 border border-emerald-700/30';
    return 'bg-rose-900/20 text-rose-400 border border-rose-700/30';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-cream font-serif italic">Резервации</h1>
          <p className="text-cream-muted text-sm">Управување со резервации на маси</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-surface border border-warm-line rounded-xl overflow-hidden shadow-card-sm">
            <button
              onClick={() => setSelectedDate(subDays(selectedDate, 1))}
              className="p-2 hover:bg-surface-2 text-cream-muted transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="px-4 py-2 font-semibold text-cream border-x border-warm-line flex items-center gap-2">
              <CalendarIcon size={18} className="text-accent-light" />
              {format(selectedDate, 'dd.MM.yyyy')}
            </div>
            <button
              onClick={() => setSelectedDate(addDays(selectedDate, 1))}
              className="p-2 hover:bg-surface-2 text-cream-muted transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-[#faf5ee] rounded-xl font-semibold hover:brightness-110 transition-all shadow-card"
          >
            <Plus size={20} />
            Нова Резервација
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Reservations list */}
        <div className="lg:col-span-2 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : reservations.length === 0 ? (
            <div className="bg-surface border border-dashed border-warm-line rounded-2xl p-12 text-center">
              <div className="w-16 h-16 bg-surface-2 rounded-2xl flex items-center justify-center text-cream-faint mx-auto mb-4">
                <CalendarIcon size={32} />
              </div>
              <h3 className="text-lg font-bold text-cream">Нема резервации за овој ден</h3>
              <p className="text-cream-muted text-sm max-w-xs mx-auto mt-2">
                Сè уште нема внесено резервации за избраниот датум.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reservations.map((res) => (
                <div key={res.id} className="bg-surface border border-warm-line rounded-2xl p-5 shadow-card hover:shadow-card-lg hover:-translate-y-0.5 transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-accent/10 rounded-2xl flex items-center justify-center text-accent-light font-bold text-xl">
                        {res.tableNumber}
                      </div>
                      <div>
                        <h4 className="font-bold text-cream">{res.customerName}</h4>
                        <p className="text-sm text-cream-muted">{res.customerPhone}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${statusBadge(res.status)}`}>
                      {res.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="flex items-center gap-2 text-cream-muted">
                      <Clock size={16} className="text-cream-faint" />
                      <span className="text-sm font-medium">{res.time}</span>
                    </div>
                    <div className="flex items-center gap-2 text-cream-muted">
                      <Users size={16} className="text-cream-faint" />
                      <span className="text-sm font-medium">{res.numberOfGuests} гости</span>
                    </div>
                  </div>

                  {res.notes && (
                    <p className="text-sm text-cream-muted bg-surface-2/50 p-3 rounded-xl mb-4 italic border border-warm-line">
                      "{res.notes}"
                    </p>
                  )}

                  <div className="flex items-center gap-2 pt-4 border-t border-warm-line">
                    {res.status === 'reserved' && (
                      <>
                        <button
                          onClick={() => updateStatus(res.id, 'arrived')}
                          className="flex-1 flex items-center justify-center gap-2 py-2 bg-emerald-900/20 text-emerald-400 rounded-xl text-sm font-bold hover:bg-emerald-900/30 transition-colors"
                        >
                          <CheckCircle2 size={16} />
                          Пристигна
                        </button>
                        <button
                          onClick={() => updateStatus(res.id, 'cancelled')}
                          className="flex-1 flex items-center justify-center gap-2 py-2 bg-rose-900/20 text-rose-400 rounded-xl text-sm font-bold hover:bg-rose-900/30 transition-colors"
                        >
                          <XCircle size={16} />
                          Откажи
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar: table status + reminders */}
        <div className="space-y-6">
          <div className="bg-surface border border-warm-line rounded-2xl p-6 shadow-card">
            <h3 className="text-sm font-black text-cream-faint uppercase tracking-widest mb-4 flex items-center gap-2">
              <Users size={18} className="text-accent-light" />
              Статус на маси
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {tables.map(table => (
                <div
                  key={table.id}
                  className={`aspect-square rounded-xl flex flex-col items-center justify-center border-2 transition-all text-xs font-bold ${
                    table.status === 'free'     ? 'bg-surface-2 border-warm-line text-cream-faint' :
                    table.status === 'reserved' ? 'bg-accent/10 border-accent/30 text-accent-light' :
                                                  'bg-rose-900/20 border-rose-700/30 text-rose-400'
                  }`}
                >
                  <span className="text-base font-black">{table.number}</span>
                  <span className="text-[9px] uppercase font-bold mt-0.5">{table.status}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-surface border border-warm-line rounded-2xl p-6 shadow-card">
            <h3 className="text-sm font-black text-cream-faint uppercase tracking-widest mb-4 flex items-center gap-2">
              <Clock size={18} className="text-amber-400" />
              Денешни потсетници
            </h3>
            <div className="space-y-3">
              {reminders.length === 0 ? (
                <p className="text-sm text-cream-faint italic">Нема претстојни резервации за денес.</p>
              ) : (
                reminders.map(res => (
                  <div key={res.id} className="flex items-center justify-between p-3 bg-surface-2 rounded-2xl border border-warm-line">
                    <div>
                      <p className="text-sm font-bold text-cream">{res.customerName}</p>
                      <p className="text-xs text-cream-faint">{res.time} • Маса {res.tableNumber}</p>
                    </div>
                    <div className="text-xs font-bold text-accent-light bg-accent/10 px-2 py-1 rounded-lg">
                      {res.numberOfGuests} лица
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Reservation Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-base/80 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className="bg-surface border border-warm-line rounded-2xl shadow-card-lg w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-warm-line flex items-center justify-between bg-surface-2/50">
              <h2 className="text-xl font-black text-cream">Нова Резервација</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-surface-2 rounded-xl text-cream-faint hover:text-cream transition-colors"
              >
                <XCircle size={24} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Ime на клиент</label>
                  <input
                    type="text"
                    required
                    className={inputCls}
                    value={newReservation.customerName || ''}
                    onChange={(e) => setNewReservation({...newReservation, customerName: e.target.value, customerId: 'temp'})}
                  />
                </div>
                <div>
                  <label className={labelCls}>Телефон</label>
                  <input
                    type="text"
                    required
                    className={inputCls}
                    value={newReservation.customerPhone || ''}
                    onChange={(e) => setNewReservation({...newReservation, customerPhone: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Маса</label>
                  <div className="flex gap-2">
                    <select
                      required
                      className={`flex-1 ${inputCls}`}
                      value={newReservation.tableId || ''}
                      onChange={(e) => {
                        const table = tables.find(t => t.id === e.target.value);
                        setNewReservation({...newReservation, tableId: e.target.value, tableNumber: table?.number});
                      }}
                    >
                      <option value="" className="bg-surface">Избери маса</option>
                      {tables.filter(t => t.status === 'free').map(t => (
                        <option key={t.id} value={t.id} className="bg-surface">Маса {t.number} ({t.capacity} лица)</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAutoAssign}
                      disabled={isAutoAssigning}
                      className="px-3 bg-accent/10 text-accent-light rounded-xl hover:bg-accent/20 transition-colors disabled:opacity-50"
                      title="Автоматско доделување"
                    >
                      {isAutoAssigning
                        ? <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                        : <CheckCircle2 size={20} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Број на гости</label>
                  <input
                    type="number"
                    required
                    min="1"
                    className={inputCls}
                    value={newReservation.numberOfGuests || 2}
                    onChange={(e) => setNewReservation({...newReservation, numberOfGuests: parseInt(e.target.value)})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Датум</label>
                  <input
                    type="date"
                    required
                    className={inputCls}
                    value={newReservation.date || ''}
                    onChange={(e) => setNewReservation({...newReservation, date: e.target.value})}
                  />
                </div>
                <div>
                  <label className={labelCls}>Време</label>
                  <input
                    type="time"
                    required
                    className={inputCls}
                    value={newReservation.time || ''}
                    onChange={(e) => setNewReservation({...newReservation, time: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Забелешки</label>
                <textarea
                  className={`${inputCls} h-24 resize-none`}
                  value={newReservation.notes || ''}
                  onChange={(e) => setNewReservation({...newReservation, notes: e.target.value})}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3 bg-surface-2 text-cream-muted rounded-xl font-bold hover:bg-warm-input transition-colors"
                >
                  Откажи
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-accent text-[#faf5ee] rounded-xl font-bold hover:brightness-110 transition-all shadow-card"
                >
                  Креирај Резервација
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReservationView;
