import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Toaster } from 'sonner';
import { StoreProvider } from './store/StoreProvider';
import { useStore } from './store/useStore';
import Sidebar from './components/UI/Sidebar';
import Login from './components/UI/Login';
import Dashboard from './components/Dashboard';
import InventoryView from './components/InventoryView';
import BillingView from './components/BillingView';
import { SubscriptionDashboard } from './components/Billing/SubscriptionDashboard';
import StaffView from './components/StaffView';
import CustomerCRM from './components/CRM/CustomerCRM';
import MenuList from './components/MenuList';
import POSModule from './components/POS/POSModule';
import KitchenDisplay from './components/Kitchen/KitchenDisplay';
import AnalyticsDashboard from './pages/Analytics/AnalyticsDashboard';
import OrdersView from './components/OrdersView';
import RestaurantSetupWizard from './components/Onboarding/RestaurantSetupWizard';
import { featureFlagService } from './services/featureFlagService';
import { billingService } from './services/billingService';
import { FeatureFlags } from './types';
import { Menu } from 'lucide-react';

const AppContent = () => {
  const { 
    user, 
    activeRestaurant, 
    employees,
    setRestaurant,
    setUser
  } = useStore();
  
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags | null>(null);

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
            // Force enable analytics for demo purposes
            setFeatureFlags({ ...flags, analytics_enabled: true });
          }
        } catch (error) {
          console.error("Error fetching subscription or flags:", error);
        }
      }
    };
    fetchSubAndFlags();
  }, [user?.restaurantId]);

  if (!user) {
    return <Login />;
  }

  if (!user.restaurantId) {
    return (
      <>
        <Toaster position="top-right" richColors />
        <RestaurantSetupWizard />
      </>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'inventory':
        return featureFlags?.inventory_enabled ? <InventoryView /> : <div className="p-8 text-center">Модулот за инвентар не е достапен за вашиот план.</div>;
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
            staff={employees} 
            shifts={[]} 
            onAssignWaiter={() => {}} 
            onReleaseWaiter={() => {}} 
            onAddStaff={() => {}} 
          />
        );
      case 'menu':
        return <MenuList />;
      case 'tables':
      case 'pos':
        return <POSModule />;
      case 'crm':
        return <CustomerCRM />;
      case 'orders':
        return <OrdersView />;
      case 'kitchen':
        return <KitchenDisplay />;
      case 'analytics':
        return <AnalyticsDashboard />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className={`flex h-screen ${isDarkMode ? 'dark' : ''} bg-white dark:bg-zinc-950 transition-colors duration-300`}>
      <Toaster position="top-right" richColors />
      
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
        isDarkMode={isDarkMode}
        toggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        onLogout={() => setUser(null)}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Mobile Header */}
        <header className="lg:hidden h-20 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-zinc-950 shadow-lg shadow-emerald-500/10">
              <Menu size={20} strokeWidth={3} />
            </div>
            <span className="font-black text-xl tracking-tighter font-display uppercase italic dark:text-white">GastroPro</span>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
          >
            <Menu size={24} />
          </button>
        </header>

        {/* Desktop TopBar */}
        <header className="hidden lg:flex h-20 bg-white/50 dark:bg-zinc-950/50 backdrop-blur-md border-b border-zinc-100 dark:border-zinc-800/50 items-center justify-between px-10 shrink-0 relative z-30">
          <div className="flex items-center gap-6">
            <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">
              {t(activeTab)}
            </h2>
            <div className="h-6 w-[1px] bg-zinc-200 dark:bg-zinc-800" />
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-500 uppercase tracking-widest">
              <span className="text-emerald-500">PRO</span>
              <span>Account</span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end">
              <span className="text-sm font-black text-zinc-900 dark:text-zinc-100">{user.name}</span>
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{user.role}</span>
            </div>
            <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center border border-zinc-200 dark:border-zinc-700 shadow-sm overflow-hidden">
               <div className="w-full h-full bg-gradient-to-br from-emerald-400 to-blue-500 opacity-20" />
               <span className="absolute font-black text-zinc-600 dark:text-zinc-300 text-xs">{user.name.charAt(0)}</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 lg:p-10 relative">
          {/* Subtle Background Pattern */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05]" 
               style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)', backgroundSize: '32px 32px' }} />
          
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
    <AppContent />
  </StoreProvider>
);

export default App;
