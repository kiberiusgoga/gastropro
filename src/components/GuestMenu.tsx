import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UtensilsCrossed, Bell, Receipt, Search, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface GuestMenuProps {
  restaurantId: string;
  tableId: string;
}

interface PublicMenuItem {
  id: string;
  name: string;
  price: number;
  description?: string;
  image_url?: string;
  menu_category_id?: string;
  category_name?: string;
}

const GuestMenu: React.FC<GuestMenuProps> = ({ restaurantId, tableId }) => {
  const { t, i18n } = useTranslation();
  const [restaurantName, setRestaurantName] = useState('');
  const [menu, setMenu] = useState<PublicMenuItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  useEffect(() => {
    const fetchMenu = async () => {
      try {
        const res = await fetch(`/api/public/menu/${restaurantId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setRestaurantName(data.restaurant?.name || '');
        setMenu(data.items || []);
      } catch (error) {
        console.error('Error fetching guest menu:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchMenu();
  }, [restaurantId]);

  const categories = ['all', ...Array.from(new Set(menu.map(item => item.category_name || ''))).filter(Boolean)];

  const filteredMenu = menu.filter(item => {
    const matchesCategory = activeCategory === 'all' || item.category_name === activeCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.description?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const sendNotification = async (notification_type: 'waiter' | 'bill') => {
    try {
      const res = await fetch(`/api/public/notify/${restaurantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_number: tableId, notification_type }),
      });
      if (res.status === 429) {
        showNotification(i18n.language === 'mk' ? 'Веќе е испратено барање. Почекајте малку.' : 'Already sent. Please wait.', 'info');
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const msg = notification_type === 'waiter'
        ? (i18n.language === 'mk' ? 'Келнерот е повикан. Ве молиме почекајте.' : 'Waiter has been called. Please wait.')
        : (i18n.language === 'mk' ? 'Барањето за сметка е испратено.' : 'Bill request sent.');
      showNotification(msg, 'success');
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  };

  const showNotification = (message: string, type: 'success' | 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base font-sans text-cream pb-32">
      {/* Header */}
      <header className="bg-surface p-6 sticky top-0 z-50 border-b border-warm-line shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-cream">{restaurantName || t('menu')}</h1>
            <p className="text-cream-faint text-sm font-bold uppercase tracking-widest">{t('tables')} {tableId}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-surface-2 rounded-xl border border-warm-line">
              <button
                onClick={() => i18n.changeLanguage('mk')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  i18n.language === 'mk'
                    ? 'bg-surface text-cream shadow-sm'
                    : 'text-cream-faint hover:text-cream-muted'
                }`}
              >
                MK
              </button>
              <button
                onClick={() => i18n.changeLanguage('en')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  i18n.language === 'en'
                    ? 'bg-surface text-cream shadow-sm'
                    : 'text-cream-faint hover:text-cream-muted'
                }`}
              >
                EN
              </button>
            </div>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-cream-faint" size={18} />
          <input
            id="guest-menu-search"
            name="guest-menu-search"
            type="text"
            placeholder={i18n.language === 'mk' ? 'Пребарај јадење...' : 'Search menu...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-warm-input border border-warm-line rounded-xl focus:ring-2 focus:ring-accent/20 text-cream placeholder-cream-faint transition-all font-medium"
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
                ? 'bg-accent text-cream shadow-lg shadow-accent/20'
                : 'bg-surface-2 text-cream-muted border border-warm-line hover:text-cream'
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
            className="bg-surface p-4 rounded-3xl border border-warm-line shadow-card flex gap-4 relative overflow-hidden"
          >
            <div className="w-24 h-24 bg-surface-2 rounded-2xl flex-shrink-0 overflow-hidden">
              {item.image_url ? (
                <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-cream-faint">
                  <UtensilsCrossed size={32} />
                </div>
              )}
            </div>
            <div className="flex-1 py-1">
              <div className="flex justify-between items-start mb-1">
                <h3 className="font-black text-lg leading-tight text-cream">{item.name}</h3>
                <span className="font-black text-accent-light">{item.price} ден.</span>
              </div>
              <p className="text-cream-muted text-sm line-clamp-2">{item.description}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-surface/80 backdrop-blur-xl border-t border-warm-line flex gap-4 z-50">
        <button
          onClick={() => sendNotification('waiter')}
          className="flex-1 py-4 bg-accent text-cream rounded-2xl font-black flex items-center justify-center gap-3 active:scale-95 transition-all shadow-xl shadow-accent/20"
        >
          <Bell size={20} />
          {i18n.language === 'mk' ? 'ПОВИКАЈ КЕЛНЕР' : 'CALL WAITER'}
        </button>
        <button
          onClick={() => sendNotification('bill')}
          className="flex-1 py-4 bg-surface-2 border-2 border-warm-line-strong text-cream rounded-2xl font-black flex items-center justify-center gap-3 active:scale-95 transition-all"
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
              notification.type === 'success' ? 'bg-accent text-cream' : 'bg-surface-2 text-cream border border-warm-line'
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
