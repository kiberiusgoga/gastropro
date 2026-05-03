import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import {
  TrendingUp, TrendingDown, AlertTriangle, Package,
  ArrowUpRight, Clock, Activity, Database, DollarSign,
  ShoppingCart, BarChart3
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { cn } from '../utils/cn';
import { seedService } from '../services/seedService';
import { analyticsService } from '../services/analyticsService';

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  accent: string;         // Tailwind bg + text pair, e.g. "blue"
  trend?: 'up' | 'down';
  trendValue?: string;
  loading?: boolean;
}

const ACCENT: Record<string, { icon: string; badge: string; glow: string }> = {
  blue:    { icon: 'bg-blue-500 text-white',    badge: 'bg-blue-500/10 text-blue-500',    glow: 'bg-blue-500/10' },
  emerald: { icon: 'bg-emerald-500 text-white', badge: 'bg-emerald-500/10 text-emerald-500', glow: 'bg-emerald-500/10' },
  amber:   { icon: 'bg-amber-500 text-white',   badge: 'bg-amber-500/10 text-amber-500',  glow: 'bg-amber-500/10' },
  violet:  { icon: 'bg-violet-500 text-white',  badge: 'bg-violet-500/10 text-violet-500', glow: 'bg-violet-500/10' },
};

const StatCard = ({ title, value, icon: Icon, accent, trend, trendValue, loading }: StatCardProps) => {
  const a = ACCENT[accent] ?? ACCENT.blue;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 flex flex-col gap-4 group transition-all duration-300 hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5">
      <div className="flex items-start justify-between">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg ${a.icon} transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6`}>
          <Icon size={22} strokeWidth={2.5} />
        </div>
        {trend && trendValue && (
          <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider ${
            trend === 'up' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
          }`}>
            <ArrowUpRight size={12} strokeWidth={3} className={trend === 'down' ? 'rotate-90' : ''} />
            {trendValue}
          </div>
        )}
      </div>
      <div>
        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.18em] mb-1.5">{title}</p>
        {loading ? (
          <div className="h-8 w-28 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse" />
        ) : (
          <h3 className="text-3xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight font-display">{value}</h3>
        )}
      </div>
      <div className={`absolute -right-6 -bottom-6 w-24 h-24 rounded-full blur-2xl opacity-60 ${a.glow} transition-all duration-700 group-hover:scale-150 group-hover:opacity-80`} />
    </div>
  );
};

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl px-4 py-3 shadow-xl">
      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-lg font-black text-zinc-900 dark:text-zinc-50">
        {Number(payload[0].value).toLocaleString()} <span className="text-xs font-bold text-zinc-400">ден.</span>
      </p>
    </div>
  );
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

