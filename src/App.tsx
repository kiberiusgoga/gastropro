import React, { useState, useEffect } from 'react';
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

        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="max-w-7xl mx-auto">
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
