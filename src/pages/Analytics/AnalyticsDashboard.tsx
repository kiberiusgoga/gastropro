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

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const statCards = [
  { key: 'revenue',    label: 'Промет денес',      icon: DollarSign,   bgClass: 'bg-blue-50',    textClass: 'text-blue-600' },
  { key: 'orderCount', label: 'Нарачки денес',      icon: ShoppingBag,  bgClass: 'bg-emerald-50', textClass: 'text-emerald-600' },
  { key: 'avgTicket',  label: 'Просечна сметка',    icon: TrendingUp,   bgClass: 'bg-amber-50',   textClass: 'text-amber-600' },
  { key: 'total',      label: 'Вкупно (период)',    icon: FileText,     bgClass: 'bg-purple-50',  textClass: 'text-purple-600' },
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
    <div className="p-6 lg:p-8 space-y-8 bg-slate-50 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">АНАЛИТИКА</h1>
          <p className="text-slate-500 font-medium">Преглед на перформансите на ресторанот</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-white rounded-xl p-1 shadow-sm border border-slate-200">
            {['7d', '30d', '12m'].map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${
                  timeRange === range ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
          <button
            onClick={() => window.print()}
            className="p-2.5 bg-white rounded-xl shadow-sm border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-all"
            title="Печати извештај"
          >
            <Printer size={20} />
          </button>
          <button className="p-2.5 bg-white rounded-xl shadow-sm border border-slate-200 text-slate-600 hover:bg-slate-50">
            <Filter size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map(stat => (
          <div key={stat.key} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-2xl ${stat.bgClass} ${stat.textClass}`}>
                <stat.icon size={24} />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900">
              {loading ? <div className="h-8 w-24 bg-slate-100 animate-pulse rounded-lg" /> : statValues[stat.key]}
            </div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 lg:p-8 rounded-3xl shadow-sm border border-slate-100 lg:col-span-2">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
              {timeRange === '12m' ? 'Месечен промет' : 'Промет по денови'}
            </h3>
            <Calendar className="text-slate-400" size={20} />
          </div>
          {loading ? (
            <div className="h-[300px] bg-slate-50 animate-pulse rounded-2xl" />
          ) : (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                {timeRange === '12m' ? (
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey={chartKey} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }} />
                    <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                    <Line type="monotone" dataKey="revenue" stroke="#8b5cf6" strokeWidth={4} dot={{ r: 6, fill: '#8b5cf6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8, strokeWidth: 0 }} />
                  </LineChart>
                ) : (
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey={chartKey} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }} />
                    <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} cursor={{ fill: '#f8fafc' }} />
                    <Bar dataKey="revenue" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={32} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-6 lg:p-8 rounded-3xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-8">Најпродавани производи</h3>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-10 bg-slate-50 animate-pulse rounded-xl" />)}
            </div>
          ) : data?.topItems.length === 0 ? (
            <p className="text-slate-400 text-sm font-bold text-center py-10">Нема податоци</p>
          ) : (
            <div className="space-y-6">
              {(data?.topItems ?? []).slice(0, 8).map((item, idx) => (
                <div key={idx} className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center font-black text-slate-400 shrink-0">
                    {String(idx + 1).padStart(2, '0')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between mb-1">
                      <span className="font-bold text-slate-900 truncate">{item.name}</span>
                      <span className="font-black text-slate-900 ml-4 shrink-0">{item.count} бр.</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${data?.topItems?.[0]?.count ? (item.count / data.topItems[0].count) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white p-6 lg:p-8 rounded-3xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-8">По категории</h3>
          {loading ? (
            <div className="h-[250px] bg-slate-50 animate-pulse rounded-2xl" />
          ) : data?.byCategory.length === 0 ? (
            <p className="text-slate-400 text-sm font-bold text-center py-20">Нема податоци</p>
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
                    <Tooltip formatter={(v: number) => [`${v.toLocaleString()} ден.`, '']} />
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
                        <span className="font-bold text-slate-600 truncate">{cat.name}</span>
                      </div>
                      <span className="font-black text-slate-900 ml-2">{pct}%</span>
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