const Dashboard = () => {
  const { user, products, transactions, stats, loading, fetchProducts, fetchInventory, fetchStats } = useStore();
  const { t } = useTranslation();
  const [chartData, setChartData] = useState<{ date: string; revenue: number }[]>([]);
  const [todayRevenue, setTodayRevenue] = useState<number | null>(null);
  const [chartLoading, setChartLoading] = useState(true);

  useEffect(() => {
    if (!products.length) fetchProducts();
    if (!transactions.length) fetchInventory();
    if (!stats) fetchStats();
  }, [products.length, transactions.length, stats, fetchProducts, fetchInventory, fetchStats]);

  useEffect(() => {
    analyticsService.getAnalytics('7d').then(data => {
      setChartData(data.revenueByDay);
      setTodayRevenue(data.today.revenue);
      setChartLoading(false);
    });
  }, []);

  if (!user) return null;

  const lowStockProducts = (products || []).filter(p => p.currentStock <= p.minStock);
  const totalStockValue = stats?.totalStockValue ?? (products || []).reduce((acc, p) => acc + p.currentStock * p.purchasePrice, 0);
  const isStatsLoading = loading.stats || loading.products || loading.inventory;

  const hasChartData = chartData.some(d => d.revenue > 0);

  return (
    <div className="space-y-8 pb-20">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/30">
              <BarChart3 size={20} strokeWidth={2.5} />
            </div>
            <h2 className="text-3xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight font-display uppercase italic">
              {t('dashboard')}
            </h2>
          </div>
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest pl-13">
            {t('welcome')}, <span className="text-emerald-500">{user.name}</span>
          </p>
        </div>

        {user.role === 'Admin' && import.meta.env.DEV && (
          <button
            onClick={async () => {
              if (window.confirm(t('generate_demo_confirm'))) {
                const id = toast.loading(t('generating_data'));
                try {
                  await seedService.seedAll();
                  toast.success(t('demo_data_success'), { id });
                  window.location.reload();
                } catch {
                  toast.error(t('demo_data_error'), { id });
                }
              }
            }}
            className="flex items-center gap-2.5 px-6 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg"
          >
            <Database size={16} strokeWidth={2.5} />
            {t('generate_demo_data')}
          </button>
        )}
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('total_products')}
          value={isStatsLoading ? '…' : (products || []).length}
          icon={Package}
          accent="blue"
          trend="up"
          trendValue="12%"
          loading={isStatsLoading}
        />
        <StatCard
          title={t('inventory_value')}
          value={isStatsLoading ? '…' : `${isNaN(totalStockValue) ? 0 : totalStockValue.toLocaleString()} ден.`}
          icon={TrendingUp}
          accent="emerald"
          trend="up"
          trendValue="5.4%"
          loading={isStatsLoading}
        />
        <StatCard
          title={t('low_stock_alert')}
          value={isStatsLoading ? '…' : lowStockProducts.length}
          icon={AlertTriangle}
          accent="amber"
          trend={lowStockProducts.length > 0 ? 'down' : 'up'}
          trendValue={lowStockProducts.length > 0 ? `+${lowStockProducts.length}` : '0'}
          loading={isStatsLoading}
        />
        <StatCard
          title="Приход денес"
          value={todayRevenue === null ? '…' : `${todayRevenue.toLocaleString()} ден.`}
          icon={DollarSign}
          accent="violet"
          loading={chartLoading}
        />
      </div>

      {/* ── Revenue Chart ── */}
      <div className="rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-base font-black text-zinc-900 dark:text-zinc-50 uppercase tracking-tight font-display">
              {t('revenue_overview')}
            </h3>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">
              {t('finances_and_sales')} — последни 7 дена
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider">Live</span>
          </div>
        </div>

        {chartLoading ? (
          <div className="h-72 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl animate-pulse" />
        ) : !hasChartData ? (
          <div className="h-72 flex flex-col items-center justify-center text-zinc-300 dark:text-zinc-700 gap-3">
            <TrendingUp size={48} strokeWidth={1} />
            <p className="text-xs font-black uppercase tracking-widest">Нема податоци за прикажување</p>
          </div>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-zinc-100 dark:text-zinc-800" />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#71717a', fontSize: 11, fontWeight: 700 }}
                  dy={12}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#71717a', fontSize: 11, fontWeight: 700 }}
                  tickFormatter={v => v === 0 ? '0' : `${(v / 1000).toFixed(0)}k`}
                  width={36}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '4 2' }} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#revGrad)"
                  dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                  animationDuration={1200}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── Bottom Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Low Stock Warning */}
        <div className="rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-7">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-black text-zinc-900 dark:text-zinc-50 uppercase tracking-tight font-display">
                Ниска залиха
              </h3>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">Производи под минимум</p>
            </div>
            {lowStockProducts.length > 0 && (
              <span className="px-2.5 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-black rounded-lg uppercase">
                {lowStockProducts.length} алерти
              </span>
            )}
          </div>

          {isStatsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-12 bg-zinc-50 dark:bg-zinc-800 rounded-xl animate-pulse" />)}
            </div>
          ) : lowStockProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-zinc-300 dark:text-zinc-700 gap-2">
              <TrendingUp size={40} strokeWidth={1} />
              <p className="text-xs font-black uppercase tracking-widest">Залихата е уредна</p>
            </div>
          ) : (
            <div className="space-y-3">
              {lowStockProducts.slice(0, 5).map(p => (
                <div key={p.id} className="flex items-center gap-4 p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/10">
                  <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                    <AlertTriangle size={16} className="text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-zinc-900 dark:text-zinc-100 truncate">{p.name}</p>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase">
                      {p.currentStock} / мин. {p.minStock} {p.unit}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="w-16 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full"
                        style={{ width: `${Math.min(100, (p.currentStock / p.minStock) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Audit Trail */}
        <div className="rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-7">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-black text-zinc-900 dark:text-zinc-50 uppercase tracking-tight font-display">
                {t('audit_trail')}
              </h3>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">{t('live_activity')}</p>
            </div>
          </div>

          {(transactions || []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-zinc-300 dark:text-zinc-700 gap-2">
              <Activity size={40} strokeWidth={1} />
              <p className="text-xs font-black uppercase tracking-widest">{t('no_data')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {(transactions || []).slice(0, 5).map(tx => (
                <div key={tx.id} className="flex items-center gap-4 group">
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 group-hover:scale-110',
                    tx.type === 'receipt' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : tx.type === 'output' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                  )}>
                    {tx.type === 'receipt' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-sm font-black text-zinc-900 dark:text-zinc-100 truncate uppercase tracking-tight">
                        {products.find(p => p.id === tx.productId)?.name || t('unknown_product')}
                      </p>
                      <span className="text-[10px] font-bold text-zinc-400 flex items-center gap-1 ml-2 shrink-0">
                        <Clock size={10} />
                        {new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wide',
                        tx.type === 'receipt' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                      )}>
                        {tx.type === 'receipt' ? '+' : '-'}{tx.quantity}
                      </span>
                      {tx.note && (
                        <p className="text-[11px] text-zinc-400 font-medium italic truncate">{tx.note}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
