import React, { useState } from 'react';
import { Staff, WaiterShift, Notification, StaffRole } from '../types';
import { UserCog, LogIn, LogOut, Clock, Bell, Check, X, Users, UserPlus, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';

const generateRandomPin = () => Math.floor(1000 + Math.random() * 9000).toString();

interface StaffViewProps {
  staff: Staff[];
  shifts: WaiterShift[];
  notifications?: Notification[];
  onAssignWaiter: (waiterId: string, initialCash: number) => void;
  onReleaseWaiter: (shiftId: string, finalCash: number) => void;
  onCompleteNotification?: (id: string) => void;
  onAddStaff: (staff: Omit<Staff, 'id' | 'restaurantId' | 'active' | 'status'>) => void;
}

const GROUPS: { id: StaffRole; label: string; icon: React.ElementType }[] = [
  { id: 'waiter', label: 'КЕЛНЕРИ', icon: Users },
  { id: 'Admin', label: 'АДМИНИСТРАТОРИ', icon: UserCog },
  { id: 'manager', label: 'МЕНАЏЕРИ', icon: UserCog },
  { id: 'chef', label: 'ГОТВАЧИ', icon: Users },
  { id: 'bartender', label: 'ШАНКЕРИ', icon: Users },
];

const StaffView: React.FC<StaffViewProps> = ({ 
  staff, 
  shifts, 
  notifications = [],
  onAssignWaiter, 
  onReleaseWaiter,
  onCompleteNotification,
  onAddStaff
}) => {
  const { t } = useTranslation();
  const [selectedWaiter, setSelectedWaiter] = useState<string>('');
  const [initialCash, setInitialCash] = useState<string>('0');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<StaffRole>('waiter');
  
  const [newStaff, setNewStaff] = useState({
    name: '',
    email: '',
    role: 'waiter' as StaffRole,
    pin: '',
    permissions: {
      canTransferTable: false,
      canDeleteOrder: false,
      canSeeReports: false,
      canApplyDiscount: false,
      canVoidItems: false,
      canSeeClosedBills: false,
      canTakeOrder: true,
      canProcessPayment: true
    }
  });

  const activeShifts = shifts || [];

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pin = newStaff.pin || generateRandomPin();
    onAddStaff({ ...newStaff, pin });
    setShowAddModal(false);
    resetNewStaff();
  };

  const resetNewStaff = () => {
    setNewStaff({ 
      name: '', 
      email: '', 
      role: 'waiter', 
      pin: '',
      permissions: {
        canTransferTable: false,
        canDeleteOrder: false,
        canSeeReports: false,
        canApplyDiscount: false,
        canVoidItems: false,
        canSeeClosedBills: false,
        canTakeOrder: true,
        canProcessPayment: true
      }
    });
  };

  const updatePermissionsByRole = (role: StaffRole) => {
    const isAdmin = role === 'Admin' || role === 'manager';
    setNewStaff(prev => ({
      ...prev,
      role,
      permissions: {
        canTransferTable: isAdmin,
        canDeleteOrder: isAdmin,
        canSeeReports: isAdmin,
        canApplyDiscount: isAdmin,
        canVoidItems: isAdmin,
        canSeeClosedBills: isAdmin,
        canTakeOrder: true,
        canProcessPayment: true
      }
    }));
  };

  const filteredStaff = staff.filter(s => s.role === selectedGroup);

  return (
    <div className="space-y-8">
      {/* Notifications Section */}
      <AnimatePresence>
        {notifications.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-red-100 dark:border-red-900/20 shadow-sm"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-2xl animate-pulse">
                <Bell size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-black">{t('guest_calls')}</h2>
                <p className="text-zinc-500 dark:text-zinc-400 font-medium">{t('guest_calls_description')}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {notifications.map((notif) => (
                <motion.div
                  key={notif.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="p-4 bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-2xl flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white dark:bg-zinc-800 rounded-xl flex items-center justify-center font-black text-red-600 border border-red-100 dark:border-red-900/20">
                      {notif.tableNumber}
                    </div>
                    <div>
                      <p className="font-black text-sm uppercase tracking-tight">
                        {notif.type === 'call_waiter' ? t('call_waiter') : t('request_bill')}
                      </p>
                      <p className="text-[10px] text-zinc-500 font-bold">
                        {new Date(notif.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => onCompleteNotification?.(notif.id)}
                    className="p-2 bg-white dark:bg-zinc-800 text-emerald-600 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors border border-zinc-100 dark:border-zinc-700 shadow-sm"
                  >
                    <Check size={20} />
                  </button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Waiter Assignment Form */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
            <LogIn className="text-emerald-600 dark:text-emerald-400" size={20} />
            {t('assign_waiter')}
          </h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="staff-select" className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">{t('select_waiter')}</label>
              <select 
                id="staff-select"
                name="staff-select"
                value={selectedWaiter}
                onChange={(e) => setSelectedWaiter(e.target.value)}
                className="w-full p-3 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="" className="bg-white dark:bg-zinc-900">{t('select_placeholder')}</option>
                {staff.filter(s => s.role === 'waiter' && !activeShifts.find(as => as.waiterId === s.id)).map(s => (
                  <option key={s.id} value={s.id} className="bg-white dark:bg-zinc-900">{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="initial-cash" className="block text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-2">{t('initial_cash')} (ден.)</label>
              <input 
                id="initial-cash"
                name="initial-cash"
                type="number"
                value={initialCash}
                onChange={(e) => setInitialCash(e.target.value)}
                className="w-full p-3 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <button 
              onClick={() => {
                if (selectedWaiter) {
                  onAssignWaiter(selectedWaiter, Number(initialCash));
                  setSelectedWaiter('');
                  setInitialCash('0');
                }
              }}
              disabled={!selectedWaiter}
              className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all disabled:opacity-50"
            >
              {t('start_shift')}
            </button>
          </div>
        </div>

        {/* Active Shifts */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
            <Clock className="text-blue-600 dark:text-blue-400" size={20} />
            {t('active_shifts')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeShifts.map((shift) => {
              const waiter = staff.find(s => s.id === shift.waiterId);
              return (
                <motion.div 
                  key={shift.id}
                  layout
                  className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center font-bold">
                        {waiter?.name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-bold text-zinc-900 dark:text-zinc-100">{waiter?.name}</h4>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('start')}: {new Date(shift.startTime).toLocaleTimeString()}</p>
                      </div>
                    </div>
                    <div className="px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[10px] font-bold uppercase rounded">{t('active')}</div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-xl">
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-bold mb-1">{t('deposit')}</p>
                      <p className="font-bold text-zinc-900 dark:text-zinc-100">{shift.initialCash} ден.</p>
                    </div>
                    <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-xl">
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-bold mb-1">{t('turnover')}</p>
                      <p className="font-bold text-emerald-600 dark:text-emerald-400">{shift.totalSales} ден.</p>
                    </div>
                  </div>

                  <button 
                    onClick={() => onReleaseWaiter(shift.id, shift.initialCash + shift.totalSales)}
                    className="w-full py-2 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 rounded-xl font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2"
                  >
                    <LogOut size={16} />
                    {t('release_waiter')}
                  </button>
                </motion.div>
              );
            })}
            {activeShifts.length === 0 && (
              <div className="col-span-full py-12 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
                <p className="text-zinc-400 dark:text-zinc-500 font-medium">{t('no_active_shifts')}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Staff Management Section - R-Keeper Style */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Groups Sidebar */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
            <h3 className="font-black text-xs uppercase tracking-widest text-zinc-500">Групи на Вработени</h3>
          </div>
          <div className="p-2 space-y-1">
            {GROUPS.map((group) => (
              <button
                key={group.id}
                onClick={() => setSelectedGroup(group.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  selectedGroup === group.id 
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' 
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                }`}
              >
                <group.icon size={18} />
                <span className="font-bold text-sm">{group.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Staff List Area */}
        <div className="lg:col-span-3 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
          <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-800/50">
            <div className="flex items-center gap-3">
              <Users className="text-emerald-600" size={24} />
              <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100">
                {GROUPS.find(g => g.id === selectedGroup)?.label}
              </h2>
            </div>
            <button 
              onClick={() => {
                updatePermissionsByRole(selectedGroup);
                setShowAddModal(true);
              }}
              className="px-6 py-2.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-emerald-600 dark:hover:bg-emerald-500 hover:text-white transition-all shadow-lg shadow-zinc-900/10"
            >
              <UserPlus size={16} className="inline mr-2" />
              НОВ ВРАБОТЕН
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredStaff.length > 0 ? (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {filteredStaff.map((member) => (
                  <div key={member.id} className="p-6 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center text-zinc-400 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-900/20 group-hover:text-emerald-600 transition-all">
                        <UserCog size={24} />
                      </div>
                      <div>
                        <h4 className="font-black text-zinc-900 dark:text-zinc-100">{member.name}</h4>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">PIN: {member.pin}</span>
                          <span className={`w-1.5 h-1.5 rounded-full ${member.status === 'active' ? 'bg-emerald-500' : 'bg-zinc-300'}`}></span>
                          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{member.status === 'active' ? 'АКТИВЕН' : 'НЕАКТИВЕН'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex gap-1">
                        {Object.entries(member.permissions || {}).map(([key, value]) => (
                          value && (
                            <div key={key} className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600" title={key}>
                              <Check size={12} />
                            </div>
                          )
                        ))}
                      </div>
                      <button className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
                        <ChevronRight size={20} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                <div className="w-20 h-20 bg-zinc-50 dark:bg-zinc-800 rounded-[2rem] flex items-center justify-center text-zinc-200 dark:text-zinc-700 mb-4">
                  <Users size={40} />
                </div>
                <p className="text-zinc-400 dark:text-zinc-500 font-bold">Нема вработени во оваа група.</p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">Десен клик на празен простор или кликни на копчето горе.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-zinc-950/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-800/50">
                <div>
                  <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-100">НОВ ВРАБОТЕН</h2>
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-1">Група: {GROUPS.find(g => g.id === newStaff.role)?.label}</p>
                </div>
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="p-3 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-2xl transition-colors text-zinc-500"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleAddSubmit} className="p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-6">
                    <div>
                      <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Име и Презиме</label>
                      <input
                        required
                        type="text"
                        value={newStaff.name}
                        onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                        className="w-full p-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all text-zinc-900 dark:text-zinc-100 font-bold"
                        placeholder="пр. Петар Петров"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Е-пошта</label>
                      <input
                        required
                        type="email"
                        value={newStaff.email}
                        onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                        className="w-full p-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all text-zinc-900 dark:text-zinc-100 font-bold"
                        placeholder="petar@example.com"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">PIN (Код за најава)</label>
                      <div className="flex gap-2">
                        <input
                          required
                          type="text"
                          maxLength={4}
                          pattern="\d{4}"
                          value={newStaff.pin}
                          onChange={(e) => setNewStaff({ ...newStaff, pin: e.target.value })}
                          className="flex-1 p-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all text-zinc-900 dark:text-zinc-100 font-black text-center text-xl tracking-widest"
                          placeholder="----"
                        />
                        <button
                          type="button"
                          onClick={() => setNewStaff({ ...newStaff, pin: Math.floor(1000 + Math.random() * 9000).toString() })}
                          className="px-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 rounded-2xl font-bold hover:bg-zinc-200 transition-colors"
                        >
                          Генерирај
                        </button>
                      </div>
                      <p className="text-[10px] text-zinc-400 mt-2 font-bold italic">Кодот се користи за брза најава на системот.</p>
                    </div>
                  </div>

                  <div className="bg-zinc-50 dark:bg-zinc-800/50 p-6 rounded-[2rem] border border-zinc-100 dark:border-zinc-700">
                    <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-6 border-b border-zinc-200 dark:border-zinc-700 pb-2">Права и Дозволи</h3>
                    <div className="space-y-4">
                      {[
                        { id: 'canTakeOrder', label: 'Примање нарачки' },
                        { id: 'canProcessPayment', label: 'Наплата на сметки' },
                        { id: 'canTransferTable', label: 'Префрлање маси' },
                        { id: 'canDeleteOrder', label: 'Бришење нарачки (Сторно)' },
                        { id: 'canSeeReports', label: 'Преглед на извештаи' },
                        { id: 'canSeeClosedBills', label: 'Преглед на затворени сметки' },
                      ].map((perm) => (
                        <label key={perm.id} className="flex items-center justify-between group cursor-pointer">
                          <span className="text-sm font-bold text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-900 transition-colors">{perm.label}</span>
                          <input
                            type="checkbox"
                            checked={newStaff.permissions[perm.id as keyof typeof newStaff.permissions]}
                            onChange={(e) => setNewStaff({
                              ...newStaff,
                              permissions: { ...newStaff.permissions, [perm.id]: e.target.checked }
                            })}
                            className="w-5 h-5 rounded-lg border-zinc-300 text-emerald-600 focus:ring-emerald-500 transition-all"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-zinc-200 transition-all"
                  >
                    ОТКАЖИ
                  </button>
                  <button
                    type="submit"
                    className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/20"
                  >
                    ЗАЧУВАЈ ВРАБОТЕН
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StaffView;
