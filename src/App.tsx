import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Toaster, toast } from 'sonner';
import { StoreProvider } from './store/StoreProvider';
import { useStore } from './store/useStore';
import Sidebar from './components/UI/Sidebar';
import Login from './components/UI/Login';
import Dashboard from './components/Dashboard';
import InventoryShell from './components/Inventory/InventoryShell';
import BillingView from './components/BillingView';
import { SubscriptionDashboard } from './components/Billing/SubscriptionDashboard';
import StaffView from './components/StaffView';
import CustomerCRM from './components/CRM/CustomerCRM';
import MenuList from './components/MenuList';
import POSModule from './components/POS/POSModule';
import ReservationView from './components/POS/ReservationView';
import KitchenDisplay from './components/Kitchen/KitchenDisplay';
import AnalyticsDashboard from './pages/Analytics/AnalyticsDashboard';
import OrdersView from './components/OrdersView';
import SettingsPage from './pages/Settings/SettingsPage';
import StockDashboard from './components/Stock/StockDashboard';
import TransfersPage from './components/Transfers/TransfersPage';
import NonFiscalInvoicesPage from './components/Invoices/NonFiscalInvoicesPage';
import HRPage from './components/HR/HRPage';
import { StockAlertsProvider, useStockAlerts } from './contexts/StockAlertsContext';
import RestaurantSetupWizard from './components/Onboarding/RestaurantSetupWizard';
import ForgotPasswordPage from './pages/Auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/Auth/ResetPasswordPage';
import GuestMenu from './components/GuestMenu';
import { featureFlagService } from './services/featureFlagService';
import { billingService } from './services/billingService';
import { shiftService } from './services/shiftService';
import { WaiterShift } from './types';
import { FeatureFlags } from './types';
import { Menu } from 'lucide-react';

