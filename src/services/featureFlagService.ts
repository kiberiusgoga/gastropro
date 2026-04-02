import { FeatureFlags, Subscription, SubscriptionPlanId } from '../types';

export const DEFAULT_FEATURE_FLAGS: Record<SubscriptionPlanId, FeatureFlags> = {
  starter: {
    inventory_enabled: true,
    analytics_enabled: false,
    delivery_enabled: false,
    multi_restaurant_enabled: false,
  },
  professional: {
    inventory_enabled: true,
    analytics_enabled: true,
    delivery_enabled: true,
    multi_restaurant_enabled: false,
  },
  enterprise: {
    inventory_enabled: true,
    analytics_enabled: true,
    delivery_enabled: true,
    multi_restaurant_enabled: true,
  },
};

export const featureFlagService = {
  async getFeatureFlags(planId: SubscriptionPlanId): Promise<FeatureFlags> {
    // Feature flags are derived from the plan. No need for a DB lookup —
    // they're static config that maps plan → capabilities.
    return DEFAULT_FEATURE_FLAGS[planId] || DEFAULT_FEATURE_FLAGS.starter;
  },

  async seedFeatureFlags(_planId: SubscriptionPlanId, _flags: FeatureFlags): Promise<void> {
    // No-op: feature flags are now derived from the plan definition, not stored in DB.
    // Kept for API compatibility with callers.
  },

  isFeatureEnabled(subscription: Subscription | null, flags: FeatureFlags | null, feature: keyof FeatureFlags): boolean {
    if (!subscription) return false;
    if (!flags) return DEFAULT_FEATURE_FLAGS[subscription.plan]?.[feature] ?? false;
    return flags[feature];
  },

  async getAllFlags(): Promise<Record<SubscriptionPlanId, FeatureFlags>> {
    return DEFAULT_FEATURE_FLAGS;
  }
};
