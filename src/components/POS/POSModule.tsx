import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { FixedSizeGrid as Grid } from 'react-window';
import {
  Users,
  Plus,
  List,
  CreditCard,
  Banknote,
  ChefHat,
  X,
  CheckCircle2,
  Minus,
  Split,
  Utensils,
  Package,
  Truck,
  User as UserIcon,
  Search,
  AlertCircle,
  WifiOff,
  Tag,
  Calendar,
  Clock,
} from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { tableService, posService } from '../../services/posService';
import { menuService } from '../../services/menuService';
import { crmService } from '../../services/crmService';
import { shiftService } from '../../services/shiftService';
import { offlineService } from '../../services/offlineService';
import { printService } from '../../services/printService';
import { reservationService } from '../../services/reservationService';
import apiClient from '../../lib/apiClient';
import { Table, Order, OrderItem, MenuItem, MenuCategory, Customer, Shift, Discount, Reservation } from '../../types';
import { useStore } from '../../store/useStore';
import BillSplitModal from './BillSplitModal';
import DiscountModal from './DiscountModal';
import { FileText } from 'lucide-react';

const POSModule = () => {
  const { user } = useStore();
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [orderType, setOrderType] = useState<Order['orderType']>('dine_in');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'mixed'>('cash');
  const [cashAmount, setCashAmount] = useState<string>('');
  const [cardAmount, setCardAmount] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [todayReservations, setTodayReservations] = useState<Reservation[]>([]);
  const [now, setNow] = useState(() => new Date());
  // Refs so the minute-ticker closure always reads fresh state without re-registering
  const stateRef = useRef({ tables, todayReservations });
  const autoBlockedRef = useRef(new Set<string>());
  useEffect(() => { stateRef.current = { tables, todayReservations }; }, [tables, todayReservations]);

  // Performance Optimization: Memoized filtered items
  const filteredItems = useMemo(() => {
    return menuItems.filter(item => 
      (activeCategory ? item.menuCategoryId === activeCategory : true) && 
      item.active &&
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [menuItems, activeCategory, searchTerm]);

  // Minute ticker — updates `now` for badge display + auto-blocks tables at T-15
  useEffect(() => {
    const tick = () => {
      const current = new Date();
      setNow(current);

      const { tables: currentTables, todayReservations: currentRes } = stateRef.current;
      for (const res of currentRes) {
        if (res.status !== 'reserved') continue;
        const resAt = new Date(`${res.date}T${res.time}`);
        const minutesUntil = (resAt.getTime() - current.getTime()) / 60_000;

        if (minutesUntil <= 15 && minutesUntil > -60 && !autoBlockedRef.current.has(res.tableId)) {
          const table = currentTables.find(t => t.id === res.tableId);
          if (table && table.status === 'free') {
            autoBlockedRef.current.add(res.tableId);
            tableService.update(res.tableId, { status: 'reserved' });
            setTables(prev =>
              prev.map(t => t.id === res.tableId ? { ...t, status: 'reserved' } : t)
            );
            toast.warning(
              `Маса ${res.tableNumber} блокирана — резервација за ${res.time} (${res.customerName})`,
              { duration: 8000 },
            );
          }
        }
      }
    };

    const id = setInterval(tick, 60_000);
    tick(); // run immediately on mount
    return () => clearInterval(id);
  }, []); // empty deps — reads state via stateRef

  // Network status monitoring + sync on reconnect
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncPendingOrders();
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Load pending count on mount
    offlineService.pendingCount().then(setPendingCount);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (user?.restaurantId) {
      fetchData();
    }
  }, [user?.restaurantId]);

  const fetchData = async () => {
    if (!user?.restaurantId) return;
    setLoading(true);
    try {
      const [tData, mData, cData, custData, sData, resData] = await Promise.all([
        tableService.getAll(user.restaurantId),
        menuService.getItems(user.restaurantId),
        menuService.getCategories(user.restaurantId),
        crmService.getAll(user.restaurantId),
        shiftService.getActiveShift(user.id, user.restaurantId),
        reservationService.getTodayUpcoming(),
      ]);
      setTables(tData);
      setMenuItems(mData);
      setCategories(cData);
      setCustomers(custData);
      setActiveShift(sData || null);
      setTodayReservations(resData);
      if (cData.length > 0) setActiveCategory(cData[0].id);
    } catch (error) {
      console.error('Error fetching POS data:', error);
    } finally {
      setLoading(false);
    }
  };

  const syncPendingOrders = async () => {
    const pending = await offlineService.getPending();
    if (!pending.length) return;

    let synced = 0;
    for (const entry of pending) {
      try {
        let serverId: string;

        if (entry.isLocal) {
          // Order was never on the server — create it now
          const res = await apiClient.post('/orders', {
            table_id: entry.order.tableId,
            customer_id: entry.order.customerId,
            shift_id: entry.shiftId,
            order_type: entry.order.orderType,
            guest_count: 1,
          });
          serverId = res.data.id;

          for (const item of entry.order.items) {
            await apiClient.post(`/orders/${serverId}/items`, {
              menu_item_id: item.productId,
              name: item.name,
              quantity: item.quantity,
              price: item.price,
              preparation_station: item.preparationStation,
              is_bundle: item.isBundle,
              note: item.note ?? null,
            });
          }
        } else {
          // Order exists on server — just close it
          serverId = entry.order.id;
        }

        await apiClient.put(`/orders/${serverId}`, { status: 'paid' });
        await offlineService.dequeue(entry.localId);
        synced++;
      } catch (err) {
        console.error('[Offline Sync] Failed for', entry.localId, err);
        await offlineService.incrementAttempts(entry.localId);
      }
    }

    const remaining = await offlineService.pendingCount();
    setPendingCount(remaining);

    if (synced > 0) {
      toast.success(`${synced} нарачк${synced === 1 ? 'а' : 'и'} синхронизиран${synced === 1 ? 'а' : 'и'} успешно`);
      fetchData();
    }
  };

  // Returns the most imminent reservation for a table (within ±4 hours window)
  const getTableReservation = useCallback((tableId: string): { res: Reservation; minutesUntil: number } | null => {
    let best: { res: Reservation; minutesUntil: number } | null = null;
    for (const res of todayReservations) {
      if (res.tableId !== tableId || res.status !== 'reserved') continue;
      const resAt = new Date(`${res.date}T${res.time}`);
      const minutesUntil = (resAt.getTime() - now.getTime()) / 60_000;
      if (minutesUntil < -30 || minutesUntil > 240) continue;
      if (!best || minutesUntil < best.minutesUntil) best = { res, minutesUntil };
    }
    return best;
  }, [todayReservations, now]);

  const handleTableSelect = useCallback(async (table: Table) => {
    if (!user?.restaurantId) return;
    setSelectedTable(table);
    if (table.status === 'occupied' && table.currentOrderId) {
      const order = await posService.getOpenOrderForTable(table.id, user.restaurantId);
      setCurrentOrder(order);
    } else {
      setCurrentOrder(null);
    }
  }, [user?.restaurantId]);

  const handleStartOrder = async () => {
    if (!user?.restaurantId || !activeShift) {
      toast.error('Мора да имате активна смена за да започнете нарачка');
      return;
    }

    if (!isOnline) {
      const localOrder: Order = {
        id: `local-${crypto.randomUUID()}`,
        restaurantId: user.restaurantId,
        tableId: selectedTable?.id,
        customerId: selectedCustomer?.id,
        userId: user.id,
        shiftId: activeShift.id,
        status: 'open',
        orderType,
        guestCount: 1,
        totalAmount: 0,
        subtotal: 0,
        discountAmount: 0,
        createdAt: new Date().toISOString(),
        items: [],
      };
      setCurrentOrder(localOrder);
      if (selectedTable) {
        setTables(prev => prev.map(t => t.id === selectedTable.id ? { ...t, status: 'occupied' } : t));
      }
      toast.info('Офлајн режим — нарачката е локална');
      return;
    }

    const order = await posService.createOrder(
      selectedTable?.id || null,
      user.id,
      user.restaurantId,
      orderType,
      selectedCustomer?.id,
      activeShift.id
    );

    if (order) {
      setCurrentOrder(order);
      if (selectedTable) {
        setTables(prev => prev.map(t => t.id === selectedTable.id ? { ...t, status: 'occupied', currentOrderId: order.id } : t));
      }
    }
  };

  const handleApplyDiscount = async (discount: Discount | null) => {
    if (!currentOrder) return;

    const subtotal = currentOrder.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    let discountAmount = 0;

    if (discount) {
      if (discount.type === 'percentage') {
        discountAmount = (subtotal * discount.value) / 100;
      } else {
        discountAmount = discount.value;
      }
    }

    const totalAmount = subtotal - discountAmount;

    const updateData: Partial<Order> = {
      discountId: discount?.id || null,
      discountName: discount?.name || null,
      discountType: discount?.type || null,
      discountValue: discount?.value || null,
      discountAmount,
      subtotal,
      totalAmount
    };

    await posService.updateOrder(currentOrder.id, updateData);
    setCurrentOrder(prev => prev ? { ...prev, ...updateData } : null);
    setShowDiscountModal(false);
    toast.success(discount ? 'Попустот е примен' : 'Попустот е отстранет');
  };

  const handleAddItem = useCallback(async (item: MenuItem) => {
    if (!currentOrder) return;

    const baseItem: Omit<OrderItem, 'id'> = {
      orderId: currentOrder.id,
      restaurantId: user?.restaurantId ?? '',
      productId: item.id,
      name: item.name,
      quantity: 1,
      price: item.price,
      status: 'pending',
      preparationStation: 'kitchen',
      isBundle: !!item.bundleId,
    };

    const addToState = (newItem: OrderItem) => {
      setCurrentOrder(prev => {
        if (!prev) return null;
        const newItems = [...prev.items, newItem];
        const subtotal = newItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
        let discountAmount = 0;
        if (prev.discountId) {
          discountAmount = prev.discountType === 'percentage'
            ? (subtotal * (prev.discountValue || 0)) / 100
            : prev.discountValue || 0;
        }
        return { ...prev, items: newItems, subtotal, totalAmount: subtotal - discountAmount, discountAmount };
      });
    };

    if (!isOnline || currentOrder.id.startsWith('local-')) {
      addToState({ ...baseItem, id: `local-${crypto.randomUUID()}` });
      return;
    }

    const newItem = await posService.addItemToOrder(currentOrder.id, baseItem);
    if (newItem) addToState(newItem as OrderItem);
  }, [currentOrder, isOnline]);

  const handleUpdateQuantity = useCallback(async (itemId: string, delta: number) => {
    if (!currentOrder) return;
    const item = currentOrder.items.find(i => i.id === itemId);
    if (!item) return;

    const newQuantity = item.quantity + delta;
    if (newQuantity < 1) return;

    await posService.updateItemQuantity(currentOrder.id, itemId, newQuantity);
    setCurrentOrder(prev => {
      if (!prev) return null;
      const newItems = prev.items.map(i => i.id === itemId ? { ...i, quantity: newQuantity } : i);
      const subtotal = newItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
      let discountAmount = 0;
      if (prev.discountId) {
        if (prev.discountType === 'percentage') {
          discountAmount = (subtotal * (prev.discountValue || 0)) / 100;
        } else {
          discountAmount = prev.discountValue || 0;
        }
      }
      const totalAmount = subtotal - discountAmount;

      return {
        ...prev,
        items: newItems,
        subtotal,
        totalAmount,
        discountAmount
      };
    });
  }, [currentOrder]);

  const handleCloseOrder = async () => {
    if (!currentOrder || !activeShift) return;
    
    const payments = [];
    if (paymentMethod === 'cash') {
      payments.push({ orderId: currentOrder.id, amount: currentOrder.totalAmount, method: 'cash' as const, timestamp: new Date().toISOString(), shiftId: activeShift.id });
    } else if (paymentMethod === 'card') {
      payments.push({ orderId: currentOrder.id, amount: currentOrder.totalAmount, method: 'card' as const, timestamp: new Date().toISOString(), shiftId: activeShift.id });
    } else {
      if (parseFloat(cashAmount) > 0) {
        payments.push({ orderId: currentOrder.id, amount: parseFloat(cashAmount), method: 'cash' as const, timestamp: new Date().toISOString(), shiftId: activeShift.id });
      }
      if (parseFloat(cardAmount) > 0) {
        payments.push({ orderId: currentOrder.id, amount: parseFloat(cardAmount), method: 'card' as const, timestamp: new Date().toISOString(), shiftId: activeShift.id });
      }
    }

    if (!isOnline) {
      const isLocal = currentOrder.id.startsWith('local-');
      await offlineService.enqueue(
        { ...currentOrder, status: 'paid', closedAt: new Date().toISOString() },
        payments,
        activeShift.id,
        isLocal,
      );
      const count = await offlineService.pendingCount();
      setPendingCount(count);
      toast.warning(`Нарачката е зачувана локално (${count} чекаат синхронизација)`);
    } else {
      await posService.closeOrder(currentOrder.id, payments, activeShift.id);
      toast.success('Нарачката е успешно затворена!');
    }

    setShowPaymentModal(false);
    setCurrentOrder(null);
    setSelectedTable(null);
    setSelectedCustomer(null);
    fetchData();
  };

  const handlePrintKitchen = async () => {
    if (!currentOrder) return;
    try {
      await printService.printKitchenTickets(currentOrder);
      toast.success('Бон за кујна е испратен на печатење');
    } catch {
      toast.error('Грешка при печатење');
    }
  };

  const handlePrintReceipt = async () => {
    if (!currentOrder) return;
    try {
      await printService.printCustomerReceipt(currentOrder);
      toast.success('Сметката е испратена на печатење');
    } catch {
      toast.error('Грешка при печатење');
    }
  };

  // react-window Grid Cell Renderer
  const ItemCell = ({ columnIndex, rowIndex, style, data }: { columnIndex: number, rowIndex: number, style: React.CSSProperties, data: MenuItem[] }) => {
    const index = rowIndex * 4 + columnIndex;
    const item = data[index];
    if (!item) return null;

    return (
      <div style={style} className="p-3">
        <button
          onClick={() => handleAddItem(item)}
          className="w-full h-full bg-white dark:bg-zinc-900 p-5 rounded-[2rem] shadow-sm border border-zinc-100 dark:border-zinc-800 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-xl hover:-translate-y-1 transition-all text-left flex flex-col justify-between group relative overflow-hidden"
        >
          <div>
            <div className="font-black text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 transition-colors line-clamp-2 uppercase tracking-tight text-sm">{item.name}</div>
            <div className="text-[10px] font-black text-zinc-400 mt-1 uppercase tracking-widest">{item.categoryName ?? ''}</div>
          </div>
          <div className="mt-4 flex items-center justify-between relative z-10">
            <span className="text-xl font-black text-zinc-900 dark:text-zinc-100 tracking-tighter font-display">{item.price} <small className="text-[10px] opacity-50 uppercase">ден</small></span>
            <div className="w-10 h-10 bg-blue-500 text-white rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-300 shadow-lg shadow-blue-500/20">
              <Plus size={20} strokeWidth={3} />
            </div>
          </div>
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/[0.02] rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700"></div>
        </button>
      </div>
    );
  };

  if (loading) return <div className="p-8 text-center">Loading POS...</div>;

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col lg:flex-row overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      {/* Left Side: Table Map or Menu */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        {!selectedTable && orderType === 'dine_in' ? (
          <div className="space-y-8">
            {/* Header */}
            <div className="flex items-start justify-between gap-6">
              <div>
                <h2 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tighter uppercase font-display italic">
                  План на Сала
                </h2>
                <div className="flex items-center gap-5 mt-2.5">
                  <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
                    {tables.filter(t => t.status === 'free').length} слободни
                  </span>
                  <span className="w-px h-4 bg-zinc-200 dark:bg-zinc-800" />
                  <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-rose-500">
                    <div className="w-2 h-2 bg-rose-500 rounded-full shadow-[0_0_6px_rgba(244,63,94,0.8)] animate-pulse" />
                    {tables.filter(t => t.status === 'occupied').length} зафатени
                  </span>
                  <span className="w-px h-4 bg-zinc-200 dark:bg-zinc-800" />
                  <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-amber-500">
                    <div className="w-2 h-2 bg-amber-400 rounded-full" />
                    {tables.filter(t => t.status === 'reserved').length} резервирани
                  </span>
                </div>
              </div>

              {/* Order type tabs */}
              <div className="flex bg-zinc-100 dark:bg-zinc-900 rounded-2xl p-1.5 gap-1 border border-zinc-200 dark:border-zinc-800 shadow-inner shrink-0">
                {([
                  { type: 'dine_in' as const, icon: Utensils, label: 'Во ресторан' },
                  { type: 'takeaway' as const, icon: Package, label: 'За носење' },
                  { type: 'delivery' as const, icon: Truck, label: 'Достава' },
                ] as const).map(({ type, icon: Icon, label }) => (
                  <button
                    key={type}
                    onClick={() => { setOrderType(type); if (type !== 'dine_in') setSelectedTable(null); }}
                    className={`px-5 py-2.5 rounded-xl flex items-center gap-2 text-xs font-black uppercase tracking-wider transition-all ${
                      orderType === type
                        ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-md'
                        : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                    }`}
                  >
                    <Icon size={14} strokeWidth={2.5} />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Table grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {tables.map(table => {
                const upcoming = getTableReservation(table.id);
                const isUrgent  = upcoming !== null && upcoming.minutesUntil <= 15;
                const isWarning = upcoming !== null && upcoming.minutesUntil > 15 && upcoming.minutesUntil <= 90;
                const isOccupied = table.status === 'occupied';
                const isReserved = table.status === 'reserved' || isUrgent;
                const minsLabel = upcoming
                  ? (upcoming.minutesUntil <= 0
                      ? 'ДОЦНИ'
                      : upcoming.minutesUntil < 60
                        ? `${Math.round(upcoming.minutesUntil)}min`
                        : upcoming.res.time)
                  : null;

                return (
                  <button
                    key={table.id}
                    onClick={() => handleTableSelect(table)}
                    className={`relative flex flex-col rounded-2xl p-5 transition-all duration-200 hover:-translate-y-1 text-left group border overflow-hidden ${
                      isOccupied
                        ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/50 hover:shadow-lg hover:shadow-rose-200/60 dark:hover:shadow-rose-900/40'
                        : isReserved
                        ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-700/50 hover:shadow-lg hover:shadow-amber-200/60'
                        : isWarning
                        ? 'bg-yellow-50/60 dark:bg-yellow-950/20 border-yellow-200/80 dark:border-yellow-800/30 hover:shadow-md hover:shadow-yellow-100'
                        : 'bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 hover:border-emerald-300 dark:hover:border-emerald-700/60 hover:shadow-lg hover:shadow-emerald-100/60 dark:hover:shadow-emerald-900/20'
                    }`}
                  >
                    {/* Status accent strip at top */}
                    <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-2xl ${
                      isOccupied ? 'bg-rose-500'
                      : isReserved ? 'bg-amber-500'
                      : isWarning ? 'bg-yellow-400'
                      : 'bg-emerald-400'
                    }`} />

                    {/* Top row: number + status dot */}
                    <div className="flex items-start justify-between mb-1 mt-1">
                      <span className={`text-4xl font-black font-display tracking-tighter leading-none ${
                        isOccupied ? 'text-rose-600 dark:text-rose-400'
                        : isReserved ? 'text-amber-600 dark:text-amber-400'
                        : 'text-zinc-900 dark:text-zinc-100'
                      }`}>
                        {table.number}
                      </span>
                      <div className={`w-2.5 h-2.5 rounded-full mt-1 ${
                        isOccupied ? 'bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.8)]'
                        : isReserved ? 'bg-amber-400 animate-pulse'
                        : isWarning ? 'bg-yellow-400'
                        : 'bg-emerald-400'
                      }`} />
                    </div>

                    {/* Zone */}
                    <div className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-600 mb-3">
                      {table.zone}
                    </div>

                    {/* Reservation badge */}
                    {upcoming && minsLabel && (
                      <div className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide rounded-lg px-2.5 py-1 mb-2 ${
                        isUrgent
                          ? 'bg-amber-500 text-white shadow-sm shadow-amber-400/50 animate-pulse'
                          : 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-700/40'
                      }`}>
                        {isUrgent ? <Clock size={9} strokeWidth={3} /> : <Calendar size={9} />}
                        <span className="truncate">{upcoming.res.customerName} · {minsLabel}</span>
                      </div>
                    )}

                    {/* Capacity */}
                    <div className={`flex items-center gap-1.5 text-xs font-bold mt-auto ${
                      isOccupied ? 'text-rose-400 dark:text-rose-500'
                      : isReserved ? 'text-amber-500'
                      : 'text-zinc-400 dark:text-zinc-600'
                    }`}>
                      <Users size={12} strokeWidth={2.5} />
                      <span>{table.capacity} места</span>
                    </div>

                    {/* Hover glow orb */}
                    <div className={`absolute -bottom-4 -right-4 w-20 h-20 rounded-full blur-xl opacity-0 group-hover:opacity-30 transition-opacity duration-500 ${
                      isOccupied ? 'bg-rose-500' : isReserved ? 'bg-amber-500' : 'bg-emerald-400'
                    }`} />
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-6">
                <button 
                  onClick={() => { setSelectedTable(null); setOrderType('dine_in'); }}
                  className="w-12 h-12 flex items-center justify-center bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-all hover:shadow-md active:scale-90"
                >
                  <X size={24} />
                </button>
                <div>
                  <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tighter font-display uppercase italic">
                    {orderType === 'dine_in' ? `Маса #${selectedTable?.number}` : orderType === 'takeaway' ? 'За носење' : 'Достава'}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="w-6 h-[2px] bg-emerald-500 rounded-full"></span>
                    <p className="text-[10px] text-zinc-400 uppercase font-black tracking-[0.2em]">Избор на производи</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4 group-focus-within:text-blue-500 transition-colors" />
                  <input 
                    type="text"
                    placeholder="Брзо пребарување..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-11 pr-6 py-3 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 text-sm font-bold w-64 transition-all"
                  />
                </div>
                <button 
                  onClick={() => setShowCustomerModal(true)}
                  className={`flex items-center gap-3 px-6 py-3 rounded-2xl border transition-all font-black text-xs uppercase tracking-widest shadow-sm hover:shadow-md ${selectedCustomer ? 'bg-blue-500 border-blue-500 text-white shadow-blue-500/20' : 'bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}
                >
                  <UserIcon size={18} />
                  {selectedCustomer ? selectedCustomer.name : 'Клиент'}
                </button>
              </div>
            </div>

            {/* Categories */}
            <div className="flex gap-3 mb-8 overflow-x-auto pb-4 scrollbar-hide">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-8 py-3.5 rounded-2xl whitespace-nowrap font-black text-xs uppercase tracking-[0.15em] transition-all shadow-sm border-2 ${
                    activeCategory === cat.id 
                      ? 'bg-zinc-950 border-zinc-950 text-white shadow-xl shadow-black/10' 
                      : 'bg-white dark:bg-zinc-900 border-zinc-50 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500 hover:border-zinc-200 dark:hover:border-zinc-700 hover:bg-zinc-50'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Items Grid with react-window */}
            <div className="flex-1 min-h-0 bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <Grid
                columnCount={4}
                columnWidth={250}
                height={600}
                rowCount={Math.ceil(filteredItems.length / 4)}
                rowHeight={140}
                width={1000}
                itemData={filteredItems}
              >
                {ItemCell}
              </Grid>
            </div>
          </div>
        )}
      </div>

      {/* Offline Indicator */}
      {(!isOnline || pendingCount > 0) && (
        <div className="fixed bottom-4 left-4 flex flex-col gap-2 z-[60]">
          {!isOnline && (
            <div className="bg-red-600 text-white px-4 py-2 rounded-full flex items-center gap-2 shadow-lg animate-pulse">
              <WifiOff size={18} />
              <span className="text-sm font-bold">Офлајн режим</span>
            </div>
          )}
          {pendingCount > 0 && (
            <button
              onClick={syncPendingOrders}
              disabled={!isOnline}
              className="bg-amber-500 disabled:opacity-60 text-white px-4 py-2 rounded-full flex items-center gap-2 shadow-lg hover:bg-amber-600 transition-colors"
            >
              <WifiOff size={16} />
              <span className="text-sm font-bold">{pendingCount} чекаат синхронизација</span>
            </button>
          )}
        </div>
      )}

      {/* Right Side: Order Sidebar */}
      <div className="w-full lg:w-[450px] bg-white dark:bg-zinc-950 border-l border-zinc-100 dark:border-zinc-800 flex flex-col shadow-2xl relative z-20">
        <div className="p-8 border-b border-zinc-50 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/50 backdrop-blur-md">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tighter font-display italic">Нарачка</h2>
            {currentOrder && (
              <div className="flex gap-2">
                {currentOrder.isSplit && (
                  <div className="px-3 py-1 bg-amber-500 text-white rounded-lg text-[10px] font-black uppercase flex items-center gap-1 shadow-lg shadow-amber-500/20">
                    <Split size={12} strokeWidth={3} /> Поделена
                  </div>
                )}
                <div className="px-3 py-1 bg-emerald-500 text-white rounded-lg text-[10px] font-black uppercase shadow-lg shadow-emerald-500/20">
                  {currentOrder.orderType === 'dine_in' ? 'Ресторан' : currentOrder.orderType === 'takeaway' ? 'За носење' : 'Достава'}
                </div>
              </div>
            )}
          </div>
          
          {selectedCustomer && (
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100 mb-2 animate-in slide-in-from-top-2">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                {selectedCustomer.name.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-slate-900">{selectedCustomer.name}</div>
                <div className="text-xs text-slate-500">{selectedCustomer.phone}</div>
              </div>
              <button onClick={() => setSelectedCustomer(null)} className="text-slate-400 hover:text-red-500 transition-colors">
                <X size={16} />
              </button>
            </div>
          )}

          {!currentOrder && (
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-3">
              <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={18} />
              <p className="text-xs text-amber-700 font-medium leading-relaxed">
                Изберете маса или тип на нарачка за да започнете.
              </p>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {currentOrder ? (
            currentOrder.items.length > 0 ? (
              currentOrder.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between group animate-in fade-in slide-in-from-right-4">
                  <div className="flex-1">
                    <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{item.name}</div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">{item.price} ден</div>
                  </div>
                  <div className="flex items-center gap-3 bg-slate-50 p-1 rounded-xl border border-slate-100">
                    <button 
                      onClick={() => handleUpdateQuantity(item.id, -1)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white hover:shadow-sm text-slate-500 transition-all"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="w-6 text-center font-black text-slate-900">{item.quantity}</span>
                    <button 
                      onClick={() => handleUpdateQuantity(item.id, 1)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white hover:shadow-sm text-slate-500 transition-all"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4 opacity-50">
                <List size={48} strokeWidth={1} />
                <p className="font-bold uppercase text-xs tracking-widest">Нарачката е празна</p>
              </div>
            )
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4 opacity-50">
              <ChefHat size={64} strokeWidth={1} />
              <p className="font-bold uppercase text-xs tracking-widest text-center">Започни нова нарачка</p>
            </div>
          )}
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-200 space-y-4 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
          <div className="space-y-2">
            {currentOrder?.discountAmount ? (
              <>
                <div className="flex items-center justify-between text-sm text-slate-500">
                  <span>Меѓузбир</span>
                  <span>{currentOrder.subtotal} ден</span>
                </div>
                <div className="flex items-center justify-between text-sm text-green-600 font-bold">
                  <span>Попуст ({currentOrder.discountName})</span>
                  <span>-{currentOrder.discountAmount} ден</span>
                </div>
              </>
            ) : null}
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-bold uppercase text-xs tracking-widest">Вкупно за плаќање</span>
              <span className="text-3xl font-black text-slate-900">{currentOrder?.totalAmount || 0} ден</span>
            </div>
          </div>

          {!currentOrder ? (
            <button
              onClick={handleStartOrder}
              disabled={!selectedTable && orderType === 'dine_in'}
              className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:bg-slate-300 disabled:shadow-none transition-all flex items-center justify-center gap-3"
            >
              <Plus size={20} />
              Започни Нарачка
            </button>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setShowSplitModal(true)}
                  disabled={currentOrder.items.length === 0}
                  className="py-3 bg-white border border-slate-200 text-slate-700 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-50 disabled:opacity-50 transition-all flex items-center justify-center gap-2 text-xs"
                >
                  <Split size={16} />
                  Подели
                </button>
                <button
                  onClick={() => setShowDiscountModal(true)}
                  disabled={currentOrder.items.length === 0}
                  className="py-3 bg-white border border-slate-200 text-slate-700 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-50 disabled:opacity-50 transition-all flex items-center justify-center gap-2 text-xs"
                >
                  <Tag size={16} />
                  Попуст
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handlePrintKitchen}
                  disabled={currentOrder.items.length === 0}
                  className="py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:bg-slate-300 disabled:shadow-none transition-all flex items-center justify-center gap-2"
                >
                  <ChefHat size={20} />
                  Кујна
                </button>
                <button
                  onClick={() => setShowPaymentModal(true)}
                  disabled={currentOrder.items.length === 0}
                  className="py-4 bg-green-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-green-200 hover:bg-green-700 disabled:bg-slate-300 disabled:shadow-none transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={20} />
                  Наплати
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Customer Selection Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">Избери Клиент</h3>
              <button onClick={() => setShowCustomerModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input 
                  type="text"
                  placeholder="Пребарај по име или телефон..."
                  className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {customers.map(customer => (
                  <button
                    key={customer.id}
                    onClick={() => {
                      setSelectedCustomer(customer);
                      setShowCustomerModal(false);
                    }}
                    className={`w-full p-4 rounded-xl border text-left transition-all ${
                      selectedCustomer?.id === customer.id 
                        ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-100' 
                        : 'bg-white border-slate-100 hover:border-blue-200'
                    }`}
                  >
                    <div className="font-bold text-slate-900">{customer.name}</div>
                    <div className="text-sm text-slate-500">{customer.phone}</div>
                  </button>
                ))}
              </div>
              <button 
                onClick={() => {
                  setSelectedCustomer(null);
                  setShowCustomerModal(false);
                }}
                className="w-full py-3 text-slate-600 font-bold hover:bg-slate-50 rounded-xl transition-colors"
              >
                Без клиент
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && currentOrder && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">Плаќање</h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6">
              <div className="text-center mb-8">
                <div className="text-slate-500 text-sm mb-1 uppercase font-bold tracking-wider">Вкупно за плаќање</div>
                <div className="text-4xl font-black text-slate-900">{currentOrder.totalAmount} ден</div>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-8">
                <button
                  onClick={() => setPaymentMethod('cash')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                    paymentMethod === 'cash' ? 'bg-blue-50 border-blue-600 text-blue-600' : 'bg-white border-slate-100 text-slate-600 hover:border-slate-200'
                  }`}
                >
                  <Banknote size={24} />
                  <span className="text-sm font-bold">Готовина</span>
                </button>
                <button
                  onClick={() => setPaymentMethod('card')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                    paymentMethod === 'card' ? 'bg-blue-50 border-blue-600 text-blue-600' : 'bg-white border-slate-100 text-slate-600 hover:border-slate-200'
                  }`}
                >
                  <CreditCard size={24} />
                  <span className="text-sm font-bold">Картичка</span>
                </button>
                <button
                  onClick={() => setPaymentMethod('mixed')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                    paymentMethod === 'mixed' ? 'bg-blue-50 border-blue-600 text-blue-600' : 'bg-white border-slate-100 text-slate-600 hover:border-slate-200'
                  }`}
                >
                  <Split size={24} />
                  <span className="text-sm font-bold">Мешано</span>
                </button>
              </div>

              {paymentMethod === 'mixed' && (
                <div className="space-y-4 mb-8">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Готовина</label>
                    <input 
                      type="number"
                      value={cashAmount}
                      onChange={(e) => setCashAmount(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Картичка</label>
                    <input 
                      type="number"
                      value={cardAmount}
                      onChange={(e) => setCardAmount(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              )}

              <button
                onClick={handlePrintReceipt}
                className="w-full py-4 mb-3 bg-slate-100 text-slate-700 rounded-2xl font-bold text-lg hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
              >
                <FileText size={24} />
                Печати Сметка
              </button>

              <button
                onClick={handleCloseOrder}
                className="w-full py-4 bg-green-600 text-white rounded-2xl font-bold text-lg hover:bg-green-700 transition-all shadow-lg shadow-green-200 flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={24} />
                Затвори Нарачка
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bill Split Modal */}
      <AnimatePresence>
        {showSplitModal && currentOrder && (
          <BillSplitModal
            order={currentOrder}
            onClose={() => setShowSplitModal(false)}
            onUpdate={() => {
              if (selectedTable) handleTableSelect(selectedTable);
            }}
          />
        )}
      </AnimatePresence>

      {/* Discount Modal */}
      <AnimatePresence>
        {showDiscountModal && currentOrder && (
          <DiscountModal
            order={currentOrder}
            onClose={() => setShowDiscountModal(false)}
            onApply={handleApplyDiscount}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default POSModule;
