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

const ReservationView = () => {
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
        setNewReservation({
          ...newReservation,
          tableId: table.id,
          tableNumber: table.number
        });
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
      
      // Add restaurantId (mocked for now, should come from context)
      const reservationData = {
        ...newReservation,
        restaurantId: 'main-restaurant',
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Резервации</h1>
          <p className="text-slate-500">Управување со резервации на маси</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden">
            <button 
              onClick={() => setSelectedDate(subDays(selectedDate, 1))}
              className="p-2 hover:bg-slate-50 text-slate-600"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="px-4 py-2 font-semibold text-slate-700 border-x border-slate-100 flex items-center gap-2">
              <CalendarIcon size={18} className="text-blue-600" />
              {format(selectedDate, 'dd.MM.yyyy')}
            </div>
            <button 
              onClick={() => setSelectedDate(addDays(selectedDate, 1))}
              className="p-2 hover:bg-slate-50 text-slate-600"
            >
              <ChevronRight size={20} />
            </button>
          </div>
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
          >
            <Plus size={20} />
            Нова Резервација
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : reservations.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 mx-auto mb-4">
                <CalendarIcon size={32} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Нема резервации за овој ден</h3>
              <p className="text-slate-500 max-w-xs mx-auto mt-2">
                Сè уште нема внесено резервации за избраниот датум.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reservations.map((res) => (
                <div key={res.id} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all group">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 font-bold text-xl">
                        {res.tableNumber}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900">{res.customerName}</h4>
                        <p className="text-sm text-slate-500">{res.customerPhone}</p>
                      </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      res.status === 'reserved' ? 'bg-blue-100 text-blue-700' :
                      res.status === 'arrived' ? 'bg-green-100 text-green-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {res.status}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Clock size={16} className="text-slate-400" />
                      <span className="text-sm font-medium">{res.time}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <Users size={16} className="text-slate-400" />
                      <span className="text-sm font-medium">{res.numberOfGuests} гости</span>
                    </div>
                  </div>

                  {res.notes && (
                    <p className="text-sm text-slate-500 bg-slate-50 p-3 rounded-xl mb-4 italic">
                      "{res.notes}"
                    </p>
                  )}

                  <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
                    {res.status === 'reserved' && (
                      <>
                        <button 
                          onClick={() => updateStatus(res.id, 'arrived')}
                          className="flex-1 flex items-center justify-center gap-2 py-2 bg-green-50 text-green-700 rounded-xl text-sm font-bold hover:bg-green-100 transition-colors"
                        >
                          <CheckCircle2 size={16} />
                          Пристигна
                        </button>
                        <button 
                          onClick={() => updateStatus(res.id, 'cancelled')}
                          className="flex-1 flex items-center justify-center gap-2 py-2 bg-red-50 text-red-700 rounded-xl text-sm font-bold hover:bg-red-100 transition-colors"
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

        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Users size={20} className="text-blue-600" />
              Статус на маси
            </h3>
            <div className="grid grid-cols-4 gap-3">
              {tables.map(table => (
                <div 
                  key={table.id}
                  className={`aspect-square rounded-2xl flex flex-col items-center justify-center border-2 transition-all ${
                    table.status === 'free' ? 'bg-white border-slate-100 text-slate-400' :
                    table.status === 'reserved' ? 'bg-blue-50 border-blue-200 text-blue-600' :
                    'bg-red-50 border-red-200 text-red-600'
                  }`}
                >
                  <span className="text-lg font-bold">{table.number}</span>
                  <span className="text-[10px] uppercase font-bold">{table.status}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Reminders Section */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Clock size={20} className="text-orange-500" />
              Денешни потсетници
            </h3>
            <div className="space-y-3">
              {reminders.length === 0 ? (
                <p className="text-sm text-slate-500 italic">Нема претстојни резервации за денес.</p>
              ) : (
                reminders.map(res => (
                  <div key={res.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{res.customerName}</p>
                      <p className="text-xs text-slate-500">{res.time} • Маса {res.tableNumber}</p>
                    </div>
                    <div className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
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
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Нова Резервација</h2>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-400"
              >
                <XCircle size={24} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Име на клиент</label>
                  <input 
                    type="text"
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none"
                    value={newReservation.customerName || ''}
                    onChange={(e) => setNewReservation({...newReservation, customerName: e.target.value, customerId: 'temp'})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Телефон</label>
                  <input 
                    type="text"
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none"
                    value={newReservation.customerPhone || ''}
                    onChange={(e) => setNewReservation({...newReservation, customerPhone: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Маса</label>
                  <div className="flex gap-2">
                    <select 
                      required
                      className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none"
                      value={newReservation.tableId || ''}
                      onChange={(e) => {
                        const table = tables.find(t => t.id === e.target.value);
                        setNewReservation({...newReservation, tableId: e.target.value, tableNumber: table?.number});
                      }}
                    >
                      <option value="">Избери маса</option>
                      {tables.filter(t => t.status === 'free').map(t => (
                        <option key={t.id} value={t.id}>Маса {t.number} ({t.capacity} лица)</option>
                      ))}
                    </select>
                    <button 
                      type="button"
                      onClick={handleAutoAssign}
                      disabled={isAutoAssigning}
                      className="px-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors disabled:opacity-50"
                      title="Автоматско доделување"
                    >
                      {isAutoAssigning ? <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div> : <CheckCircle2 size={20} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Број на гости</label>
                  <input 
                    type="number"
                    required
                    min="1"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none"
                    value={newReservation.numberOfGuests || 2}
                    onChange={(e) => setNewReservation({...newReservation, numberOfGuests: parseInt(e.target.value)})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Датум</label>
                  <input 
                    type="date"
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none"
                    value={newReservation.date || ''}
                    onChange={(e) => setNewReservation({...newReservation, date: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Време</label>
                  <input 
                    type="time"
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none"
                    value={newReservation.time || ''}
                    onChange={(e) => setNewReservation({...newReservation, time: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Забелешки</label>
                <textarea 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none h-24 resize-none"
                  value={newReservation.notes || ''}
                  onChange={(e) => setNewReservation({...newReservation, notes: e.target.value})}
                ></textarea>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                >
                  Откажи
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
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
