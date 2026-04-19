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

      <div className={`fixed lg:static inset-y-0 left-0 w-72 bg-zinc-950 text-zinc-400 h-screen flex flex-col border-r border-zinc-800 shrink-0 z-50 transition-transform duration-300 lg:translate-x-0 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="p-8 flex flex-col h-full">
          <div className="flex items-center justify-between mb-12">
            <div className="flex items-center gap-4 text-white">
              <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20 ring-4 ring-emerald-500/10">
                <UtensilsCrossed size={28} className="text-zinc-950" />
              </div>
              <span className="font-black text-2xl tracking-tighter font-display">GastroPro</span>
            </div>
            <button 
              onClick={onClose}
              className="lg:hidden p-2 text-zinc-500 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <nav className="space-y-2 flex-1 scrollbar-hide overflow-y-auto pr-2 -mr-2">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  onClose();
                }}
                className={`group w-full flex items-center justify-between px-5 py-3.5 rounded-2xl transition-all duration-300 relative overflow-hidden ${
                  activeTab === item.id 
                    ? 'bg-zinc-800/80 text-white shadow-xl shadow-black/20' 
                    : 'hover:bg-zinc-900/50 hover:text-zinc-200'
                }`}
              >
                {activeTab === item.id && (
                  <div className="absolute left-0 top-3 bottom-3 w-1 bg-emerald-500 rounded-r-full" />
                )}
                <div className="flex items-center gap-4 relative z-10">
                  <item.icon size={22} className={`transition-transform duration-300 group-hover:scale-110 ${activeTab === item.id ? 'text-emerald-400' : 'text-zinc-500'}`} />
                  <span className={`font-bold text-sm tracking-tight ${activeTab === item.id ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`}>
                    {item.label}
                  </span>
                </div>
                {item.badge && (
                  <span className="bg-emerald-500 text-zinc-950 text-[10px] font-black px-2 py-0.5 rounded-full min-w-[20px] text-center shadow-lg shadow-emerald-500/20">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="mt-8 pt-8 border-t border-zinc-800 space-y-3">
            <div className="flex items-center gap-2 p-1.5 bg-zinc-900/50 rounded-2xl border border-zinc-800">
              <button 
                onClick={() => i18n.changeLanguage('mk')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all font-black text-xs ${
                  i18n.language === 'mk' 
                    ? 'bg-zinc-800 text-white shadow-lg' 
                    : 'text-zinc-600 hover:text-zinc-400'
                }`}
              >
                MK
              </button>
              <button 
                onClick={() => i18n.changeLanguage('en')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all font-black text-xs ${
                  i18n.language === 'en' 
                    ? 'bg-zinc-800 text-white shadow-lg' 
                    : 'text-zinc-600 hover:text-zinc-400'
                }`}
              >
                EN
              </button>
            </div>

            <button 
              onClick={toggleDarkMode}
              className="flex items-center gap-4 px-5 py-3.5 w-full hover:bg-zinc-900/50 rounded-2xl transition-all group text-zinc-500 hover:text-zinc-200"
            >
              <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center group-hover:bg-zinc-800">
                {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
              </div>
              <span className="font-bold text-sm">{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
            </button>

            <button 
              onClick={onLogout}
              className="flex items-center gap-4 px-5 py-3.5 w-full hover:bg-red-950/20 rounded-2xl transition-all group group-hover:text-red-400"
            >
              <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center group-hover:bg-red-900/20 transition-colors">
                <LogOut size={18} className="text-zinc-500 group-hover:text-red-400" />
              </div>
              <span className="font-bold text-sm text-zinc-500 group-hover:text-red-400">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
