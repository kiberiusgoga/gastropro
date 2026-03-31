import React, { useState, useEffect } from 'react';
import { MenuItem, Restaurant, Table } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { UtensilsCrossed, Bell, Receipt, Search, CheckCircle } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, collection, query, where, onSnapshot, addDoc, Timestamp } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';

interface GuestMenuProps {
  restaurantId: string;
  tableId: string;
}

const GuestMenu: React.FC<GuestMenuProps> = ({ restaurantId, tableId }) => {
  const { t, i18n } = useTranslation();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [table, setTable] = useState<Table | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch Restaurant
        const restDoc = await getDoc(doc(db, 'restaurants', restaurantId)).catch(err => handleFirestoreError(err, OperationType.GET, `restaurants/${restaurantId}`));
        if (restDoc && restDoc.exists()) setRestaurant(restDoc.data() as Restaurant);

        // Fetch Table
        const tableDoc = await getDoc(doc(db, 'tables', tableId)).catch(err => handleFirestoreError(err, OperationType.GET, `tables/${tableId}`));
        if (tableDoc && tableDoc.exists()) setTable(tableDoc.data() as Table);

        // Fetch Menu
        const q = query(collection(db, 'menu'), where('restaurantId', '==', restaurantId));
        const unsubscribe = onSnapshot(q, (snapshot) => {
          setMenu(snapshot.docs.map(doc => doc.data() as MenuItem));
          setLoading(false);
        }, (err) => handleFirestoreError(err, OperationType.GET, 'menu'));

        return () => unsubscribe();
      } catch (error) {
        console.error("Error fetching guest data:", error);
        setLoading(false);
      }
    };

    fetchData();
  }, [restaurantId, tableId]);

  const categories = ['all', ...new Set(menu.map(item => item.category))];

  const filteredMenu = menu.filter(item => {
    const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         item.description?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleCallWaiter = async () => {
    try {
      await addDoc(collection(db, 'notifications'), {
        restaurantId,
        tableId,
        tableNumber: table?.number,
        type: 'call_waiter',
        status: 'pending',
        createdAt: Timestamp.now()
      }).catch(err => handleFirestoreError(err, OperationType.CREATE, 'notifications'));
      showNotification("Келнерот е повикан. Ве молиме почекајте.", 'success');
    } catch (error) {
      console.error("Error calling waiter:", error);
    }
  };

  const handleRequestBill = async () => {
    try {
      await addDoc(collection(db, 'notifications'), {
        restaurantId,
        tableId,
        tableNumber: table?.number,
        type: 'request_bill',
        status: 'pending',
        createdAt: Timestamp.now()
      }).catch(err => handleFirestoreError(err, OperationType.CREATE, 'notifications'));
      showNotification("Барањето за сметка е испратено.", 'success');
    } catch (error) {
      console.error("Error requesting bill:", error);
    }
  };

  const showNotification = (message: string, type: 'success' | 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 pb-32">
      {/* Header */}
      <header className="bg-white p-6 sticky top-0 z-50 border-b border-zinc-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight">{restaurant?.name || t('menu')}</h1>
            <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest">{t('tables')} {table?.number}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-xl border border-zinc-200">
              <button 
                onClick={() => i18n.changeLanguage('mk')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  i18n.language === 'mk' 
                    ? 'bg-white text-zinc-900 shadow-sm' 
                    : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                MK
              </button>
              <button 
                onClick={() => i18n.changeLanguage('en')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  i18n.language === 'en' 
                    ? 'bg-white text-zinc-900 shadow-sm' 
                    : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                EN
              </button>
            </div>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
          <input 
            id="guest-menu-search"
            name="guest-menu-search"
            type="text" 
            placeholder={i18n.language === 'mk' ? "Пребарај јадење..." : "Search menu..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-zinc-100 border-none rounded-xl focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium"
          />
        </div>
      </header>

      {/* Categories */}
      <div className="flex gap-3 overflow-x-auto p-6 no-scrollbar">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-6 py-2 rounded-full font-bold whitespace-nowrap transition-all ${
              activeCategory === cat 
                ? 'bg-zinc-900 text-white shadow-lg shadow-zinc-900/20' 
                : 'bg-white text-zinc-500 border border-zinc-200'
            }`}
          >
            {cat === 'all' ? 'Сите' : cat}
          </button>
        ))}
      </div>

      {/* Menu Items */}
      <div className="px-6 space-y-6">
        {filteredMenu.map((item, i) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white p-4 rounded-3xl border border-zinc-100 shadow-sm flex gap-4 relative overflow-hidden group"
          >
            <div className="w-24 h-24 bg-zinc-100 rounded-2xl flex-shrink-0 overflow-hidden">
              {item.image ? (
                <img src={item.image} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-300">
                  <UtensilsCrossed size={32} />
                </div>
              )}
            </div>
            <div className="flex-1 py-1">
              <div className="flex justify-between items-start mb-1">
                <h3 className="font-black text-lg leading-tight">{item.name}</h3>
                <span className="font-black text-emerald-600">{item.price} ден.</span>
              </div>
              <p className="text-zinc-500 text-sm line-clamp-2 mb-2">{item.description}</p>
              {item.isDailyMenu && (
                <span className="inline-block px-2 py-1 bg-orange-50 text-orange-600 text-[10px] font-black uppercase rounded-lg">
                  {i18n.language === 'mk' ? 'Дневно мени' : 'Daily Menu'}
                </span>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-xl border-t border-zinc-100 flex gap-4 z-50">
        <button 
          onClick={handleCallWaiter}
          className="flex-1 py-4 bg-zinc-900 text-white rounded-2xl font-black flex items-center justify-center gap-3 active:scale-95 transition-all shadow-xl shadow-zinc-900/20"
        >
          <Bell size={20} />
          {i18n.language === 'mk' ? 'ПОВИКАЈ КЕЛНЕР' : 'CALL WAITER'}
        </button>
        <button 
          onClick={handleRequestBill}
          className="flex-1 py-4 bg-white border-2 border-zinc-900 text-zinc-900 rounded-2xl font-black flex items-center justify-center gap-3 active:scale-95 transition-all"
        >
          <Receipt size={20} />
          {i18n.language === 'mk' ? 'БАРАЈ СМЕТКА' : 'REQUEST BILL'}
        </button>
      </div>

      {/* Notifications */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-28 left-6 right-6 z-[100]"
          >
            <div className={`p-4 rounded-2xl shadow-2xl flex items-center gap-3 ${
              notification.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-zinc-900 text-white'
            }`}>
              <CheckCircle size={20} />
              <p className="font-bold">{notification.message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GuestMenu;
