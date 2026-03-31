import React, { useState, useEffect } from 'react';
import { Customer } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Users, UserPlus, Search, Star, Phone, Mail, Calendar, X } from 'lucide-react';
import { crmService } from '../../services/crmService';

interface CustomerCRMProps {
  customers?: Customer[];
  onAddCustomer?: (customer: Omit<Customer, 'id' | 'loyaltyPoints' | 'lastVisit'>) => void;
}

const CustomerCRM: React.FC<CustomerCRMProps> = ({ customers: initialCustomers, onAddCustomer: initialOnAddCustomer }) => {
  const [internalCustomers, setInternalCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', email: '', phone: '' });
  const [loading, setLoading] = useState(!initialCustomers);

  const customers = initialCustomers || internalCustomers;

  useEffect(() => {
    if (!initialCustomers) {
      const fetchCustomers = async () => {
        const data = await crmService.getAll();
        setInternalCustomers(data);
        setLoading(false);
      };
      fetchCustomers();
    }
  }, [initialCustomers]);

  const filteredCustomers = (customers || []).filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone?.includes(searchTerm) || 
    c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (initialOnAddCustomer) {
      initialOnAddCustomer(newCustomer);
    } else {
      const created = await crmService.create({
        ...newCustomer,
        loyaltyPoints: 0,
        lastVisit: new Date().toISOString()
      });
      if (created) {
        setInternalCustomers(prev => [...prev, created as Customer]);
      }
    }
    setNewCustomer({ name: '', email: '', phone: '' });
    setIsModalOpen(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-sm">
        <div className="flex-1 w-full relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" size={20} />
          <input 
            id="customer-search"
            name="customer-search"
            type="text" 
            placeholder="Пребарај гости по име, телефон или е-пошта..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all text-lg font-medium text-zinc-900 dark:text-zinc-100"
          />
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="w-full md:w-auto px-8 py-4 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-2xl font-black hover:bg-emerald-600 dark:hover:bg-emerald-500 transition-all flex items-center justify-center gap-3 shadow-lg shadow-zinc-900/10"
        >
          <UserPlus size={24} />
          НОВ ГОСТИН
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
        {filteredCustomers.map((customer, i) => (
          <motion.div
            key={customer.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-sm hover:shadow-xl hover:border-emerald-100 dark:hover:border-emerald-900/20 transition-all group"
          >
            <div className="flex items-start justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 dark:text-zinc-500 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-900/20 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  <Users size={32} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100">{customer.name}</h3>
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-black text-xs uppercase tracking-widest mt-1">
                    <Star size={12} fill="currentColor" />
                    {customer.loyaltyPoints} ПОЕНИ
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              {customer.phone && (
                <div className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400 font-medium">
                  <Phone size={16} />
                  <span>{customer.phone}</span>
                </div>
              )}
              {customer.email && (
                <div className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400 font-medium">
                  <Mail size={16} />
                  <span>{customer.email}</span>
                </div>
              )}
              <div className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400 font-medium">
                <Calendar size={16} />
                <span>Последна посета: {new Date(customer.lastVisit).toLocaleDateString('mk-MK')}</span>
              </div>
            </div>

            <div className="pt-8 border-t border-zinc-50 dark:border-zinc-800 grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-zinc-50 dark:bg-zinc-800 rounded-2xl">
                <p className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1">ПОСЕТИ</p>
                <p className="text-2xl font-black text-zinc-900 dark:text-zinc-100">0</p>
              </div>
              <div className="text-center p-4 bg-zinc-50 dark:bg-zinc-800 rounded-2xl">
                <p className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1">ОМИЛЕНО</p>
                <p className="text-sm font-black truncate text-zinc-900 dark:text-zinc-100">
                  Нема
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-zinc-950/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white dark:bg-zinc-900 w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden p-10 border border-zinc-100 dark:border-zinc-800"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-black text-zinc-900 dark:text-zinc-100">Нов гостин</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-zinc-500 dark:text-zinc-400">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="customer-name" className="block text-sm font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">Име и презиме</label>
                  <input 
                    id="customer-name"
                    name="customer-name"
                    required
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                    className="w-full p-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-bold text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="customer-phone" className="block text-sm font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">Телефон</label>
                    <input 
                      id="customer-phone"
                      name="customer-phone"
                      value={newCustomer.phone}
                      onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                      className="w-full p-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-bold text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label htmlFor="customer-email" className="block text-sm font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">Е-пошта</label>
                    <input 
                      id="customer-email"
                      name="customer-email"
                      type="email"
                      value={newCustomer.email}
                      onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                      className="w-full p-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-bold text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                </div>

                <div className="pt-6">
                  <button 
                    type="submit"
                    className="w-full py-5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-2xl font-black hover:bg-emerald-600 dark:hover:bg-emerald-500 transition-all shadow-xl shadow-zinc-900/20"
                  >
                    КРЕИРАЈ ПРОФИЛ
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

export default CustomerCRM;
