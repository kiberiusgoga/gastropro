import React, { useState, useCallback, ReactNode } from 'react';
import { User, Product, Transaction, Invoice, Category, DashboardStats, InventoryCheck, Bundle, Restaurant, Supplier, PurchaseOrder } from '../types';
import { authService } from '../services/authService';
import { productService, categoryService } from '../services/productService';
import { inventoryService, invoiceService, dashboardService, inventoryCheckService, bundleService } from '../services/inventoryService';
import { restaurantService } from '../services/restaurantService';
import { supplierService } from '../services/supplierService';
import { StoreContext } from './StoreContext';

export const StoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [activeRestaurant, setActiveRestaurant] = useState<Restaurant | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [inventoryChecks, setInventoryChecks] = useState<InventoryCheck[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  
  const [loading, setLoading] = useState({
    user: false,
    restaurant: false,
    products: false,
    inventory: false,
    invoices: false,
    categories: false,
    inventoryChecks: false,
    bundles: false,
    employees: false,
    suppliers: false,
    purchaseOrders: false,
    stats: false,
  });

  const fetchRestaurant = useCallback(async (id: string) => {
    setLoading(prev => ({ ...prev, restaurant: true }));
    try {
      const data = await restaurantService.getById(id);
      setActiveRestaurant(data);
    } catch (error) {
      console.error('Error fetching restaurant:', error);
    } finally {
      setLoading(prev => ({ ...prev, restaurant: false }));
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    if (!activeRestaurant) return;
    setLoading(prev => ({ ...prev, products: true }));
    try {
      const data = await productService.getAll(activeRestaurant.id);
      setProducts(data);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(prev => ({ ...prev, products: false }));
    }
  }, [activeRestaurant]);

  const fetchInventory = useCallback(async () => {
    if (!activeRestaurant) return;
    setLoading(prev => ({ ...prev, inventory: true }));
    try {
      const data = await inventoryService.getTransactions(activeRestaurant.id);
      setTransactions(data);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    } finally {
      setLoading(prev => ({ ...prev, inventory: false }));
    }
  }, [activeRestaurant]);

  const fetchInvoices = useCallback(async () => {
    if (!activeRestaurant) return;
    setLoading(prev => ({ ...prev, invoices: true }));
    try {
      const data = await invoiceService.getAll(activeRestaurant.id);
      setInvoices(data);
    } catch (error) {
      console.error('Error fetching invoices:', error);
    } finally {
      setLoading(prev => ({ ...prev, invoices: false }));
    }
  }, [activeRestaurant]);

  const fetchCategories = useCallback(async () => {
    if (!activeRestaurant) return;
    setLoading(prev => ({ ...prev, categories: true }));
    try {
      const data = await categoryService.getAll(activeRestaurant.id);
      setCategories(data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoading(prev => ({ ...prev, categories: false }));
    }
  }, [activeRestaurant]);

  const fetchInventoryChecks = useCallback(async () => {
    if (!activeRestaurant) return;
    setLoading(prev => ({ ...prev, inventoryChecks: true }));
    try {
      const data = await inventoryCheckService.getAll(activeRestaurant.id);
      setInventoryChecks(data);
    } catch (error) {
      console.error('Error fetching inventory checks:', error);
    } finally {
      setLoading(prev => ({ ...prev, inventoryChecks: false }));
    }
  }, [activeRestaurant]);

  const fetchBundles = useCallback(async () => {
    if (!activeRestaurant) return;
    setLoading(prev => ({ ...prev, bundles: true }));
    try {
      const data = await bundleService.getAll(activeRestaurant.id);
      setBundles(data);
    } catch (error) {
      console.error('Error fetching bundles:', error);
    } finally {
      setLoading(prev => ({ ...prev, bundles: false }));
    }
  }, [activeRestaurant]);

  const fetchEmployees = useCallback(async () => {
    if (!activeRestaurant) return;
    setLoading(prev => ({ ...prev, employees: true }));
    try {
      const data = await authService.getUsers(activeRestaurant.id);
      setEmployees(data);
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(prev => ({ ...prev, employees: false }));
    }
  }, [activeRestaurant]);

  const fetchSuppliers = useCallback(async () => {
    if (!activeRestaurant) return;
    setLoading(prev => ({ ...prev, suppliers: true }));
    try {
      const data = await supplierService.getAllSuppliers(activeRestaurant.id);
      setSuppliers(data);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    } finally {
      setLoading(prev => ({ ...prev, suppliers: false }));
    }
  }, [activeRestaurant]);

  const fetchPurchaseOrders = useCallback(async () => {
    if (!activeRestaurant) return;
    setLoading(prev => ({ ...prev, purchaseOrders: true }));
    try {
      const data = await supplierService.getAllPurchaseOrders(activeRestaurant.id);
      setPurchaseOrders(data);
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
    } finally {
      setLoading(prev => ({ ...prev, purchaseOrders: false }));
    }
  }, [activeRestaurant]);

  const fetchStats = useCallback(async () => {
    if (!activeRestaurant) return;
    setLoading(prev => ({ ...prev, stats: true }));
    try {
      const data = await dashboardService.getStats(activeRestaurant.id);
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(prev => ({ ...prev, stats: false }));
    }
  }, [activeRestaurant]);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      fetchProducts(),
      fetchInventory(),
      fetchInvoices(),
      fetchCategories(),
      fetchInventoryChecks(),
      fetchBundles(),
      fetchEmployees(),
      fetchSuppliers(),
      fetchPurchaseOrders(),
      fetchStats(),
    ]);
  }, [fetchProducts, fetchInventory, fetchInvoices, fetchCategories, fetchInventoryChecks, fetchBundles, fetchEmployees, fetchSuppliers, fetchPurchaseOrders, fetchStats]);

  // Listen for auth changes
  React.useEffect(() => {
    const unsubscribe = authService.onAuthChange(async (u) => {
      setUser(u);
      if (u && u.restaurantId) {
        await fetchRestaurant(u.restaurantId);
      } else {
        setActiveRestaurant(null);
      }
    });
    return () => unsubscribe();
  }, [fetchRestaurant]);

  React.useEffect(() => {
    if (activeRestaurant) {
      refreshAll();
    }
  }, [activeRestaurant, refreshAll]);

  const value = {
    user,
    activeRestaurant,
    products,
    transactions,
    invoices,
    categories,
    inventoryChecks,
    bundles,
    employees,
    suppliers,
    purchaseOrders,
    stats,
    loading,
    setUser,
    setRestaurant: setActiveRestaurant,
    fetchRestaurant,
    fetchProducts,
    fetchInventory,
    fetchInvoices,
    fetchCategories,
    fetchInventoryChecks,
    fetchBundles,
    fetchEmployees,
    fetchSuppliers,
    fetchPurchaseOrders,
    fetchStats,
    refreshAll,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
};
