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
  <div className="card group p-8 flex flex-col gap-6 relative overflow-hidden">
    <div className="flex items-center justify-between relative z-10">
      <div className={`w-16 h-16 rounded-[2rem] flex items-center justify-center text-white shadow-xl shadow-${color}-500/20 bg-${color}-500 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6`}>
        <Icon size={32} />
      </div>
      {trend && (
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider ${trend === 'up' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/20'}`}>
          {trend === 'up' ? <ArrowUpRight size={14} strokeWidth={3} /> : <ArrowDownRight size={14} strokeWidth={3} />}
          {trendValue}
        </div>
      )}
    </div>
    <div className="relative z-10">
      <p className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">{title}</p>
      <h3 className="text-3xl font-black text-zinc-900 dark:text-zinc-100 font-display">{value}</h3>
    </div>
    <div className={`absolute -right-4 -bottom-4 w-32 h-32 bg-${color}-500/[0.03] rounded-full group-hover:scale-150 transition-transform duration-700`}></div>
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

  const lowStockProducts = (products || []).filter(p => p.currentStock <= p.minStock);
  const totalStockValue = stats?.totalStockValue || (products || []).reduce((acc, p) => acc + (p.currentStock * p.purchasePrice), 0);
  
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
    <div className="space-y-10 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-4xl font-black text-zinc-900 dark:text-zinc-100 tracking-tighter font-display uppercase italic">
            {t('dashboard')}
          </h2>
          <div className="flex items-center gap-2 text-zinc-500 font-bold">
            <span className="w-8 h-[2px] bg-emerald-500 rounded-full"></span>
            {t('welcome')}, <span className="text-zinc-900 dark:text-zinc-100">{user.name}</span>
          </div>
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
          value={(products || []).length} 
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
          value={(transactions || []).length} 
          icon={Activity} 
          color="indigo" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-10 lg:col-span-2">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100 font-display uppercase tracking-tight">{t('revenue_overview')}</h3>
              <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest mt-1">Финанси и Продажба</p>
            </div>
            <select className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all cursor-pointer">
              <option>Последни 7 дена</option>
              <option>Последни 30 дена</option>
            </select>
          </div>
          <div className="h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" opacity={0.5} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} 
                  dy={15} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} 
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.9)', 
                    backdropFilter: 'blur(8px)',
                    borderRadius: '1.5rem', 
                    border: '1px solid rgba(0,0,0,0.05)', 
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                    padding: '1.5rem'
                  }}
                  itemStyle={{color: '#3b82f6', fontWeight: 900, textTransform: 'uppercase', fontSize: '0.75rem'}}
                />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#3b82f6" 
                  strokeWidth={4} 
                  fillOpacity={1} 
                  fill="url(#colorValue)" 
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-10">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100 font-display uppercase tracking-tight">{t('audit_trail')}</h3>
              <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest mt-1">Активности во живо</p>
            </div>
            <button className="text-blue-600 dark:text-blue-400 font-black text-xs uppercase tracking-widest hover:underline">{t('view_all')}</button>
          </div>
          <div className="space-y-8">
            {(transactions || []).length > 0 ? (transactions || []).slice(0, 5).map((tx) => (
              <div key={tx.id} className="flex items-start gap-6 group">
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-500 group-hover:scale-110 group-hover:rotate-12",
                  tx.type === 'receipt' ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20" : 
                  tx.type === 'output' ? "bg-rose-50 text-rose-600 dark:bg-rose-900/20" : "bg-blue-50 text-blue-600 dark:bg-blue-900/20"
                )}>
                  {tx.type === 'receipt' ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-black text-zinc-900 dark:text-zinc-100 truncate uppercase tracking-tight">
                      {products.find(p => p.id === tx.productId)?.name || t('unknown_product')}
                    </p>
                    <span className="text-[10px] font-black text-zinc-400 flex items-center gap-1 uppercase">
                      <Clock size={12} />
                      {new Date(tx.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider",
                      tx.type === 'receipt' ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
                    )}>
                      {tx.type === 'receipt' ? '+' : '-'}{tx.quantity}
                    </span>
                    <p className="text-xs text-zinc-500 font-bold italic truncate flex-1">
                      {tx.note || t('no_note')}
                    </p>
                  </div>
                </div>
              </div>
            )) : (
              <div className="flex flex-col items-center justify-center py-10 text-zinc-300">
                <Activity size={64} strokeWidth={1} className="mb-4 opacity-20" />
                <p className="text-xs font-black uppercase tracking-widest">{t('no_data')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
