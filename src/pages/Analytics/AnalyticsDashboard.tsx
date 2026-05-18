import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { TrendingUp, DollarSign, ShoppingBag, FileText, Calendar, Filter, Printer } from 'lucide-react';
import { analyticsService, AnalyticsData } from '../../services/analyticsService';

const COLORS = ['#c2652a', '#10b981', '#f59e0b', '#ef4444', '#d47238', '#ec4899'];

const statCards = [
  { key: 'revenue',    label: 'Промет денес',      icon: DollarSign,   bgClass: 'bg-blue-900/20',    textClass: 'text-blue-400' },
  { key: 'orderCount', label: 'Нарачки денес',      icon: ShoppingBag,  bgClass: 'bg-emerald-900/20', textClass: 'text-emerald-400' },
  { key: 'avgTicket',  label: 'Просечна сметка',    icon: TrendingUp,   bgClass: 'bg-amber-900/20',   textClass: 'text-amber-400' },
  { key: 'total',      label: 'Вкупно (период)',    icon: FileText,     bgClass: 'bg-accent/10',      textClass: 'text-accent-light' },
];

const AnalyticsDashboard = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');

  useEffect(() => {
    setLoading(true);
    analyticsService.getAnalytics(timeRange).then(result => {
      setData(result);
      setLoading(false);
    });
  }, [timeRange]);

  const periodRevenue = (() => {
    if (!data) return 0;
    const arr = timeRange === '12m' ? (data.revenueByMonth ?? []) : (data.revenueByDay ?? []);
    return arr.reduce((s, r) => s + r.revenue, 0);
  })();

  const statValues: Record<string, string | number> = {
    revenue:    data?.today ? `${(data.today.revenue ?? 0).toLocaleString()} ден.` : '—',
    orderCount: data?.today ? (data.today.orderCount ?? 0) : '—',
    avgTicket:  data?.today ? `${(data.today.avgTicket ?? 0).toLocaleString()} ден.` : '—',
    total:      data ? `${periodRevenue.toLocaleString()} ден.` : '—',
  };

  const chartData = timeRange === '12m' ? data?.revenueByMonth ?? [] : data?.revenueByDay ?? [];
  const chartKey  = timeRange === '12m' ? 'month' : 'date';

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-cream tracking-tight font-serif italic">АНАЛИТИКА</h1>
          <p className="text-cream-faint font-medium">Преглед на перформансите на ресторанот</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-surface rounded-xl p-1 shadow-card border border-warm-line">
            {['7d', '30d', '12m'].map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${
                  timeRange === range ? 'bg-accent text-[#faf5ee] shadow-card-sm' : 'text-cream-muted hover:bg-surface-2/50'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
          <button
            onClick={() => window.print()}
            className="p-2.5 bg-surface rounded-xl shadow-card border border-warm-line text-cream-muted hover:bg-surface-2 hover:text-accent-light transition-all"
            title="Печати извештај"
          >
            <Printer size={20} />
          </button>
          <button className="p-2.5 bg-surface rounded-xl shadow-card border border-warm-line text-cream-muted hover:bg-surface-2 transition-all">
            <Filter size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map(stat => (
          <div key={stat.key} className="bg-surface p-6 rounded-3xl shadow-card border border-warm-line hover:shadow-card-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-2xl ${stat.bgClass} ${stat.textClass}`}>
                <stat.icon size={24} />
              </div>
            </div>
            <div className="text-2xl font-black text-cream">
              {loading ? <div className="h-8 w-24 bg-surface-2 animate-pulse rounded-lg" /> : statValues[stat.key]}
            </div>
            <div className="text-xs font-bold text-cream-faint uppercase tracking-wider mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-surface p-6 lg:p-8 rounded-3xl shadow-card border border-warm-line lg:col-span-2">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-black text-cream uppercase tracking-tight">
              {timeRange === '12m' ? 'Месечен промет' : 'Промет по денови'}
            </h3>
            <Calendar className="text-cream-faint" size={20} />
          </div>
          {loading ? (
            <div className="h-[300px] bg-surface-2 animate-pulse rounded-2xl" />
          ) : (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                {timeRange === '12m' ? (
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2e2921" />
                    <XAxis dataKey={chartKey} axisLine={false} tickLine={false} tick={{ fill: '#8c8279', fontSize: 12, fontWeight: 600 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#8c8279', fontSize: 12, fontWeight: 600 }} />
                    <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.3)', backgroundColor: '#252118', color: '#f5ede0' }} />
                    <Line type="monotone" dataKey="revenue" stroke="#c2652a" strokeWidth={4} dot={{ r: 6, fill: '#c2652a', strokeWidth: 2, stroke: '#252118' }} activeDot={{ r: 8, strokeWidth: 0 }} />
                  </LineChart>
                ) : (
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2e2921" />
                    <XAxis dataKey={chartKey} axisLine={false} tickLine={false} tick={{ fill: '#8c8279', fontSize: 12, fontWeight: 600 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#8c8279', fontSize: 12, fontWeight: 600 }} />
                    <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.3)', backgroundColor: '#252118', color: '#f5ede0' }} cursor={{ fill: '#2f2a1f' }} />
                    <Bar dataKey="revenue" fill="#c2652a" radius={[6, 6, 0, 0]} barSize={32} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-surface p-6 lg:p-8 rounded-3xl shadow-card border border-warm-line">
          <h3 className="text-lg font-black text-cream uppercase tracking-tight mb-8">Најпродавани производи</h3>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-10 bg-surface-2 animate-pulse rounded-xl" />)}
            </div>
          ) : data?.topItems.length === 0 ? (
            <p className="text-cream-faint text-sm font-bold text-center py-10">Нема податоци</p>
          ) : (
            <div className="space-y-6">
              {(data?.topItems ?? []).slice(0, 8).map((item, idx) => (
                <div key={idx} className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-surface-2 flex items-center justify-center font-black text-cream-faint shrink-0">
                    {String(idx + 1).padStart(2, '0')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between mb-1">
                      <span className="font-bold text-cream truncate">{item.name}</span>
                      <span className="font-black text-cream ml-4 shrink-0">{item.count} бр.</span>
                    </div>
                    <div className="w-full h-2 bg-surface-2 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full"
                        style={{ width: `${data?.topItems?.[0]?.count ? (item.count / data.topItems[0].count) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-surface p-6 lg:p-8 rounded-3xl shadow-card border border-warm-line">
          <h3 className="text-lg font-black text-cream uppercase tracking-tight mb-8">По категории</h3>
          {loading ? (
            <div className="h-[250px] bg-surface-2 animate-pulse rounded-2xl" />
          ) : data?.byCategory.length === 0 ? (
            <p className="text-cream-faint text-sm font-bold text-center py-20">Нема податоци</p>
          ) : (
            <>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data?.byCategory}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {(data?.byCategory ?? []).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => [`${v.toLocaleString()} ден.`, '']} contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: '#252118', color: '#f5ede0' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 space-y-2">
                {(data?.byCategory ?? []).map((cat, idx) => {
                  const total = (data?.byCategory ?? []).reduce((s, c) => s + c.value, 0);
                  const pct = total > 0 ? Math.round((cat.value / total) * 100) : 0;
                  return (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                        <span className="font-bold text-cream-muted truncate">{cat.name}</span>
                      </div>
                      <span className="font-black text-cream ml-2">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
