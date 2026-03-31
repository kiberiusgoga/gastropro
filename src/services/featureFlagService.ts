import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  query, 
  where 
} from "firebase/firestore";
import { db } from "../firebase";
import { FeatureFlag, FeatureFlags, Subscription, SubscriptionPlanId } from "../types";

const FEATURE_FLAGS_COLLECTION = "feature_flags";

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
    try {
      const q = query(collection(db, FEATURE_FLAGS_COLLECTION), where("planId", "==", planId));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        // If not found in Firestore, seed it with defaults
        const defaultFlags = DEFAULT_FEATURE_FLAGS[planId];
        await this.seedFeatureFlags(planId, defaultFlags);
        return defaultFlags;
      }
      
      const data = snapshot.docs[0].data() as FeatureFlag;
      return data.flags;
    } catch (error) {
      console.error("Error fetching feature flags:", error);
      return DEFAULT_FEATURE_FLAGS[planId];
    }
  },

  async seedFeatureFlags(planId: SubscriptionPlanId, flags: FeatureFlags): Promise<void> {
    const docId = `flags_${planId}`;
    await setDoc(doc(db, FEATURE_FLAGS_COLLECTION, docId), {
      id: docId,
      planId,
      flags,
    });
  },

  isFeatureEnabled(subscription: Subscription | null, flags: FeatureFlags | null, feature: keyof FeatureFlags): boolean {
    if (!subscription) return false;
    if (!flags) return DEFAULT_FEATURE_FLAGS[subscription.plan][feature];
    return flags[feature];
  },

  async getAllFlags(): Promise<Record<SubscriptionPlanId, FeatureFlags>> {
    const snapshot = await getDocs(collection(db, FEATURE_FLAGS_COLLECTION));
    if (snapshot.empty) {
      // Seed all if empty
      for (const planId of Object.keys(DEFAULT_FEATURE_FLAGS) as SubscriptionPlanId[]) {
        await this.seedFeatureFlags(planId, DEFAULT_FEATURE_FLAGS[planId]);
      }
      return DEFAULT_FEATURE_FLAGS;
    }

    const result: Record<string, FeatureFlags> = {};
    snapshot.docs.forEach(doc => {
      const data = doc.data() as FeatureFlag;
      result[data.planId] = data.flags;
    });
    return result as Record<SubscriptionPlanId, FeatureFlags>;
  }
};
