import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  addDoc
} from "firebase/firestore";
import { db } from "../firebase";
import { Plan, Subscription, SubscriptionPlanId } from "../types";

const PLANS_COLLECTION = "plans";
const SUBSCRIPTIONS_COLLECTION = "subscriptions";

export const DEFAULT_PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    price: 29,
    features: ["Up to 50 products", "Up to 5 employees", "Basic reporting"],
    limits: {
      maxProducts: 50,
      maxEmployees: 5,
      hasAnalytics: false,
      hasDelivery: false,
    },
  },
  {
    id: "professional",
    name: "Professional",
    price: 79,
    features: ["Up to 200 products", "Up to 20 employees", "Advanced analytics", "Delivery management"],
    limits: {
      maxProducts: 200,
      maxEmployees: 20,
      hasAnalytics: true,
      hasDelivery: true,
    },
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 199,
    features: ["Unlimited products", "Unlimited employees", "Custom reporting", "Priority support"],
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
    const snapshot = await getDocs(collection(db, PLANS_COLLECTION));
    if (snapshot.empty) {
      // Seed plans if they don't exist
      for (const plan of DEFAULT_PLANS) {
        await setDoc(doc(db, PLANS_COLLECTION, plan.id), plan);
      }
      return DEFAULT_PLANS;
    }
    return snapshot.docs.map(doc => doc.data() as Plan);
  },

  async getSubscription(restaurantId: string): Promise<Subscription | null> {
    const q = query(collection(db, SUBSCRIPTIONS_COLLECTION), where("restaurantId", "==", restaurantId));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return snapshot.docs[0].data() as Subscription;
  },

  async createTrialSubscription(restaurantId: string, planId: SubscriptionPlanId = "starter"): Promise<Subscription> {
    const plan = DEFAULT_PLANS.find(p => p.id === planId) || DEFAULT_PLANS[0];
    const startDate = new Date();
    const trialEndDate = new Date();
    trialEndDate.setDate(startDate.getDate() + 14); // 14 days trial

    const subscription: Omit<Subscription, "id"> = {
      restaurantId,
      plan: plan.id,
      price: plan.price,
      billingCycle: "monthly",
      status: "trialing",
      startDate: startDate.toISOString(),
      endDate: trialEndDate.toISOString(),
      trialEndDate: trialEndDate.toISOString(),
    };

    const docRef = await addDoc(collection(db, SUBSCRIPTIONS_COLLECTION), subscription);
    await updateDoc(docRef, { id: docRef.id });
    
    return { ...subscription, id: docRef.id } as Subscription;
  },

  async upgradePlan(subscriptionId: string, newPlanId: SubscriptionPlanId): Promise<void> {
    const plan = DEFAULT_PLANS.find(p => p.id === newPlanId);
    if (!plan) throw new Error("Invalid plan ID");

    await updateDoc(doc(db, SUBSCRIPTIONS_COLLECTION, subscriptionId), {
      plan: plan.id,
      price: plan.price,
      status: "active",
      // In a real app, we'd handle proration and payment here
    });
  },

  async cancelSubscription(subscriptionId: string): Promise<void> {
    await updateDoc(doc(db, SUBSCRIPTIONS_COLLECTION, subscriptionId), {
      status: "canceled",
    });
  },

  checkFeatureAccess(subscription: Subscription | null, feature: keyof Plan["limits"]): boolean {
    if (!subscription) return false;
    const plan = DEFAULT_PLANS.find(p => p.id === subscription.plan);
    if (!plan) return false;
    
    const limit = plan.limits[feature];
    if (typeof limit === "boolean") return limit;
    return true; // If it's a numeric limit, we handle it elsewhere (e.g. checkCount)
  },

  async canAddProduct(restaurantId: string): Promise<boolean> {
    const sub = await this.getSubscription(restaurantId);
    if (!sub) return false;
    const plan = DEFAULT_PLANS.find(p => p.id === sub.plan);
    if (!plan) return false;

    const q = query(collection(db, "products"), where("restaurantId", "==", restaurantId));
    const snapshot = await getDocs(q);
    return snapshot.size < plan.limits.maxProducts;
  }
};
