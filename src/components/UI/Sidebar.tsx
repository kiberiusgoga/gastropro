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
  CalendarDays,
  X,
  ArrowRightLeft,
  FileText,
  Clock,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  onLogout: () => void;
  notificationCount?: number;
  stockAlertCount?: number;
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
  stockAlertCount = 0,
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
        { id: 'reservations', icon: CalendarDays, label: t('reservations') },
        { id: 'orders', icon: ClipboardList, label: t('orders') },
        { id: 'kitchen', icon: ChefHat, label: t('kitchen') },
        { id: 'menu', icon: UtensilsCrossed, label: t('menu') },
      ]
    },
    {
      title: t('nav_management'),
      items: [
        { id: 'inventory', icon: Package, label: t('inventory') },
        { id: 'stock', icon: BarChart3, label: t('stock_dashboard'), badge: stockAlertCount > 0 ? stockAlertCount : undefined, badgeVariant: 'rose' as const },
        { id: 'transfers', icon: ArrowRightLeft, label: t('transfers_sidebar') },
        { id: 'staff', icon: UserCog, label: t('staff'), badge: notificationCount > 0 ? notificationCount : undefined, badgeVariant: 'accent' as const },
        { id: 'hr', icon: Clock, label: t('hr_sidebar') },
        { id: 'crm', icon: Heart, label: t('crm') },
        { id: 'b2b-invoices', icon: FileText, label: t('b2b_invoices') },
        { id: 'billing', icon: CreditCard, label: t('billing') },
        { id: 'settings', icon: Settings, label: t('settings') },
      ]
    }
  ];

  return (
    <>
      {/* Mobile Overlay */}
      <div
        className={`fixed inset-0 bg-base/80 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      <div className={`fixed lg:static inset-y-0 left-0 w-[280px] lg:w-72 bg-base text-cream-muted h-full flex flex-col border-r border-warm-line shrink-0 z-50 transition-transform duration-300 lg:translate-x-0 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="p-5 lg:p-8 flex flex-col h-full">
          <div className="flex items-center justify-between mb-6 lg:mb-10">
            <div className="flex items-center gap-4 text-cream">
              <div className="w-12 h-12 bg-accent rounded-2xl flex items-center justify-center shadow-lg shadow-card ring-4 ring-accent/10">
                <UtensilsCrossed size={28} className="text-[#faf5ee]" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-2xl tracking-tight font-serif italic leading-none">GastroPro</span>
                <span className="text-[10px] font-black text-accent-light tracking-[0.2em] mt-1">MANAGEMENT</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="lg:hidden p-2 text-cream-faint hover:text-cream transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <nav className="space-y-5 lg:space-y-8 flex-1 scrollbar-hide overflow-y-auto pr-2 -mr-2">
            {menuGroups.map((group) => (
              <div key={group.title} className="space-y-3">
                <h3 className="px-5 text-[10px] font-black text-cream-faint tracking-[0.2em] uppercase">{group.title}</h3>
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
                          ? 'bg-surface-2 text-cream shadow-card ring-1 ring-warm-line'
                          : 'hover:bg-surface-2/50 hover:text-cream'
                      }`}
                    >
                      <div className="flex items-center gap-4 relative z-10">
                        <item.icon size={20} className={`transition-all duration-300 ${activeTab === item.id ? 'text-accent-light scale-110' : 'text-cream-faint group-hover:text-cream-muted'}`} />
                        <span className={`font-bold text-sm tracking-tight ${activeTab === item.id ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`}>
                          {item.label}
                        </span>
                      </div>

                      {activeTab === item.id && (
                        <div className="absolute inset-0 bg-gradient-to-r from-accent/10 to-transparent rounded-2xl" />
                      )}

                      {item.badge && (
                        <span className={`relative z-10 text-[10px] font-black px-2 py-0.5 rounded-full min-w-[20px] text-center shadow-card ${
                          item.badgeVariant === 'rose'
                            ? 'bg-rose-500 text-white'
                            : 'bg-accent text-[#faf5ee]'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <div className="mt-5 pt-5 lg:mt-8 lg:pt-8 border-t border-warm-line space-y-3 lg:space-y-4">
            <div className="flex items-center gap-1 p-1.5 bg-surface-2/50 rounded-2xl border border-warm-line">
              {(['mk', 'en', 'sq'] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => i18n.changeLanguage(lang)}
                  className={`flex-1 flex items-center justify-center py-2 rounded-xl transition-all font-black text-[10px] tracking-widest ${
                    i18n.language === lang
                      ? 'bg-surface-2 text-accent-light shadow-card'
                      : 'text-cream-faint hover:text-cream-muted'
                  }`}
                >
                  {lang.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleDarkMode}
                className="flex-1 flex items-center justify-center h-12 bg-surface-2/50 hover:bg-surface-2 rounded-2xl transition-all border border-warm-line group"
                title={isDarkMode ? 'Light Mode' : 'Dark Mode'}
              >
                {isDarkMode
                  ? <Sun size={18} className="text-cream-faint group-hover:text-amber-400 transition-colors" />
                  : <Moon size={18} className="text-cream-faint group-hover:text-blue-400 transition-colors" />}
              </button>

              <button
                onClick={onLogout}
                className="flex-1 flex items-center justify-center h-12 bg-surface-2/50 hover:bg-rose-500/10 rounded-2xl transition-all border border-warm-line group"
                title="Logout"
              >
                <LogOut size={18} className="text-cream-faint group-hover:text-rose-400 transition-colors" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