const AppContent = () => {
  const {
    user,
    activeRestaurant,
    employees,
    setRestaurant,
    setUser,
    fetchEmployees,
  } = useStore();

  const { t } = useTranslation();
  const { outOfStockCount, lowStockCount } = useStockAlerts();
  const stockAlertCount = outOfStockCount + lowStockCount;
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    const initial = saved ? saved === 'true' : true; // default dark for Sahara
    document.documentElement.classList.toggle('dark', initial);
    return initial;
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags | null>(null);
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [activeShifts, setActiveShifts] = useState<WaiterShift[]>([]);

  const fetchActiveShifts = async () => {
    const shifts = await shiftService.getAllActiveShifts();
    setActiveShifts(shifts);
  };

  const handleAssignWaiter = async (waiterId: string, initialCash: number) => {
    const result = await shiftService.openShiftForUser(waiterId, initialCash);
    if (result) {
      toast.success('Смената е успешно отворена.');
      await fetchActiveShifts();
    } else {
      toast.error('Грешка при отворање на смената.');
    }
  };

  const handleReleaseWaiter = async (_shiftId: string, _finalCash: number) => {
    await fetchActiveShifts();
  };

  useEffect(() => {
    if (activeTab === 'staff') fetchActiveShifts();
  }, [activeTab]);

  useEffect(() => {
    const fetchSubAndFlags = async () => {
      if (user?.restaurantId) {
        try {
          let sub = await billingService.getSubscription(user.restaurantId);
          if (!sub) {
            sub = await billingService.createTrialSubscription(user.restaurantId);
          }
          if (sub) {
            const flags = await featureFlagService.getFeatureFlags(sub.plan);
            setFeatureFlags({ ...flags, analytics_enabled: true });
          }
        } catch (error) {
          console.error("Error fetching subscription or flags:", error);
        }
      }
    };
    fetchSubAndFlags();
  }, [user?.restaurantId]);

  // Login toast: fire once per session when stock alerts are found after login
  const loginToastShown = useRef(false);
  useEffect(() => {
    if (user && !loginToastShown.current && stockAlertCount > 0) {
      if (!sessionStorage.getItem('alerts_toast_shown')) {
        loginToastShown.current = true;
        sessionStorage.setItem('alerts_toast_shown', '1');
        toast.warning(t('login_stock_alert', { count: stockAlertCount }), {
          action: { label: t('view_stock'), onClick: () => setActiveTab('stock') },
        });
      }
    }
    if (!user) {
      loginToastShown.current = false;
      sessionStorage.removeItem('alerts_toast_shown');
    }
  }, [user, stockAlertCount, t]);

  const path = window.location.pathname;
  if (path === '/forgot-password') return <><Toaster position="top-right" richColors /><ForgotPasswordPage /></>;
  if (path === '/reset-password') return <><Toaster position="top-right" richColors /><ResetPasswordPage /></>;
  if (path.startsWith('/menu/')) {
    const parts = path.split('/').filter(Boolean); // ['menu', restaurantId, tableId?]
    const restaurantId = parts[1] || '';
    const tableId = parts[2] || '1';
    return <GuestMenu restaurantId={restaurantId} tableId={tableId} />;
  }

  if (showSetupWizard || (user && !user.restaurantId)) {
    return (
      <>
        <Toaster position="top-right" richColors />
        <RestaurantSetupWizard onBack={() => setShowSetupWizard(false)} />
      </>
    );
  }

  if (!user) {
    return <Login onNewRestaurant={() => setShowSetupWizard(true)} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'inventory':
        return featureFlags?.inventory_enabled
          ? <InventoryShell />
          : <div className="p-8 text-center text-cream-muted">Модулот за инвентар не е достапен за вашиот план.</div>;
      case 'billing':
        return (
          <div className="space-y-8">
            <BillingView
              restaurant={activeRestaurant}
              onUpgrade={(plan) => {
                if (activeRestaurant) {
                  setRestaurant({ ...activeRestaurant, subscriptionPlan: plan });
                }
              }}
            />
            <SubscriptionDashboard restaurantId={user.restaurantId || 'default'} />
          </div>
        );
      case 'staff':
        return (
          <StaffView
            staff={employees as any}
            shifts={activeShifts}
            onAssignWaiter={handleAssignWaiter}
            onReleaseWaiter={handleReleaseWaiter}
            onAddStaff={fetchEmployees}
          />
        );
      case 'menu':
        return <MenuList />;
      case 'tables':
      case 'pos':
        return <POSModule />;
      case 'reservations':
        return <ReservationView />;
      case 'crm':
        return <CustomerCRM />;
      case 'b2b-invoices':
        return <NonFiscalInvoicesPage />;
      case 'hr':
        return <HRPage />;
      case 'orders':
        return <OrdersView />;
      case 'kitchen':
        return <KitchenDisplay />;
      case 'analytics':
        return <AnalyticsDashboard />;
      case 'stock':
        return <StockDashboard />;
      case 'transfers':
        return <TransfersPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className={`flex h-screen ${isDarkMode ? 'dark' : ''} bg-base transition-colors duration-300`}>
      <Toaster position="top-right" richColors />

      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isDarkMode={isDarkMode}
        toggleDarkMode={() => {
          const next = !isDarkMode;
          setIsDarkMode(next);
          document.documentElement.classList.toggle('dark', next);
          localStorage.setItem('darkMode', String(next));
        }}
        onLogout={() => setUser(null)}
        stockAlertCount={stockAlertCount}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Mobile Header */}
        <header className="lg:hidden h-14 sm:h-16 bg-surface border-b border-warm-line flex items-center justify-between px-4 sm:px-6 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-accent rounded-btn flex items-center justify-center text-[#faf5ee] shadow-card">
              <Menu size={20} strokeWidth={3} />
            </div>
            <span className="font-bold text-xl tracking-tight font-serif italic text-cream">GastroPro</span>
          </div>
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 text-cream-faint hover:bg-surface-2 rounded-xl transition-colors"
          >
            <Menu size={24} />
          </button>
        </header>

        {/* Desktop TopBar */}
        <header className="hidden lg:flex h-20 bg-surface/50 backdrop-blur-md border-b border-warm-line items-center justify-between px-10 shrink-0 relative z-30">
          <div className="flex items-center gap-6">
            <h2 className="text-xl font-bold text-cream font-serif italic">
              {t(activeTab.replace(/-/g, '_'))}
            </h2>
            <div className="h-6 w-[1px] bg-warm-line" />
            <div className="flex items-center gap-2 text-xs font-bold text-cream-faint uppercase tracking-widest">
              <span className="text-accent-light">PRO</span>
              <span>Account</span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end">
              <span className="text-sm font-black text-cream">{user.name}</span>
              <span className="text-[10px] font-bold text-cream-faint uppercase tracking-widest">{user.role}</span>
            </div>
            <div className="w-10 h-10 bg-surface-2 rounded-xl flex items-center justify-center border border-warm-line shadow-card-sm overflow-hidden relative">
              <div className="w-full h-full bg-gradient-to-br from-accent to-accent-light opacity-20 absolute inset-0" />
              <span className="relative font-black text-cream text-xs">{user.name.charAt(0)}</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-10 relative">
          <div className="max-w-7xl mx-auto relative z-10">
            {renderContent()}
          </div>
        </div>
      </main>
    </div>
  );
};

const App = () => (
  <StoreProvider>
    <StockAlertsProvider>
      <AppContent />
    </StockAlertsProvider>
  </StoreProvider>
);

export default App;
