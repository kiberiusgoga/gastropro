import React, { useState, useEffect, useMemo } from 'react';
import { User } from '../types';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useStore } from '../store/useStore';
import { authService } from '../services/authService';
import { 
  Users, 
  UserPlus, 
  Mail, 
  Trash2, 
  Edit2, 
  CheckCircle2, 
  X, 
  BarChart3, 
  DollarSign, 
  AlertTriangle,
  Download,
  Search,
  UserCheck,
  UserX
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell,
  Legend,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { cn } from '../utils/cn';

const ManagerDashboard = () => {
  const { employees, transactions, products, loading, fetchEmployees, fetchInventory, fetchProducts } = useStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<User | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    if (employees.length === 0 && !loading.employees) fetchEmployees();
    if (transactions.length === 0 && !loading.inventory) fetchInventory();
    if (products.length === 0 && !loading.products) fetchProducts();
  }, [employees.length, transactions.length, products.length, loading.employees, loading.inventory, loading.products, fetchEmployees, fetchInventory, fetchProducts]);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'Warehouse Worker' as 'Admin' | 'Manager' | 'Warehouse Worker',
    active: true
  });
  const [searchTerm, setSearchTerm] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingEmployee) {
        await authService.updateUser(editingEmployee.id, {
          ...formData
        });
        toast.success(t('success_update'));
      } else {
        await authService.createUser({
          ...formData,
          password: 'password123' // Default password for new employees
        });
        toast.success(t('success_add'));
      }
      setIsModalOpen(false);
      setEditingEmployee(null);
      setFormData({ name: '', email: '', role: 'Warehouse Worker', active: true });
      fetchEmployees();
    } catch {
      toast.error(t('error'));
    }
  };

  const toggleEmployeeStatus = async (emp: User) => {
    try {
      await authService.updateUser(emp.id, { active: !emp.active });
      toast.success(t('status_updated'));
      fetchEmployees();
    } catch {
      toast.error(t('error'));
    }
  };

  // Analytics Data
  const stockValue = useMemo(() => {
    return products.reduce((acc, p) => acc + (p.currentStock * (p.purchasePrice || 0)), 0);
  }, [products]);

  const lowStockCount = useMemo(() => {
    return products.filter(p => p.currentStock <= p.minStock).length;
  }, [products]);
  
  const transactionsByType = useMemo(() => {
    const counts = { receipt: 0, input: 0, output: 0, inventory_check: 0 };
    transactions.forEach(t => {
      if (counts[t.type as keyof typeof counts] !== undefined) {
        counts[t.type as keyof typeof counts]++;
      }
    });
    return [
      { name: t('receipt'), value: counts.receipt },
      { name: t('input'), value: counts.input },
      { name: t('output'), value: counts.output },
      { name: t('check'), value: counts.inventory_check },
    ];
  }, [transactions, t]);

  const mostActiveStaff = useMemo(() => {
    if (!transactions.length) return null;
    const userCounts: Record<string, number> = {};
    transactions.forEach(t => {
      if (t.userId) {
        userCounts[t.userId] = (userCounts[t.userId] || 0) + 1;
      }
    });
    const mostActiveId = Object.keys(userCounts).sort((a, b) => userCounts[b] - userCounts[a])[0];
    if (!mostActiveId) return null;
    const emp = employees.find(e => e.id === mostActiveId);
    return {
      name: emp ? emp.name : t('unknown'),
      count: userCounts[mostActiveId]
    };
  }, [transactions, employees, t]);

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => 
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      emp.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [employees, searchTerm]);

  const COLORS = ['#3b82f6', '#10b981', '#f43f5e', '#f59e0b'];

  return (
    <div className="space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">{t('manager_dashboard')}</h2>
          <p className="text-slate-500 font-medium">{t('business_oversight_and_staff')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn btn-secondary">
            <Download size={20} />
            {t('export_reports')}
          </button>
          <button onClick={() => { setEditingEmployee(null); setIsModalOpen(true); }} className="btn btn-primary">
            <UserPlus size={20} />
            {t('add_employee')}
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card p-8 bg-zinc-950 text-white border-none shadow-2xl relative overflow-hidden group">
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6">
              <div className="p-3 bg-emerald-500 rounded-2xl text-zinc-950 shadow-lg shadow-emerald-500/20">
                <DollarSign size={24} strokeWidth={3} />
              </div>
              <span className="text-[10px] font-black bg-white/10 px-2 py-1 rounded-lg uppercase tracking-widest text-emerald-500">
                {t('total_value')}
              </span>
            </div>
            <p className="text-3xl font-black mb-1 font-display tracking-tighter">{stockValue.toLocaleString()} <small className="text-xs opacity-50 uppercase">ден.</small></p>
            <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">{t('inventory_asset_value')}</p>
          </div>
          <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full group-hover:scale-150 transition-transform duration-700"></div>
        </div>

        <StatCard 
          title={t('critical')} 
          value={lowStockCount} 
          icon={AlertTriangle} 
          color="amber" 
        />

        <StatCard 
          title={t('staff')} 
          value={employees.length} 
          icon={Users} 
          color="blue" 
        />

        <StatCard 
          title={t('activity')} 
          value={transactions.length} 
          icon={BarChart3} 
          color="indigo" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Employee List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-8 glass-thick border-white/40 dark:border-white/5">
            <div className="flex items-center justify-between mb-10">
              <div className="flex flex-col">
                <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tight font-display italic">
                  {t('employee_management')}
                </h3>
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-1">Тим и Овластувања</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-emerald-500 transition-colors" size={16} />
                  <input 
                    type="text" 
                    className="pl-10 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-xl text-xs font-bold w-48 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all" 
                    placeholder={t('search')} 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {filteredEmployees.map((emp) => (
                <div key={emp.id} className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-100 hover:border-blue-200 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-xl font-black text-blue-600 border border-slate-100">
                      {emp.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-900">{emp.name}</p>
                        <span className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest",
                          emp.role === 'Admin' ? "bg-rose-100 text-rose-700" : 
                          emp.role === 'Manager' ? "bg-blue-100 text-blue-700" : 
                          "bg-slate-200 text-slate-700"
                        )}>
                          {t(emp.role)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <Mail size={12} />
                        {emp.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => toggleEmployeeStatus(emp)}
                      className={cn(
                        "p-2 rounded-xl transition-all",
                        emp.active ? "text-emerald-600 hover:bg-emerald-100" : "text-slate-400 hover:bg-slate-200"
                      )}
                      title={emp.active ? t('deactivate') : t('activate')}
                    >
                      {emp.active ? <UserCheck size={20} /> : <UserX size={20} />}
                    </button>
                    <button 
                      onClick={() => { setEditingEmployee(emp); setFormData({ name: emp.name, email: emp.email, role: emp.role, active: emp.active }); setIsModalOpen(true); }}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                    >
                      <Edit2 size={20} />
                    </button>
                    <button 
                      onClick={() => {
                        if (window.confirm(t('confirm_delete'))) {
                          authService.updateUser(emp.id, { active: false }).then(() => fetchEmployees());
                          toast.success(t('status_updated'));
                        }
                      }}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Distribution Chart */}
        <div className="space-y-6">
          <div className="card p-6 h-full">
            <h3 className="text-xl font-bold text-slate-900 mb-8 flex items-center gap-2">
              <BarChart3 size={24} className="text-blue-600" />
              {t('movement_distribution')}
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={transactionsByType}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {transactionsByType.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-8 space-y-4">
              {mostActiveStaff && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{t('most_active_staff')}</p>
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-slate-900">{mostActiveStaff.name}</p>
                    <span className="text-sm font-black text-blue-600">{mostActiveStaff.count} {t('actions')}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-900">{editingEmployee ? t('edit_employee') : t('add_employee')}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-white hover:text-slate-900 rounded-full transition-all shadow-sm">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div>
                <label className="label">{t('full_name')}</label>
                <input 
                  type="text" 
                  className="input" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="label">{t('email')}</label>
                <input 
                  type="email" 
                  className="input" 
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="label">{t('role')}</label>
                <div className="grid grid-cols-3 gap-3">
                  {(['Admin', 'Manager', 'Warehouse Worker'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setFormData({...formData, role: r})}
                      className={cn(
                        "py-3 rounded-2xl border-2 transition-all text-xs font-bold uppercase tracking-widest",
                        formData.role === r 
                          ? "border-blue-600 bg-blue-50 text-blue-700" 
                          : "border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200"
                      )}
                    >
                      {t(r)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
                  {t('cancel')}
                </button>
                <button type="submit" className="btn btn-primary px-8">
                  <CheckCircle2 size={20} />
                  {t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerDashboard;
