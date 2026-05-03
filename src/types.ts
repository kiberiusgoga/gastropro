export type UserRole = 'SuperAdmin' | 'Admin' | 'Manager' | 'Warehouse Worker' | 'Waiter' | 'Chef' | 'Cashier' | 'Driver';
export type OrderPriority = 'normal' | 'rush' | 'VIP';
export type PreparationStation = 'kitchen' | 'bar' | 'grill' | 'dessert' | 'salad';

export interface Restaurant {
  id: string;
  name: string;
  address: string;
  ownerId: string;
  subscriptionPlan: 'basic' | 'pro' | 'enterprise';
  createdAt: string;
  active: boolean;
  settings?: {
    currency: string;
    timezone: string;
    logo?: string;
  };
}

export type DiscountType = 'percentage' | 'fixed' | 'promotion';

export interface Discount {
  id: string;
  restaurantId: string;
  name: string;
  type: DiscountType;
  value: number;
  requiresManagerApproval: boolean;
  active: boolean;
}

export interface User {
  id: string;
  restaurantId?: string; // Optional for SuperAdmin
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  createdAt?: string;
  permissions?: string[];
  salary?: number;
}

export interface Employee extends User {
  phone?: string;
  shiftHistory?: string[];
}

export type StaffRole = 'waiter' | 'Admin' | 'manager' | 'chef' | 'bartender' | 'cashier';

export interface StaffPermissions {
  canTransferTable: boolean;
  canDeleteOrder: boolean;
  canSeeReports: boolean;
  canApplyDiscount: boolean;
  canVoidItems: boolean;
  canSeeClosedBills?: boolean;
  canTakeOrder?: boolean;
  canProcessPayment?: boolean;
}

export interface Staff {
  id: string;
  restaurantId: string;
  name: string;
  email: string;
  role: StaffRole;
  pin: string;
  permissions: StaffPermissions;
  active: boolean;
  status: 'active' | 'on_break' | 'off';
}

export interface WaiterShift {
  id: string;
  restaurantId: string;
  waiterId: string;
  waiterName: string;
  startTime: string;
  endTime?: string;
  initialCash: number;
  finalCash?: number;
  totalSales?: number;
  status: 'open' | 'closed';
}

export interface Shift {
  id: string;
  restaurantId: string;
  userId: string;
  userName: string;
  startTime: string;
  endTime?: string;
  startingCash: number;
  endingCash?: number;
  status: 'open' | 'closed';
  totalSales: number;
}

export interface MenuCategory {
  id: string;
  restaurantId: string;
  name: string;
  sortOrder: number;
  active?: boolean;
  type?: 'system' | 'custom';
  icon?: string;
  color?: string;
  itemCount?: number;
  nameTranslations?: { mk?: string; en?: string; sq?: string };
}

export interface Category {
  id: string;
  restaurantId: string;
  name: string;
  active: boolean;
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  name: string;
  description?: string;
  price: number;
  displayedPrice?: number;
  menuCategoryId: string;
  categoryIds?: string[];
  categoryName?: string;
  bundleId?: string;
  imageUrl?: string;
  active: boolean;
  available: boolean;
  preparationStation?: PreparationStation;
}

export interface Customer {
  id: string;
  restaurantId: string;
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
  totalSpent: number;
  orderHistory: string[]; // Order IDs
  loyaltyPoints?: number;
  lastVisit?: string;
}

export interface Reservation {
  id: string;
  restaurantId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  tableId: string;
  tableNumber: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  numberOfGuests: number;
  notes?: string;
  status: 'reserved' | 'arrived' | 'cancelled' | 'completed';
  createdAt: string;
}

