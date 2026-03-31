import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart,
  Area
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Package, 
  ArrowUpRight, 
  ArrowDownRight,
  Clock,
  Activity,
  Database
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { cn } from '../utils/cn';
import { seedService } from '../services/seedService';

const StatCard = ({ title, value, icon: Icon, color, trend, trendValue }: { title: string, value: string | number, icon: React.ElementType, color: string, trend?: 'up' | 'down', trendValue?: string }) => (
  <div className="card p-6 flex flex-col gap-4">
    <div className="flex items-center justify-between">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-${color}-600/20 bg-${color}-600`}>
        <Icon size={24} />
      </div>
      {trend && (
        <div className={`flex items-center gap-1 text-sm font-bold ${trend === 'up' ? 'text-emerald-600' : 'text-rose-600'}`}>
          {trend === 'up' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
          {trendValue}
        </div>
      )}
    </div>
    <div>
      <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
    </div>
  </div>
);

const Dashboard = () => {
  const { user, products, transactions, stats, loading, fetchProducts, fetchInventory, fetchStats } = useStore();
  const { t } = useTranslation();

  useEffect(() => {
    if (!products.length) fetchProducts();
    if (!transactions.length) fetchInventory();
    if (!stats) fetchStats();
  }, [products.length, transactions.length, stats, fetchProducts, fetchInventory, fetchStats]);

  if (!user) return null;

  const lowStockProducts = products.filter(p => p.currentStock <= p.minStock);
  const totalStockValue = stats?.totalStockValue || products.reduce((acc, p) => acc + (p.currentStock * p.purchasePrice), 0);
  
  const chartData = stats?.revenueByDay || [
    { name: 'Пон', value: 4000 },
    { name: 'Вто', value: 3000 },
    { name: 'Сре', value: 2000 },
    { name: 'Чет', value: 2780 },
    { name: 'Пет', value: 1890 },
    { name: 'Саб', value: 2390 },
    { name: 'Нед', value: 3490 },
  ];

  if (loading.stats || loading.products || loading.inventory) {
    return <div className="animate-pulse space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1,2,3,4].map(i => <div key={i} className="h-32 bg-slate-200 rounded-2xl"></div>)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-80 bg-slate-200 rounded-2xl"></div>
        <div className="h-80 bg-slate-200 rounded-2xl"></div>
      </div>
    </div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">{t('dashboard')}</h2>
          <p className="text-slate-500 font-medium">{t('welcome')}, {user.name}!</p>
        </div>
        {user.role === 'Admin' && (
          <button
            onClick={async () => {
              if (window.confirm('Дали сте сигурни дека сакате да генерирате демо податоци? Ова може да ги дуплира постоечките податоци.')) {
                const loadingToast = toast.loading('Генерирање податоци...');
                try {
                  await seedService.seedAll();
                  toast.success('Демо податоците се успешно генерирани!', { id: loadingToast });
                  window.location.reload();
                } catch {
                  toast.error('Грешка при генерирање податоци', { id: loadingToast });
                }
              }
            }}
            className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold text-sm hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
          >
            <Database size={18} />
            Генерирај Демо Податоци
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title={t('total_products')} 
          value={products.length} 
          icon={Package} 
          color="blue" 
          trend="up" 
          trendValue="12%" 
        />
        <StatCard 
          title={t('inventory_value')} 
          value={`${totalStockValue.toLocaleString()} ден.`} 
          icon={TrendingUp} 
          color="emerald" 
          trend="up" 
          trendValue="5.4%" 
        />
        <StatCard 
          title={t('low_stock_alert')} 
          value={lowStockProducts.length} 
          icon={AlertTriangle} 
          color="amber" 
          trend={lowStockProducts.length > 0 ? "down" : "up"} 
          trendValue={lowStockProducts.length > 0 ? "+2" : "0"} 
        />
        <StatCard 
          title={t('daily_transactions')} 
          value={transactions.length} 
          icon={Activity} 
          color="indigo" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold text-slate-900">{t('revenue_overview')}</h3>
            <select className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              <option>Последни 7 дена</option>
              <option>Последни 30 дена</option>
            </select>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  itemStyle={{color: '#3b82f6', fontWeight: 'bold'}}
                />
                <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold text-slate-900">{t('audit_trail')}</h3>
            <button className="text-blue-600 font-semibold text-sm hover:underline">{t('view_all')}</button>
          </div>
          <div className="space-y-6">
            {transactions.length > 0 ? transactions.map((tx) => (
              <div key={tx.id} className="flex items-start gap-4 group">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110",
                  tx.type === 'receipt' ? "bg-emerald-50 text-emerald-600" : 
                  tx.type === 'output' ? "bg-rose-50 text-rose-600" : "bg-blue-50 text-blue-600"
                )}>
                  {tx.type === 'receipt' ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-bold text-slate-900 truncate">
                      {t(tx.type)} - {products.find(p => p.id === tx.productId)?.name || t('unknown_product')}
                    </p>
                    <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                      <Clock size={12} />
                      {new Date(tx.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 flex items-center gap-2">
                    <span className={cn(
                      "font-bold",
                      tx.type === 'receipt' ? "text-emerald-600" : "text-rose-600"
                    )}>
                      {tx.type === 'receipt' ? '+' : '-'}{tx.quantity}
                    </span>
                    • {tx.note || t('no_note')}
                  </p>
                </div>
              </div>
            )) : (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <Activity size={48} className="mb-4 opacity-20" />
                <p>{t('no_data')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
