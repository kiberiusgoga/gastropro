import React, { useState, useEffect, useCallback } from 'react';
import { Employee, UserRole } from '../../types';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, X, CheckCircle2, Mail, UserCheck, UserX } from 'lucide-react';
import { cn } from '../../utils/cn';
import { employeeService } from '../../services/employeeService';

const Employees: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const { t } = useTranslation();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'waiter' as UserRole,
    active: true,
    phone: ''
  });

  const loadEmployees = useCallback(async () => {
    try {
      const data = await employeeService.getAll();
      setEmployees(data);
    } catch (error) {
      console.error("Error loading employees:", error);
      toast.error(t('error'));
    }
  }, [t]);

  useEffect(() => {
    let isMounted = true;
    const fetchEmployees = async () => {
      if (isMounted) {
        await loadEmployees();
      }
    };
    fetchEmployees();
    return () => { isMounted = false; };
  }, [loadEmployees]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingEmployee) {
        await employeeService.update(editingEmployee.id, formData);
        toast.success(t('success_update'));
      } else {
        await employeeService.create(formData);
        toast.success(t('success_add'));
      }
      setIsModalOpen(false);
      setEditingEmployee(null);
      setFormData({ name: '', email: '', role: 'waiter', active: true, phone: '' });
      loadEmployees();
    } catch {
      toast.error(t('error'));
    }
  };

  const toggleStatus = async (emp: Employee) => {
    try {
      await employeeService.update(emp.id, { active: !emp.active });
      toast.success(t('status_updated'));
      loadEmployees();
    } catch {
      toast.error(t('error'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('confirm_delete'))) return;
    try {
      await employeeService.delete(id);
      toast.success(t('success_delete'));
      loadEmployees();
    } catch {
      toast.error(t('error'));
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">{t('employees')}</h2>
          <p className="text-slate-500 font-medium">{t('manage_staff_and_roles')}</p>
        </div>
        <button onClick={() => { setEditingEmployee(null); setIsModalOpen(true); }} className="btn btn-primary">
          <Plus size={20} />
          {t('add_employee')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {employees.map((emp) => (
          <div key={emp.id} className="card p-6 flex flex-col gap-4 hover:shadow-lg transition-all group">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl font-black">
                {emp.name.charAt(0)}
              </div>
              <span className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest",
                emp.role === 'Admin' ? "bg-rose-100 text-rose-700" : 
                emp.role === 'Manager' ? "bg-blue-100 text-blue-700" : 
                "bg-slate-200 text-slate-700"
              )}>
                {t(emp.role)}
              </span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">{emp.name}</h3>
              <p className="text-sm text-slate-500 flex items-center gap-1">
                <Mail size={14} />
                {emp.email}
              </p>
            </div>
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => toggleStatus(emp)}
                  className={cn(
                    "p-2 rounded-xl transition-all",
                    emp.active ? "text-emerald-600 hover:bg-emerald-100" : "text-slate-400 hover:bg-slate-200"
                  )}
                >
                  {emp.active ? <UserCheck size={20} /> : <UserX size={20} />}
                </button>
                <button 
                  onClick={() => { setEditingEmployee(emp); setFormData({ name: emp.name, email: emp.email, role: emp.role, active: emp.active, phone: emp.phone || '' }); setIsModalOpen(true); }}
                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                >
                  <Edit2 size={20} />
                </button>
              </div>
              <button 
                onClick={() => handleDelete(emp.id)}
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
              >
                <Trash2 size={20} />
              </button>
            </div>
          </div>
        ))}
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
                <label className="label">{t('phone')}</label>
                <input 
                  type="text" 
                  className="input" 
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                />
              </div>
              <div>
                <label className="label">{t('role')}</label>
                <div className="grid grid-cols-2 gap-3">
                  {(['admin', 'manager', 'waiter', 'kitchen', 'cashier', 'delivery'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setFormData({...formData, role: r})}
                      className={cn(
                        "py-3 rounded-2xl border-2 transition-all text-[10px] font-bold uppercase tracking-widest",
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

export default Employees;
