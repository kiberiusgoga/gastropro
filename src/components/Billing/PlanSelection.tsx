import React, { useState } from "react";
import { Check, Loader2, Zap } from "lucide-react";
import { billingService, DEFAULT_PLANS } from "../../services/billingService";
import { Subscription, SubscriptionPlanId } from "../../types";
import { toast } from "sonner";

interface PlanSelectionProps {
  restaurantId: string;
  currentSubscription: Subscription | null;
  onPlanSelected: (subscription: Subscription) => void;
}

export const PlanSelection: React.FC<PlanSelectionProps> = ({ 
  restaurantId, 
  currentSubscription,
  onPlanSelected 
}) => {
  const [loading, setLoading] = useState<string | null>(null);
  const plans = DEFAULT_PLANS;

  const handleSelectPlan = async (planId: SubscriptionPlanId) => {
    setLoading(planId);
    try {
      if (currentSubscription) {
        await billingService.upgradePlan(currentSubscription.id, planId);
        const updated = await billingService.getSubscription(restaurantId);
        if (updated) onPlanSelected(updated);
        toast.success(`Successfully upgraded to ${planId} plan!`);
      } else {
        const sub = await billingService.createTrialSubscription(restaurantId, planId);
        onPlanSelected(sub);
        toast.success(`Started 14-day trial for ${planId} plan!`);
      }
    } catch (error) {
      console.error("Error selecting plan:", error);
      toast.error("Failed to update plan. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-8">
      {plans.map((plan) => {
        const isCurrent = currentSubscription?.plan === plan.id;
        const isUpgrade = currentSubscription && 
          plans.findIndex(p => p.id === plan.id) > plans.findIndex(p => p.id === currentSubscription.plan);

        return (
          <div 
            key={plan.id}
            className={`relative flex flex-col p-6 bg-white rounded-2xl border-2 transition-all duration-300 ${
              isCurrent ? 'border-primary shadow-lg scale-105 z-10' : 'border-gray-100 hover:border-gray-200'
            }`}
          >
            {plan.id === 'professional' && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-white px-4 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                <Zap className="w-3 h-3 fill-current" />
                Most Popular
              </div>
            )}

            <div className="mb-8">
              <h3 className="text-xl font-bold text-gray-900 mb-2">{plan.name}</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black text-gray-900">${plan.price}</span>
                <span className="text-gray-500">/month</span>
              </div>
            </div>

            <ul className="flex-1 space-y-4 mb-8">
              {plan.features.map((feature, idx) => (
                <li key={idx} className="flex items-start gap-3 text-sm text-gray-600">
                  <div className="mt-1 bg-green-100 rounded-full p-0.5">
                    <Check className="w-3 h-3 text-green-600" />
                  </div>
                  {feature}
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleSelectPlan(plan.id)}
              disabled={isCurrent || loading !== null}
              className={`w-full py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                isCurrent 
                  ? 'bg-gray-100 text-gray-400 cursor-default' 
                  : 'bg-primary text-white hover:bg-primary/90 active:scale-95'
              }`}
            >
              {loading === plan.id ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isCurrent ? (
                'Current Plan'
              ) : currentSubscription ? (
                isUpgrade ? 'Upgrade Now' : 'Downgrade'
              ) : (
                'Start Free Trial'
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
};
