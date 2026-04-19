import { createContext } from 'react';
import { User, Product, Transaction, Invoice, Category, DashboardStats, InventoryCheck, Bundle, Restaurant, Supplier, PurchaseOrder, Order } from '../types';

export interface StoreState {
  user: User | null;
  activeRestaurant: Restaurant | null;
  products: Product[];
  transactions: Transaction[];
  invoices: Invoice[];
  categories: Category[];
  inventoryChecks: InventoryCheck[];
  bundles: Bundle[];
  employees: User[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  orders: Order[];
  stats: DashboardStats | null;
  loading: {
    user: boolean;
    restaurant: boolean;
    products: boolean;
    inventory: boolean;
    invoices: boolean;
    categories: boolean;
    inventoryChecks: boolean;
    bundles: boolean;
    employees: boolean;
    suppliers: boolean;
    purchaseOrders: boolean;
    stats: boolean;
    orders: boolean;
  };
}

export interface StoreContextType extends StoreState {
  setUser: (user: User | null) => void;
  setRestaurant: (restaurant: Restaurant | null) => void;
  fetchRestaurant: (id: string) => Promise<void>;
  fetchProducts: () => Promise<void>;
  fetchInventory: () => Promise<void>;
  fetchInvoices: () => Promise<void>;
  fetchCategories: () => Promise<void>;
  fetchInventoryChecks: () => Promise<void>;
  fetchBundles: () => Promise<void>;
  fetchEmployees: () => Promise<void>;
  fetchSuppliers: () => Promise<void>;
  fetchPurchaseOrders: () => Promise<void>;
   fetchStats: () => Promise<void>;
  fetchOrders: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

export const StoreContext = createContext<StoreContextType | undefined>(undefined);
