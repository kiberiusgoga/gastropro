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
        <Loader2 className="w-8 h-8 animate-spin text-accent-light" />
      </div>
    );
  }

  const currentPlan = subscription ? DEFAULT_PLANS.find(p => p.id === subscription.plan) : null;

  return (
    <div className="max-w-5xl mx-auto p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-cream tracking-tight font-serif italic">Billing & Subscription</h1>
          <p className="text-cream-faint mt-1">Manage your restaurant's plan and billing details.</p>
        </div>
        <button
          onClick={() => setShowPlanSelection(!showPlanSelection)}
          className="flex items-center gap-2 px-4 py-2 bg-surface-2 border border-warm-line rounded-xl text-sm font-bold text-cream-muted hover:bg-warm-input transition-all shadow-card-sm"
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
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-surface rounded-3xl border border-warm-line shadow-card overflow-hidden">
              <div className="p-8 border-b border-warm-line bg-surface-2/30">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-accent/10 rounded-2xl flex items-center justify-center">
                      <ShieldCheck className="w-6 h-6 text-accent-light" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-cream">{currentPlan?.name || 'No Active Plan'}</h2>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          subscription?.status === 'active' ? 'bg-emerald-900/20 text-emerald-400' :
                          subscription?.status === 'trialing' ? 'bg-accent/10 text-accent-light' : 'bg-surface-2 text-cream-muted'
                        }`}>
                          {subscription?.status || 'Inactive'}
                        </span>
                        {subscription?.trialEndDate && (
                          <span className="text-xs text-cream-faint">
                            Trial ends {new Date(subscription.trialEndDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black text-cream">${subscription?.price || 0}</div>
                    <div className="text-xs text-cream-faint uppercase font-bold tracking-widest">per month</div>
                  </div>
                </div>
              </div>

              <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-cream-faint uppercase tracking-widest">Plan Limits</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-cream-muted">
                        <Package className="w-4 h-4" />
                        <span>Products</span>
                      </div>
                      <span className="font-bold text-cream">{currentPlan?.limits.maxProducts === 999999 ? 'Unlimited' : currentPlan?.limits.maxProducts || 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-cream-muted">
                        <Users className="w-4 h-4" />
                        <span>Employees</span>
                      </div>
                      <span className="font-bold text-cream">{currentPlan?.limits.maxEmployees === 999999 ? 'Unlimited' : currentPlan?.limits.maxEmployees || 0}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-cream-faint uppercase tracking-widest">Enabled Features</h3>
                  <div className="space-y-3">
                    <div className={`flex items-center gap-2 text-sm ${featureFlags?.inventory_enabled ? 'text-emerald-400' : 'text-cream-faint'}`}>
                      <Package className="w-4 h-4" />
                      <span className={featureFlags?.inventory_enabled ? 'font-medium' : 'line-through'}>Inventory Management</span>
                    </div>
                    <div className={`flex items-center gap-2 text-sm ${featureFlags?.analytics_enabled ? 'text-emerald-400' : 'text-cream-faint'}`}>
                      <BarChart3 className="w-4 h-4" />
                      <span className={featureFlags?.analytics_enabled ? 'font-medium' : 'line-through'}>Advanced Analytics</span>
                    </div>
                    <div className={`flex items-center gap-2 text-sm ${featureFlags?.delivery_enabled ? 'text-emerald-400' : 'text-cream-faint'}`}>
                      <Truck className="w-4 h-4" />
                      <span className={featureFlags?.delivery_enabled ? 'font-medium' : 'line-through'}>Delivery Management</span>
                    </div>
                    <div className={`flex items-center gap-2 text-sm ${featureFlags?.multi_restaurant_enabled ? 'text-emerald-400' : 'text-cream-faint'}`}>
                      <Globe className="w-4 h-4" />
                      <span className={featureFlags?.multi_restaurant_enabled ? 'font-medium' : 'line-through'}>Multi-Restaurant Support</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-surface rounded-3xl border border-warm-line shadow-card p-8">
              <h3 className="text-lg font-bold text-cream mb-6">Billing History</h3>
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <div key={i} className="flex items-center justify-between py-4 border-b border-warm-line/50 last:border-0">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-surface-2 rounded-xl flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-cream-faint" />
                      </div>
                      <div>
                        <div className="font-bold text-cream">Invoice #INV-00{i}</div>
                        <div className="text-xs text-cream-faint">March {i}, 2026</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="font-bold text-cream">${subscription?.price || 0}</div>
                      <button className="text-accent-light text-sm font-bold hover:underline">Download</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-accent text-[#faf5ee] rounded-3xl p-8 shadow-card-lg">
              <CreditCard className="w-8 h-8 mb-4 opacity-80" />
              <h3 className="text-xl font-bold mb-2">Payment Method</h3>
              <p className="text-[#faf5ee]/70 text-sm mb-6">Visa ending in 4242</p>
              <button className="w-full py-3 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-bold transition-all">
                Update Card
              </button>
            </div>

            <div className="bg-amber-900/20 border border-amber-800/30 rounded-3xl p-6 flex gap-4">
              <AlertCircle className="w-6 h-6 text-amber-400 shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-amber-300">Next Payment</h4>
                <p className="text-xs text-amber-400/80 mt-1">Your next payment of ${subscription?.price || 0} is due on April 30, 2026.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