export interface Delivery {
  id: string;
  restaurantId: string;
  orderId: string;
  driverId?: string;
  status: 'preparing' | 'ready' | 'out_for_delivery' | 'delivered';
  address: string;
  phone: string;
  fee: number;
  estimatedTime?: string;
  actualDeliveryTime?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Driver {
  id: string;
  restaurantId: string;
  name: string;
  phone: string;
  status: 'available' | 'busy' | 'offline';
  currentOrderId?: string;
  active: boolean;
}

export interface Supplier {
  id: string;
  restaurantId: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  active: boolean;
}

export interface PurchaseOrder {
  id: string;
  restaurantId: string;
  supplierId: string;
  supplierName: string;
  orderDate: string;
  expectedDate?: string;
  items: {
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  totalCost: number;
  status: 'draft' | 'ordered' | 'received' | 'cancelled';
  notes?: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  restaurantId: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success' | 'call_waiter' | 'request_bill';
  category: 'low_stock' | 'new_order' | 'reservation' | 'system';
  read: boolean;
  createdAt: string;
  link?: string;
  tableNumber?: number;
}

export interface DailyStats {
  date: string;
  revenue: number;
  ordersCount: number;
  topItems: { name: string; count: number }[];
}

export interface Product {
  id: string;
  restaurantId: string;
  name: string;
  barcode: string;
  unit: 'kg' | 'l' | 'pcs' | 'box';
  purchasePrice: number;
  sellingPrice: number;
  categoryId: string;
  preparationStation?: PreparationStation;
  currentStock: number;
  minStock: number;
  active: boolean;
}

export interface Invoice {
  id: string;
  restaurantId: string;
  invoiceNumber: string;
  supplierName: string;
  date: string;
  totalAmount: number;
  status: 'draft' | 'completed';
  userId: string;
}

export interface InvoiceItem {
  id: string;
  restaurantId: string;
  invoiceId: string;
  productId: string;
  quantity: number;
  price: number;
  total: number;
}

export type TransactionType = 'receipt' | 'input' | 'output' | 'inventory_check' | 'storno';

export interface Transaction {
  id: string;
  restaurantId: string;
  productId: string;
  type: TransactionType;
  quantity: number;
  previousStock: number;
  newStock: number;
  date: string;
  userId: string;
  referenceId?: string;
  note?: string;
}

export interface Bundle {
  id: string;
  restaurantId: string;
  name: string;
  sellingPrice: number;
  active: boolean;
  items?: { product_id: string; product_name: string; quantity: number; unit: string }[];
}

export interface BundleItem {
  id: string;
  restaurantId: string;
  bundleId: string;
  productId: string;
  quantity: number;
}

export interface InventoryCheck {
  id: string;
  restaurantId: string;
  date: string;
  status: 'draft' | 'completed';
  items: {
    productId: string;
    systemQty: number;
    realQty: number;
    diff: number;
  }[];
}

export interface Table {
  id: string;
  restaurantId: string;
  number: number;
  capacity: number;
  status: 'free' | 'occupied' | 'reserved';
  zone: string;
  currentOrderId?: string;
}

export interface OrderItem {
  id: string;
  restaurantId: string;
  orderId: string;
  productId: string; // This can be a Product or a Bundle (Normative)
  name: string;
  quantity: number;
  price: number;
  status: 'pending' | 'sent_to_kitchen' | 'preparing' | 'ready' | 'served' | 'cancelled';
  preparationStation?: PreparationStation;
  isBundle: boolean;
  note?: string;
  priority?: OrderPriority;
  startTime?: string;
  readyTime?: string;
  guestIndex?: number; // For split by item/guest
}

export interface Order {
  id: string;
  restaurantId: string;
  tableId?: string;
  customerId?: string;
  items: OrderItem[];
  status: 'order_created' | 'sent_to_kitchen' | 'preparing' | 'ready' | 'served' | 'paid' | 'closed' | 'cancelled' | 'out_for_delivery' | 'delivered';
  orderType: 'dine_in' | 'takeaway' | 'delivery';
  deliveryAddress?: string;
  deliveryPhone?: string;
  driverId?: string;
  deliveryFee?: number;
  deliveryStatus?: 'preparing' | 'ready' | 'out_for_delivery' | 'delivered';
  totalAmount: number;
  createdAt: string;
  closedAt?: string;
  userId: string;
  waiterId?: string;
  shiftId?: string;
  payments?: Payment[];
  priority?: OrderPriority;
  guestCount?: number;
  guestAssignments?: Record<string, number>; // itemId -> guestIndex
  splitPayments?: SplitPayment[];
  isSplit?: boolean;
  discountId?: string;
  discountName?: string;
  discountType?: DiscountType;
  discountValue?: number;
  discountAmount?: number;
  subtotal?: number;
}

export interface SplitPayment {
  id: string;
  restaurantId?: string;
  guestIndex?: number;
  amount: number;
  method: 'cash' | 'card';
  status: 'pending' | 'paid';
  timestamp?: string;
}

export interface Payment {
  id: string;
  restaurantId?: string;
  orderId: string;
  shiftId?: string;
  amount: number;
  method: 'cash' | 'card' | 'mixed';
  timestamp: string;
}

export interface DashboardStats {
  totalProducts: number;
  totalStockValue: number;
  lowStockCount: number;
  dailyTransactions: number;
  revenueByDay: { name: string; value: number }[];
  topSellingItems: { name: string; value: number }[];
  categoryPerformance: { name: string; value: number }[];
}

export interface OfflineOrder extends Order {
  isSynced: boolean;
}

export type PrinterType = 'kitchen' | 'bar' | 'receipt';

export interface Printer {
  id: string;
  restaurantId: string;
  name: string;
  type: PrinterType;
  ipAddress?: string;
  port?: number;
  connectionType: 'network' | 'usb' | 'bluetooth' | 'browser';
  active: boolean;
  station?: PreparationStation;
}

export interface PrintJob {
  id: string;
  restaurantId: string;
  printerId: string;
  orderId: string;
  type: 'kitchen_ticket' | 'customer_receipt' | 'order_summary';
  status: 'pending' | 'printed' | 'failed';
  content: Record<string, unknown>;
  createdAt: string;
}

export type SubscriptionPlanId = 'starter' | 'professional' | 'enterprise';

export interface Plan {
  id: SubscriptionPlanId;
  name: string;
  price: number;
  features: string[];
  limits: {
    maxProducts: number;
    maxEmployees: number;
    hasAnalytics: boolean;
    hasDelivery: boolean;
  };
}

export interface Subscription {
  id: string;
  restaurantId: string;
  plan: SubscriptionPlanId;
  price: number;
  billingCycle: 'monthly' | 'yearly';
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid';
  startDate: string;
  endDate: string;
  trialEndDate?: string;
}

export interface FeatureFlags {
  inventory_enabled: boolean;
  analytics_enabled: boolean;
  delivery_enabled: boolean;
  multi_restaurant_enabled: boolean;
}

export interface FeatureFlag {
  id: string;
  planId: SubscriptionPlanId;
  flags: FeatureFlags;
}
