import React from 'react';
import { 
  LayoutDashboard, 
  UtensilsCrossed, 
  ClipboardList, 
  Settings, 
  LogOut,
  Users,
  Package,
  UserCog,
  ChefHat,
  BarChart3,
  Heart,
  Moon,
  Sun,
  CreditCard,
  X
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  onLogout: () => void;
  notificationCount?: number;
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab, 
  isDarkMode, 
  toggleDarkMode, 
  onLogout,
  notificationCount = 0,
  isOpen,
  onClose
}) => {
  const { t, i18n } = useTranslation();

  const menuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: t('dashboard') },
    { id: 'tables', icon: Users, label: t('tables') },
    { id: 'menu', icon: UtensilsCrossed, label: t('menu') },
    { id: 'orders', icon: ClipboardList, label: t('orders') },
    { id: 'kitchen', icon: ChefHat, label: t('kitchen') },
    { id: 'inventory', icon: Package, label: t('inventory') },
    { id: 'staff', icon: UserCog, label: t('staff'), badge: notificationCount > 0 ? notificationCount : undefined },
    { id: 'analytics', icon: BarChart3, label: t('analytics') },
    { id: 'crm', icon: Heart, label: t('crm') },
    { id: 'billing', icon: CreditCard, label: i18n.language === 'mk' ? 'Претплата' : 'Billing' },
    { id: 'settings', icon: Settings, label: t('settings') },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      <div 
        className={`fixed inset-0 bg-zinc-950/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      <div className={`fixed lg:static inset-y-0 left-0 w-64 bg-zinc-950 text-zinc-400 h-screen flex flex-col border-r border-zinc-800 shrink-0 z-50 transition-transform duration-300 lg:translate-x-0 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="p-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3 text-white">
              <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-900/20">
                <UtensilsCrossed size={24} />
              </div>
              <span className="font-bold text-xl tracking-tight">GastroPro</span>
            </div>
            <button 
              onClick={onClose}
              className="lg:hidden p-2 text-zinc-500 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <nav className="space-y-1">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  onClose();
                }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200 ${
                  activeTab === item.id 
                    ? 'bg-zinc-800 text-white shadow-sm' 
                    : 'hover:bg-zinc-900 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <item.icon size={20} />
                  <span className="font-medium">{item.label}</span>
                </div>
                {item.badge && (
                  <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center animate-pulse">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

      <div className="mt-auto p-6 border-t border-zinc-800 space-y-2">
        <button 
          onClick={toggleDarkMode}
          className="flex items-center gap-3 px-4 py-3 w-full hover:bg-zinc-900 rounded-lg transition-colors"
        >
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          <span className="font-medium">{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
        </button>

        <div className="flex items-center gap-1 p-1 bg-zinc-900 rounded-xl border border-zinc-800">
          <button 
            onClick={() => i18n.changeLanguage('mk')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-all ${
              i18n.language === 'mk' 
                ? 'bg-zinc-800 text-white shadow-sm' 
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <span className="text-xs font-bold">MK</span>
          </button>
          <button 
            onClick={() => i18n.changeLanguage('en')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-all ${
              i18n.language === 'en' 
                ? 'bg-zinc-800 text-white shadow-sm' 
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <span className="text-xs font-bold">EN</span>
          </button>
        </div>

        <button 
          onClick={onLogout}
          className="flex items-center gap-3 px-4 py-3 w-full hover:text-red-400 transition-colors"
        >
          <LogOut size={20} />
          <span className="font-medium">{t('logout')}</span>
        </button>
      </div>
    </div>
    </>
  );
};

export default Sidebar;
