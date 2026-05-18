import React, { useState, useEffect } from 'react';
import {
  LayoutGrid,
  Plus,
  Send,
  Trash2,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { tableService, posService } from '../../services/posService';
import { menuService } from '../../services/menuService';
import { Table, MenuItem, Order, OrderItem, MenuCategory } from '../../types';
import { toast } from 'sonner';
import { useStore } from '../../store/useStore';

const WaiterTerminal = () => {
  const { user } = useStore();
  const [tables, setTables] = useState<Table[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [currentOrder, setCurrentOrder] = useState<Partial<Order> | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tableData, itemData, catData] = await Promise.all([
        tableService.getAll(),
        menuService.getAllItems(),
        menuService.getAllCategories()
      ]);
      setTables(tableData);
      setMenuItems(itemData);
      setCategories(catData);
      if (catData.length > 0) setSelectedCategory(catData[0].id);
    } catch (error) {
      console.error('Error loading waiter terminal data:', error);
      toast.error('Грешка при вчитување на податоци');
    } finally {
      setLoading(false);
    }
  };

  const handleTableSelect = async (table: Table) => {
    setSelectedTable(table);
    if (table.currentOrderId) {
      try {
        const order = await posService.getOpenOrderForTable(table.id);
        setCurrentOrder(order);
      } catch (error) {
        console.error('Error loading order:', error);
        toast.error('Грешка при вчитување на нарачката');
      }
    } else {
      setCurrentOrder({
        tableId: table.id,
        items: [],
        status: 'open',
        orderType: 'dine_in',
        totalAmount: 0,
        userId: user?.id || ''
      });
    }
  };

  const addToOrder = (item: MenuItem) => {
    if (!currentOrder) return;

    const existingItemIndex = currentOrder.items?.findIndex(i => i.productId === item.id && i.status === 'pending');

    const newItems = [...(currentOrder.items || [])];

    if (existingItemIndex !== undefined && existingItemIndex > -1) {
      newItems[existingItemIndex].quantity += 1;
    } else {
      const newItem: OrderItem = {
        id: Math.random().toString(36).substring(7),
        restaurantId: user?.restaurantId || '',
        orderId: currentOrder.id || '',
        productId: item.id,
        name: item.name,
        quantity: 1,
        price: item.price,
        status: 'pending',
        isBundle: !!item.bundleId,
        preparationStation: item.bundleId ? 'kitchen' : 'bar'
      };
      newItems.push(newItem);
    }

    const total = newItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    setCurrentOrder({ ...currentOrder, items: newItems, totalAmount: total });
  };

  const sendToKitchen = async () => {
    if (!currentOrder || !selectedTable) return;

    try {
      if (!currentOrder.id) {
        const order = await posService.createOrder(
          selectedTable.id,
          user?.id || '',
          user?.restaurantId,
          currentOrder.orderType || 'dine_in'
        );
        if (order) {
          await tableService.update(selectedTable.id, { status: 'occupied', currentOrderId: order.id });
        }
        toast.success('Нарачката е испратена во кујна');
      } else {
        await posService.sendToKitchen(currentOrder.id);
        toast.success('Нарачката е ажурирана');
      }
      setSelectedTable(null);
      setCurrentOrder(null);
      loadData();
    } catch (error) {
      console.error('Error sending to kitchen:', error);
      toast.error('Грешка при испраќање на нарачката');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-base">
        <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-base overflow-hidden">
      {/* Header */}
      <div className="bg-surface border-b border-warm-line p-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center text-[#faf5ee] shadow-card">
            <LayoutGrid size={20} />
          </div>
          <div>
            <h1 className="font-bold text-cream">Келнерски Терминал</h1>
            <p className="text-xs text-cream-faint">{user?.name}</p>
          </div>
        </div>
        {selectedTable && (
          <button
            onClick={() => { setSelectedTable(null); setCurrentOrder(null); }}
            className="px-4 py-2 bg-surface-2 border border-warm-line text-cream-muted rounded-xl font-bold text-sm hover:bg-warm-input transition-colors"
          >
            Назад кон маси
          </button>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {!selectedTable ? (
          /* Table Selection Grid */
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {tables.map(table => (
                <button
                  key={table.id}
                  onClick={() => handleTableSelect(table)}
                  className={`aspect-square rounded-3xl border-2 flex flex-col items-center justify-center gap-2 transition-all hover:-translate-y-1 ${
                    table.status === 'free'
                      ? 'bg-surface border-warm-line text-cream-faint hover:border-warm-line-strong hover:shadow-card'
                      : table.status === 'occupied'
                      ? 'bg-accent border-accent text-[#faf5ee] shadow-card'
                      : 'bg-amber-950/20 border-amber-700/40 text-amber-400'
                  }`}
                >
                  <span className="text-3xl font-black">{table.number}</span>
                  <span className="text-[10px] uppercase font-bold tracking-widest">{table.status}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Order Creation Interface */
          <>
            {/* Menu Sidebar */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Categories */}
              <div className="p-4 flex gap-2 overflow-x-auto no-scrollbar shrink-0 bg-surface border-b border-warm-line">
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-6 py-3 rounded-2xl text-sm font-bold whitespace-nowrap transition-all ${
                      selectedCategory === cat.id
                        ? 'bg-accent text-[#faf5ee] shadow-card'
                        : 'bg-surface-2 text-cream-faint hover:bg-warm-input'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* Items Grid */}
              <div className="flex-1 p-4 overflow-y-auto">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {menuItems
                    .filter(item => item.menuCategoryId === selectedCategory && item.active)
                    .map(item => (
                      <button
                        key={item.id}
                        onClick={() => addToOrder(item)}
                        className="bg-surface-2 border border-warm-line rounded-3xl p-4 text-left hover:border-accent/50 transition-all hover:shadow-card group"
                      >
                        <div className="aspect-video bg-surface rounded-2xl mb-3 overflow-hidden">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-cream-faint/20">
                              <Plus size={24} />
                            </div>
                          )}
                        </div>
                        <h4 className="font-bold text-cream text-sm mb-1 group-hover:text-accent-light transition-colors">{item.name}</h4>
                        <p className="text-accent-light font-black text-sm">{item.price.toLocaleString()} ден.</p>
                      </button>
                    ))}
                </div>
              </div>
            </div>

            {/* Current Order Sidebar */}
            <div className="w-80 bg-surface border-l border-warm-line flex flex-col shrink-0 overflow-hidden">
              <div className="p-4 border-b border-warm-line bg-surface-2/50">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-cream flex items-center gap-2">
                    <CheckCircle2 size={18} className="text-accent-light" />
                    Маса {selectedTable.number}
                  </h3>
                  <span className="text-[10px] font-bold text-cream-faint uppercase tracking-widest">Нарачка</span>
                </div>
                <p className="text-xs text-cream-faint flex items-center gap-1">
                  <Clock size={12} />
                  {new Date().toLocaleTimeString()}
                </p>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {currentOrder.items?.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-3 p-3 bg-surface-2 rounded-2xl border border-warm-line">
                    <div className="flex-1">
                      <h5 className="text-sm font-bold text-cream">{item.name}</h5>
                      <p className="text-xs text-cream-faint">{item.price.toLocaleString()} ден.</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 flex items-center justify-center bg-base rounded-lg font-bold text-cream border border-warm-line">
                        {item.quantity}
                      </span>
                      {item.status === 'pending' && (
                        <button
                          onClick={() => {
                            const newItems = [...(currentOrder.items || [])];
                            newItems.splice(idx, 1);
                            const total = newItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
                            setCurrentOrder({ ...currentOrder, items: newItems, totalAmount: total });
                          }}
                          className="p-1.5 text-red-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {(!currentOrder.items || currentOrder.items.length === 0) && (
                  <div className="h-full flex flex-col items-center justify-center text-cream-faint py-20">
                    <Plus size={48} className="mb-4 opacity-20" />
                    <p className="text-sm font-medium">Нарачката е празна</p>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-warm-line bg-surface-2/50 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-cream-muted uppercase tracking-widest">Вкупно</span>
                  <span className="text-2xl font-black text-cream">{(currentOrder.totalAmount || 0).toLocaleString()} ден.</span>
                </div>
                <button
                  onClick={sendToKitchen}
                  disabled={!currentOrder.items || currentOrder.items.length === 0}
                  className="w-full py-4 bg-accent text-[#faf5ee] rounded-2xl font-bold flex items-center justify-center gap-2 shadow-card hover:brightness-110 transition-all disabled:opacity-50 disabled:shadow-none"
                >
                  <Send size={20} />
                  Испрати во кујна
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default WaiterTerminal;
