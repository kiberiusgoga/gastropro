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

  const menuGroups = [
    {
      title: t('nav_main'),
      items: [
        { id: 'dashboard', icon: LayoutDashboard, label: t('dashboard') },
        { id: 'analytics', icon: BarChart3, label: t('analytics') },
      ]
    },
    {
      title: t('nav_service'),
      items: [
        { id: 'tables', icon: Users, label: t('tables') },
        { id: 'orders', icon: ClipboardList, label: t('orders') },
        { id: 'kitchen', icon: ChefHat, label: t('kitchen') },
        { id: 'menu', icon: UtensilsCrossed, label: t('menu') },
      ]
    },
    {
      title: t('nav_management'),
      items: [
        { id: 'inventory', icon: Package, label: t('inventory') },
        { id: 'staff', icon: UserCog, label: t('staff'), badge: notificationCount > 0 ? notificationCount : undefined },
        { id: 'crm', icon: Heart, label: t('crm') },
        { id: 'billing', icon: CreditCard, label: t('billing') },
        { id: 'settings', icon: Settings, label: t('settings') },
      ]
    }
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

      <div className={`fixed lg:static inset-y-0 left-0 w-72 bg-zinc-950 text-zinc-400 h-screen flex flex-col border-r border-zinc-800/50 shrink-0 z-50 transition-transform duration-300 lg:translate-x-0 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="p-8 flex flex-col h-full">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-4 text-white">
              <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20 ring-4 ring-emerald-500/10">
                <UtensilsCrossed size={28} className="text-zinc-950" />
              </div>
              <div className="flex flex-col">
                <span className="font-black text-2xl tracking-tighter font-display leading-none">GastroPro</span>
                <span className="text-[10px] font-black text-emerald-500 tracking-[0.2em] mt-1">MANAGEMENT</span>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="lg:hidden p-2 text-zinc-500 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <nav className="space-y-8 flex-1 scrollbar-hide overflow-y-auto pr-2 -mr-2">
            {menuGroups.map((group) => (
              <div key={group.title} className="space-y-3">
                <h3 className="px-5 text-[10px] font-black text-zinc-600 tracking-[0.2em] uppercase">{group.title}</h3>
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        onClose();
                      }}
                      className={`group w-full flex items-center justify-between px-5 py-3 rounded-2xl transition-all duration-300 relative ${
                        activeTab === item.id 
                          ? 'bg-zinc-900 text-white shadow-xl shadow-black/20 ring-1 ring-white/5' 
                          : 'hover:bg-zinc-900/30 hover:text-zinc-200'
                      }`}
                    >
                      <div className="flex items-center gap-4 relative z-10">
                        <item.icon size={20} className={`transition-all duration-300 ${activeTab === item.id ? 'text-emerald-400 scale-110' : 'text-zinc-600 group-hover:text-zinc-400'}`} />
                        <span className={`font-bold text-sm tracking-tight ${activeTab === item.id ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`}>
                          {item.label}
                        </span>
                      </div>
                      
                      {activeTab === item.id && (
                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-transparent rounded-2xl" />
                      )}

                      {item.badge && (
                        <span className="relative z-10 bg-emerald-500 text-zinc-950 text-[10px] font-black px-2 py-0.5 rounded-full min-w-[20px] text-center shadow-lg shadow-emerald-500/20">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <div className="mt-8 pt-8 border-t border-zinc-800/50 space-y-4">
            <div className="flex items-center gap-1 p-1.5 bg-zinc-900/50 rounded-2xl border border-zinc-800/50">
              {(['mk', 'en', 'sq'] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => i18n.changeLanguage(lang)}
                  className={`flex-1 flex items-center justify-center py-2 rounded-xl transition-all font-black text-[10px] tracking-widest ${
                    i18n.language === lang
                      ? 'bg-zinc-800 text-emerald-500 shadow-lg'
                      : 'text-zinc-600 hover:text-zinc-400'
                  }`}
                >
                  {lang.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={toggleDarkMode}
                className="flex-1 flex items-center justify-center h-12 bg-zinc-900/50 hover:bg-zinc-900 rounded-2xl transition-all border border-zinc-800/50 group"
                title={isDarkMode ? 'Light Mode' : 'Dark Mode'}
              >
                {isDarkMode ? <Sun size={18} className="text-zinc-500 group-hover:text-yellow-400 transition-colors" /> : <Moon size={18} className="text-zinc-500 group-hover:text-blue-400 transition-colors" />}
              </button>

              <button 
                onClick={onLogout}
                className="flex-1 flex items-center justify-center h-12 bg-zinc-900/50 hover:bg-red-950/20 rounded-2xl transition-all border border-zinc-800/50 group"
                title="Logout"
              >
                <LogOut size={18} className="text-zinc-500 group-hover:text-red-400 transition-colors" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
