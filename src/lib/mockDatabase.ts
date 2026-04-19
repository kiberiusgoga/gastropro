import { Product, MenuCategory, MenuItem, Table, Transaction, User, Shift, Order } from '../types';

interface MockDB {
  products: Product[];
  menuCategories: MenuCategory[];
  menuItems: MenuItem[];
  tables: Table[];
  transactions: Transaction[];
  users: User[];
  shifts: Shift[];
  orders: Order[];
  customers: Customer[];
}

const defaultDB: MockDB = {
  products: [
    { id: 'p1', restaurantId: '1', name: 'Кафе Зрно (Arabica)', barcode: '1001', unit: 'kg', purchasePrice: 450, sellingPrice: 0, categoryId: 'cat1', currentStock: 8.5, minStock: 3, active: true },
    { id: 'p2', restaurantId: '1', name: 'Брашно Тип 400', barcode: '1002', unit: 'kg', purchasePrice: 35, sellingPrice: 0, categoryId: 'cat2', currentStock: 120, minStock: 25, active: true },
    { id: 'p3', restaurantId: '1', name: 'Моцарела (Fresh)', barcode: '1003', unit: 'kg', purchasePrice: 380, sellingPrice: 0, categoryId: 'cat2', currentStock: 2.2, minStock: 5, active: true },
    { id: 'p4', restaurantId: '1', name: 'Домашен Сос', barcode: '1004', unit: 'kg', purchasePrice: 120, sellingPrice: 0, categoryId: 'cat2', currentStock: 15, minStock: 10, active: true },
    { id: 'p5', restaurantId: '1', name: 'Свеж Лосос', barcode: '1005', unit: 'kg', purchasePrice: 850, sellingPrice: 0, categoryId: 'cat3', currentStock: 4, minStock: 2, active: true },
    { id: 'p6', restaurantId: '1', name: 'Бело Вино (Chardonnay)', barcode: '1006', unit: 'l', purchasePrice: 320, sellingPrice: 0, categoryId: 'cat1', currentStock: 24, minStock: 12, active: true },
    { id: 'p7', restaurantId: '1', name: 'Маслиново Масло (Bio)', barcode: '1007', unit: 'l', purchasePrice: 480, sellingPrice: 0, categoryId: 'cat2', currentStock: 5, minStock: 3, active: true },
    { id: 'p8', restaurantId: '1', name: 'Пршута', barcode: '1008', unit: 'kg', purchasePrice: 1100, sellingPrice: 0, categoryId: 'cat2', currentStock: 1.5, minStock: 2, active: true },
    { id: 'p9', restaurantId: '1', name: 'Млеко 3.2%', barcode: '1009', unit: 'l', purchasePrice: 55, sellingPrice: 0, categoryId: 'cat1', currentStock: 30, minStock: 10, active: true },
    { id: 'p10', restaurantId: '1', name: 'Шеќер', barcode: '1010', unit: 'kg', purchasePrice: 42, sellingPrice: 0, categoryId: 'cat1', currentStock: 15, minStock: 5, active: true },
    { id: 'p11', restaurantId: '1', name: 'Домати', barcode: '1011', unit: 'kg', purchasePrice: 65, sellingPrice: 0, categoryId: 'cat2', currentStock: 8, minStock: 10, active: true },
    { id: 'p12', restaurantId: '1', name: 'Кромид', barcode: '1012', unit: 'kg', purchasePrice: 20, sellingPrice: 0, categoryId: 'cat2', currentStock: 20, minStock: 5, active: true },
    { id: 'p13', restaurantId: '1', name: 'Пилешки Гради', barcode: '1013', unit: 'kg', purchasePrice: 310, sellingPrice: 0, categoryId: 'cat2', currentStock: 12, minStock: 15, active: true },
    { id: 'p14', restaurantId: '1', name: 'Ризо Ориз', barcode: '1014', unit: 'kg', purchasePrice: 95, sellingPrice: 0, categoryId: 'cat2', currentStock: 25, minStock: 10, active: true },
    { id: 'p15', restaurantId: '1', name: 'Минерална Вода 0.75л', barcode: '1015', unit: 'pcs', purchasePrice: 25, sellingPrice: 0, categoryId: 'cat1', currentStock: 60, minStock: 24, active: true },
    { id: 'p16', restaurantId: '1', name: 'Павлака за Готвење', barcode: '1016', unit: 'l', purchasePrice: 180, sellingPrice: 0, categoryId: 'cat2', currentStock: 10, minStock: 5, active: true },
    { id: 'p17', restaurantId: '1', name: 'Чоколадо за Готвење', barcode: '1017', unit: 'kg', purchasePrice: 450, sellingPrice: 0, categoryId: 'cat5', currentStock: 5, minStock: 2, active: true },
    { id: 'p18', restaurantId: '1', name: 'Јајца (XL)', barcode: '1018', unit: 'pcs', purchasePrice: 8, sellingPrice: 0, categoryId: 'cat2', currentStock: 120, minStock: 30, active: true },
    { id: 'p19', restaurantId: '1', name: 'Рукола', barcode: '1019', unit: 'kg', purchasePrice: 600, sellingPrice: 0, categoryId: 'cat2', currentStock: 0.5, minStock: 1, active: true },
    { id: 'p20', restaurantId: '1', name: 'Пармезан (Aged)', barcode: '1020', unit: 'kg', purchasePrice: 1400, sellingPrice: 0, categoryId: 'cat2', currentStock: 2.5, minStock: 1, active: true },
  ],
  menuCategories: [
    { id: 'mc1', restaurantId: '1', name: 'Топли Пијалоци', sortOrder: 1, active: true },
    { id: 'mc2', restaurantId: '1', name: 'Студени Пијалоци', sortOrder: 2, active: true },
    { id: 'mc3', restaurantId: '1', name: 'Предјадења', sortOrder: 3, active: true },
    { id: 'mc4', restaurantId: '1', name: 'Пици', sortOrder: 4, active: true },
    { id: 'mc5', restaurantId: '1', name: 'Пасти и Рижото', sortOrder: 5, active: true },
    { id: 'mc6', restaurantId: '1', name: 'Главни Јадења', sortOrder: 6, active: true },
    { id: 'mc7', restaurantId: '1', name: 'Десерти', sortOrder: 7, active: true },
  ],
  menuItems: [
    { id: 'mi1', restaurantId: '1', name: 'Еспресо', price: 70, menuCategoryId: 'mc1', active: true, preparationStation: 'bar', description: 'Кратки еспресо од 100% Арабика' },
    { id: 'mi2', restaurantId: '1', name: 'Капучино', price: 100, menuCategoryId: 'mc1', active: true, preparationStation: 'bar' },
    { id: 'mi3', restaurantId: '1', name: 'Фреш од Портокал', price: 150, menuCategoryId: 'mc2', active: true, preparationStation: 'bar' },
    { id: 'mi4', restaurantId: '1', name: 'Брускет со Лосос', price: 240, menuCategoryId: 'mc3', active: true, preparationStation: 'kitchen' },
    { id: 'mi5', restaurantId: '1', name: 'Пица Маргарита', price: 320, menuCategoryId: 'mc4', active: true, preparationStation: 'kitchen', description: 'Класична пица со моцарела и домашен сос' },
    { id: 'mi6', restaurantId: '1', name: 'Пица Капричиоза', price: 380, menuCategoryId: 'mc4', active: true, preparationStation: 'kitchen' },
    { id: 'mi7', restaurantId: '1', name: 'Пица Кватро Формаџи', price: 420, menuCategoryId: 'mc4', active: true, preparationStation: 'kitchen' },
    { id: 'mi8', restaurantId: '1', name: 'Паста Карбонара', price: 350, menuCategoryId: 'mc5', active: true, preparationStation: 'kitchen' },
    { id: 'mi9', restaurantId: '1', name: 'Рижото со Пилешко', price: 340, menuCategoryId: 'mc5', active: true, preparationStation: 'kitchen' },
    { id: 'mi10', restaurantId: '1', name: 'Пилешки Стек', price: 360, menuCategoryId: 'mc6', active: true, preparationStation: 'grill' },
    { id: 'mi11', restaurantId: '1', name: 'Печен Лосос', price: 850, menuCategoryId: 'mc6', active: true, preparationStation: 'kitchen' },
    { id: 'mi12', restaurantId: '1', name: 'Чизкејк Боровинка', price: 180, menuCategoryId: 'mc7', active: true, preparationStation: 'dessert' },
    { id: 'mi13', restaurantId: '1', name: 'Лава Колач', price: 210, menuCategoryId: 'mc7', active: true, preparationStation: 'dessert' },
    { id: 'mi14', restaurantId: '1', name: 'Тирамису', price: 190, menuCategoryId: 'mc7', active: true, preparationStation: 'dessert' },
    { id: 'mi15', restaurantId: '1', name: 'Шопска Салата', price: 160, menuCategoryId: 'mc3', active: true, preparationStation: 'kitchen' },
  ],
  tables: [
    { id: 't1', restaurantId: '1', number: 1, capacity: 4, status: 'free', zone: 'Сала' },
    { id: 't2', restaurantId: '1', number: 2, capacity: 4, status: 'free', zone: 'Сала' },
    { id: 't3', restaurantId: '1', number: 3, capacity: 2, status: 'occupied', zone: 'Тераса', currentOrderId: 'o1' },
    { id: 't4', restaurantId: '1', number: 4, capacity: 6, status: 'free', zone: 'Тераса' },
    { id: 't5', restaurantId: '1', number: 5, capacity: 2, status: 'free', zone: 'ВИП' },
    { id: 't6', restaurantId: '1', number: 6, capacity: 4, status: 'free', zone: 'Сала' },
    { id: 't7', restaurantId: '1', number: 7, capacity: 4, status: 'occupied', zone: 'Тераса', currentOrderId: 'o_curr_1' },
    { id: 't8', restaurantId: '1', number: 8, capacity: 2, status: 'free', zone: 'Сала' },
  ],
  transactions: Array.from({ length: 40 }, (_, i) => ({
    id: `tx_${i}`,
    restaurantId: '1',
    productId: `p${(i % 20) + 1}`,
    type: i % 3 === 0 ? 'input' : 'output',
    quantity: Math.floor(Math.random() * 10) + 1,
    previousStock: 20,
    newStock: i % 3 === 0 ? 30 : 10,
    date: new Date(Date.now() - Math.random() * 15 * 86400000).toISOString(),
    userId: 'demo123'
  })),
  users: [
    { id: 'demo123', restaurantId: '1', name: 'Администратор', email: 'admin@storehouse.mk', role: 'Admin', active: true, createdAt: new Date().toISOString() },
    { id: 'u2', restaurantId: '1', name: 'Петар Келнер', email: 'petar@storehouse.mk', role: 'Waiter', active: true, createdAt: new Date().toISOString() },
    { id: 'u3', restaurantId: '1', name: 'Ана Менаџер', email: 'ana@storehouse.mk', role: 'Manager', active: true, createdAt: new Date().toISOString() },
    { id: 'u4', restaurantId: '1', name: 'Игор Главни', email: 'igor@storehouse.mk', role: 'Chef', active: true, createdAt: new Date().toISOString() },
  ],
  shifts: [
    { id: 's1', restaurantId: '1', userId: 'demo123', userName: 'Администратор', startTime: new Date().toISOString(), startingCash: 2000, status: 'open', totalSales: 4500 },
  ],
  orders: [
    // Historical Orders for last 30 days
    ...Array.from({ length: 60 }, (_, i) => {
      const orderDate = new Date();
      orderDate.setDate(orderDate.getDate() - (i % 30));
      orderDate.setHours(12 + (i % 8), Math.floor(Math.random() * 60));
      const amount = 300 + Math.floor(Math.random() * 2000);
      return {
        id: `old_o_${i}`,
        restaurantId: '1',
        tableId: `t${(i % 8) + 1}`,
        items: [
          { id: `oi_${i}_1`, restaurantId: '1', orderId: `old_o_${i}`, productId: `mi${(i % 15) + 1}`, name: 'Demo Item', quantity: 2, price: amount / 2, status: 'paid', isBundle: false }
        ],
        status: 'paid',
        orderType: i % 5 === 0 ? 'takeaway' : 'dine_in',
        totalAmount: amount,
        subtotal: amount,
        createdAt: orderDate.toISOString(),
        closedAt: new Date(orderDate.getTime() + 1800000).toISOString(),
        userId: 'u2',
        shiftId: 's_old'
      };
    }),
    { 
      id: 'o_curr_1', 
      restaurantId: '1', 
      tableId: 't7', 
      items: [
        { id: 'oi_c1', restaurantId: '1', orderId: 'o_curr_1', productId: 'mi5', name: 'Пица Маргарита', quantity: 1, price: 320, status: 'served', isBundle: false },
        { id: 'oi_c2', restaurantId: '1', orderId: 'o_curr_1', productId: 'mi2', name: 'Капучино', quantity: 2, price: 100, status: 'sent_to_kitchen', isBundle: false }
      ], 
      status: 'sent_to_kitchen', 
      orderType: 'dine_in', 
      totalAmount: 520, 
      createdAt: new Date().toISOString(), 
      userId: 'u2',
      shiftId: 's1'
    }
  ],
  customers: [
    { id: 'c1', restaurantId: '1', name: 'Марко Марковски', phone: '070111222', email: 'marko@gmail.com', totalSpent: 8500, orderHistory: [], loyaltyPoints: 450, lastVisit: new Date().toISOString() },
    { id: 'c2', restaurantId: '1', name: 'Елена Петрова', phone: '071333444', email: 'elena@yahoo.com', totalSpent: 4200, orderHistory: [], loyaltyPoints: 210, lastVisit: new Date(Date.now() - 172800000).toISOString() },
    { id: 'c3', restaurantId: '1', name: 'Зоран Стојановски', phone: '075555666', email: 'zoran@gmail.com', totalSpent: 12400, orderHistory: [], loyaltyPoints: 890, lastVisit: new Date().toISOString() },
    { id: 'c4', restaurantId: '1', name: 'Марија Костадинова', phone: '072777888', email: 'marija.k@gmail.com', totalSpent: 3100, orderHistory: [], loyaltyPoints: 150, lastVisit: new Date(Date.now() - 604800000).toISOString() },
    { id: 'c5', restaurantId: '1', name: 'Драган Ристовски', phone: '078999000', email: 'dragan.r@gmail.com', totalSpent: 5600, orderHistory: [], loyaltyPoints: 320, lastVisit: new Date().toISOString() },
    { id: 'c6', restaurantId: '1', name: 'Симона Николова', phone: '070888999', email: 'simona@outlook.com', totalSpent: 9200, orderHistory: [], loyaltyPoints: 610, lastVisit: new Date(Date.now() - 259200000).toISOString() },
    { id: 'c7', restaurantId: '1', name: 'Никола Велковски', phone: '071222333', email: 'nikola.v@gmail.com', totalSpent: 1500, orderHistory: [], loyaltyPoints: 80, lastVisit: new Date().toISOString() },
    { id: 'c8', restaurantId: '1', name: 'Катерина Арсова', phone: '075444555', email: 'kate.arsova@gmail.com', totalSpent: 2800, orderHistory: [], loyaltyPoints: 140, lastVisit: new Date(Date.now() - 432000000).toISOString() },
    { id: 'c9', restaurantId: '1', name: 'Александар Тасев', phone: '072666777', email: 'ace.t@gmail.com', totalSpent: 11000, orderHistory: [], loyaltyPoints: 750, lastVisit: new Date().toISOString() },
    { id: 'c10', restaurantId: '1', name: 'Милена Спасовска', phone: '078111999', email: 'milena.s@gmail.com', totalSpent: 6700, orderHistory: [], loyaltyPoints: 400, lastVisit: new Date(Date.now() - 86400000).toISOString() },
  ]
};

