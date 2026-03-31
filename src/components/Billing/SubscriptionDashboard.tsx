import React, { useState, useEffect } from "react";
import { 
  CreditCard, 
  Calendar, 
  ShieldCheck, 
  AlertCircle, 
  Loader2, 
  Settings, 
  Package, 
  Users, 
  BarChart3, 
  Truck,
  Globe
} from "lucide-react";
import { billingService, DEFAULT_PLANS } from "../../services/billingService";
import { featureFlagService } from "../../services/featureFlagService";
import { Subscription, FeatureFlags } from "../../types";
import { PlanSelection } from "./PlanSelection";

interface SubscriptionDashboardProps {
  restaurantId: string;
}

export const SubscriptionDashboard: React.FC<SubscriptionDashboardProps> = ({ restaurantId }) => {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPlanSelection, setShowPlanSelection] = useState(false);

  useEffect(() => {
    const fetchSubscriptionAndFlags = async () => {
      setLoading(true);
      try {
        const sub = await billingService.getSubscription(restaurantId);
        setSubscription(sub);
        if (sub) {
          const flags = await featureFlagService.getFeatureFlags(sub.plan);
          setFeatureFlags(flags);
        }
      } catch (error) {
        console.error("Error fetching subscription:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscriptionAndFlags();
  }, [restaurantId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentPlan = subscription ? DEFAULT_PLANS.find(p => p.id === subscription.plan) : null;

  return (
    <div className="max-w-5xl mx-auto p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Billing & Subscription</h1>
          <p className="text-gray-500 mt-1">Manage your restaurant's plan and billing details.</p>
        </div>
        <button 
          onClick={() => setShowPlanSelection(!showPlanSelection)}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all shadow-sm"
        >
          <Settings className="w-4 h-4" />
          {showPlanSelection ? 'Back to Dashboard' : 'Change Plan'}
        </button>
      </div>

      {showPlanSelection ? (
        <PlanSelection 
          restaurantId={restaurantId} 
          currentSubscription={subscription}
          onPlanSelected={(sub) => {
            setSubscription(sub);
            setShowPlanSelection(false);
          }}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Subscription Card */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-8 border-b border-gray-50 bg-gray-50/30">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                      <ShieldCheck className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">{currentPlan?.name || 'No Active Plan'}</h2>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          subscription?.status === 'active' ? 'bg-green-100 text-green-700' : 
                          subscription?.status === 'trialing' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {subscription?.status || 'Inactive'}
                        </span>
                        {subscription?.trialEndDate && (
                          <span className="text-xs text-gray-500">
                            Trial ends {new Date(subscription.trialEndDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black text-gray-900">${subscription?.price || 0}</div>
                    <div className="text-xs text-gray-500 uppercase font-bold tracking-widest">per month</div>
                  </div>
                </div>
              </div>

              <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Plan Limits</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Package className="w-4 h-4" />
                        <span>Products</span>
                      </div>
                      <span className="font-bold text-gray-900">{currentPlan?.limits.maxProducts === 999999 ? 'Unlimited' : currentPlan?.limits.maxProducts || 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Users className="w-4 h-4" />
                        <span>Employees</span>
                      </div>
                      <span className="font-bold text-gray-900">{currentPlan?.limits.maxEmployees === 999999 ? 'Unlimited' : currentPlan?.limits.maxEmployees || 0}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Enabled Features</h3>
                  <div className="space-y-3">
                    <div className={`flex items-center gap-2 text-sm ${featureFlags?.inventory_enabled ? 'text-green-600' : 'text-gray-300'}`}>
                      <Package className="w-4 h-4" />
                      <span className={featureFlags?.inventory_enabled ? 'font-medium' : 'line-through'}>Inventory Management</span>
                    </div>
                    <div className={`flex items-center gap-2 text-sm ${featureFlags?.analytics_enabled ? 'text-green-600' : 'text-gray-300'}`}>
                      <BarChart3 className="w-4 h-4" />
                      <span className={featureFlags?.analytics_enabled ? 'font-medium' : 'line-through'}>Advanced Analytics</span>
                    </div>
                    <div className={`flex items-center gap-2 text-sm ${featureFlags?.delivery_enabled ? 'text-green-600' : 'text-gray-300'}`}>
                      <Truck className="w-4 h-4" />
                      <span className={featureFlags?.delivery_enabled ? 'font-medium' : 'line-through'}>Delivery Management</span>
                    </div>
                    <div className={`flex items-center gap-2 text-sm ${featureFlags?.multi_restaurant_enabled ? 'text-green-600' : 'text-gray-300'}`}>
                      <Globe className="w-4 h-4" />
                      <span className={featureFlags?.multi_restaurant_enabled ? 'font-medium' : 'line-through'}>Multi-Restaurant Support</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Billing History Placeholder */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
              <h3 className="text-lg font-bold text-gray-900 mb-6">Billing History</h3>
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <div key={i} className="flex items-center justify-between py-4 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-gray-400" />
                      </div>
                      <div>
                        <div className="font-bold text-gray-900">Invoice #INV-00{i}</div>
                        <div className="text-xs text-gray-500">March {i}, 2026</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="font-bold text-gray-900">${subscription?.price || 0}</div>
                      <button className="text-primary text-sm font-bold hover:underline">Download</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar Cards */}
          <div className="space-y-6">
            <div className="bg-primary text-white rounded-3xl p-8 shadow-lg shadow-primary/20">
              <CreditCard className="w-8 h-8 mb-4 opacity-80" />
              <h3 className="text-xl font-bold mb-2">Payment Method</h3>
              <p className="text-primary-foreground/80 text-sm mb-6">Visa ending in 4242</p>
              <button className="w-full py-3 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-bold transition-all">
                Update Card
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-3xl p-6 flex gap-4">
              <AlertCircle className="w-6 h-6 text-amber-600 shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-amber-900">Next Payment</h4>
                <p className="text-xs text-amber-700 mt-1">Your next payment of ${subscription?.price || 0} is due on April 30, 2026.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
