import apiClient from '../lib/apiClient';
import { Plan, Subscription, SubscriptionPlanId } from '../types';

export const DEFAULT_PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 29,
    features: ['Up to 50 products', 'Up to 5 employees', 'Basic reporting'],
    limits: {
      maxProducts: 50,
      maxEmployees: 5,
      hasAnalytics: false,
      hasDelivery: false,
    },
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 79,
    features: ['Up to 200 products', 'Up to 20 employees', 'Advanced analytics', 'Delivery management'],
    limits: {
      maxProducts: 200,
      maxEmployees: 20,
      hasAnalytics: true,
      hasDelivery: true,
    },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 199,
    features: ['Unlimited products', 'Unlimited employees', 'Custom reporting', 'Priority support'],
    limits: {
      maxProducts: 999999,
      maxEmployees: 999999,
      hasAnalytics: true,
      hasDelivery: true,
    },
  },
];

export const billingService = {
  async getPlans(): Promise<Plan[]> {
    // Plans are static / hardcoded for now. 
    // In a real SaaS, these would come from a Stripe API or a plans table.
    return DEFAULT_PLANS;
  },

  async getSubscription(restaurantId?: string): Promise<Subscription | null> {
    try {
      const response = await apiClient.get('/subscriptions');
      if (!response.data || response.data.length === 0) return null;
      const row = response.data[0];
      return {
        id: row.id,
        restaurantId: row.restaurant_id,
        plan: row.plan as SubscriptionPlanId,
        price: Number(row.price),
        billingCycle: row.billing_cycle,
        status: row.status,
        startDate: row.start_date,
        endDate: row.end_date,
        trialEndDate: row.trial_end_date
      };
    } catch (error) {
      console.error('Error fetching subscription:', error);
      return null;
    }
  },

  async createTrialSubscription(restaurantId?: string, planId: SubscriptionPlanId = 'starter'): Promise<Subscription> {
    const plan = DEFAULT_PLANS.find(p => p.id === planId) || DEFAULT_PLANS[0];
    const startDate = new Date();
    const trialEndDate = new Date();
    trialEndDate.setDate(startDate.getDate() + 14);

    try {
      const response = await apiClient.post('/subscriptions', {
        plan: plan.id,
        price: plan.price,
        billing_cycle: 'monthly',
        status: 'trialing',
        start_date: startDate.toISOString(),
        end_date: trialEndDate.toISOString(),
        trial_end_date: trialEndDate.toISOString()
      });
      const row = response.data;
      return {
        id: row.id,
        restaurantId: row.restaurant_id,
        plan: row.plan as SubscriptionPlanId,
        price: Number(row.price),
        billingCycle: row.billing_cycle,
        status: row.status,
        startDate: row.start_date,
        endDate: row.end_date,
        trialEndDate: row.trial_end_date
      };
    } catch (error) {
      console.error('Error creating trial subscription:', error);
      // Fallback: return a local object so the UI doesn't crash
      return {
        id: `trial_${Date.now()}`,
        restaurantId: restaurantId || '',
        plan: plan.id,
        price: plan.price,
        billingCycle: 'monthly',
        status: 'trialing',
        startDate: startDate.toISOString(),
        endDate: trialEndDate.toISOString(),
        trialEndDate: trialEndDate.toISOString(),
      };
    }
  },

  async upgradePlan(subscriptionId: string, newPlanId: SubscriptionPlanId): Promise<void> {
    const plan = DEFAULT_PLANS.find(p => p.id === newPlanId);
    if (!plan) throw new Error('Invalid plan ID');

    try {
      await apiClient.put(`/subscriptions/${subscriptionId}`, {
        plan: plan.id,
        price: plan.price,
        status: 'active'
      });
    } catch (error) {
      console.error('Error upgrading plan:', error);
      throw error;
    }
  },

  async cancelSubscription(subscriptionId: string): Promise<void> {
    try {
      await apiClient.put(`/subscriptions/${subscriptionId}`, {
        status: 'canceled'
      });
    } catch (error) {
      console.error('Error canceling subscription:', error);
      throw error;
    }
  },

  checkFeatureAccess(subscription: Subscription | null, feature: keyof Plan['limits']): boolean {
    if (!subscription) return false;
    const plan = DEFAULT_PLANS.find(p => p.id === subscription.plan);
    if (!plan) return false;

    const limit = plan.limits[feature];
    if (typeof limit === 'boolean') return limit;
    return true;
  },

  async canAddProduct(restaurantId?: string): Promise<boolean> {
    const sub = await this.getSubscription(restaurantId);
    if (!sub) return false;
    const plan = DEFAULT_PLANS.find(p => p.id === sub.plan);
    if (!plan) return false;

    try {
      const response = await apiClient.get('/products');
      return response.data.length < plan.limits.maxProducts;
    } catch {
      return false;
    }
  }
};