export class MockDatabase {
  private db!: MockDB;

  constructor() {
    this.load();
  }

  private load() {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem('gastropro_mock_db');
    if (saved) {
      try {
        this.db = JSON.parse(saved);
      } catch {
        this.db = defaultDB;
      }
    } else {
      this.db = defaultDB;
      this.save();
    }
  }

  save() {
    if (typeof window === 'undefined') return;
    localStorage.setItem('gastropro_mock_db', JSON.stringify(this.db));
  }

  get(collection: keyof MockDB) {
    return this.db[collection] || [];
  }

  add(collection: keyof MockDB, item: any) {
    item.id = item.id || Math.random().toString(36).substr(2, 9);
    (this.db[collection] as any[]).push(item);
    this.save();
    return item;
  }

  update(collection: keyof MockDB, id: string, updates: any) {
    const arr = this.db[collection] as any[];
    const index = arr.findIndex((i: any) => i.id === id);
    if (index !== -1) {
      arr[index] = { ...arr[index], ...updates };
      this.save();
      return arr[index];
    }
    return null;
  }

  remove(collection: keyof MockDB, id: string) {
    this.db[collection] = (this.db[collection] as any).filter((i: any) => i.id !== id);
    this.save();
  }

  // Generate dynamic dashboard stats
  getDashboardStats() {
    const products = this.db.products;
    const orders = this.db.orders.filter(o => o.status === 'paid');
    
    // Calculate total revenue
    const totalRevenue = orders.reduce((acc, o) => acc + (o.totalAmount || 0), 0);
    
    // Group monthly for the chart (last 7 days usually)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('mk-MK', { weekday: 'short' });
      const dayEarnings = orders
        .filter(o => o.createdAt.startsWith(dateStr))
        .reduce((acc, o) => acc + (o.totalAmount || 0), 0);
      return { name: dayName, value: dayEarnings || Math.floor(Math.random() * 1000) + 500 }; // Fallback to random if no data yet
    }).reverse();

    // Calculate top selling items
    const itemCounts: Record<string, number> = {};
    orders.forEach(o => {
      o.items.forEach(item => {
        itemCounts[item.name] = (itemCounts[item.name] || 0) + item.quantity;
      });
    });
    
    const topItems = Object.entries(itemCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, value]) => ({ name, value }));

    return {
      totalProducts: products.length,
      totalStockValue: products.reduce((acc, p) => acc + (p.currentStock * p.purchasePrice), 0),
      lowStockCount: products.filter(p => (p.currentStock || 0) <= (p.minStock || 0)).length,
      dailyTransactions: this.db.transactions.length,
      revenueByDay: last7Days,
      topSellingItems: topItems.length > 0 ? topItems : [
        { name: 'Еспресо', value: 45 },
        { name: 'Маргарита', value: 32 },
        { name: 'Капучино', value: 28 }
      ],
      categoryPerformance: this.db.menuCategories.map(c => ({ name: c.name, value: Math.floor(Math.random() * 100) + 20 }))
    };
  }
}

export const mockDb = new MockDatabase();
