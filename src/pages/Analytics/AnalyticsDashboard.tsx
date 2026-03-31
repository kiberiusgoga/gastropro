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
  Cell
} from 'recharts';
import { 
  TrendingUp, 
  DollarSign, 
  ShoppingBag, 
  Users, 
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Printer
} from 'lucide-react';
import { analyticsService } from '../../services/analyticsService';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const AnalyticsDashboard = () => {
  const [dailySales, setDailySales] = useState<unknown[]>([]);
  const [monthlySales, setMonthlySales] = useState<unknown[]>([]);
  const [topItems, setTopItems] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const [daily, monthly, top] = await Promise.all([
        analyticsService.getRevenueChartData(7),
        analyticsService.getMonthlyRevenueData(6),
        analyticsService.getTopSellingItems(5)
      ]);
      setDailySales(daily);
      setMonthlySales(monthly);
      setTopItems(top);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const stats = [
    { 
      label: 'Вкупен Промет (Денес)', 
      value: '42,500 ден', 
      change: '+12.5%', 
      trend: 'up',
      icon: DollarSign,
      color: 'blue'
    },
    { 
      label: 'Број на Нарачки', 
      value: '84', 
      change: '+5.2%', 
      trend: 'up',
      icon: ShoppingBag,
      color: 'emerald'
    },
    { 
      label: 'Просечна Сметка', 
      value: '506 ден', 
      change: '-2.1%', 
      trend: 'down',
      icon: TrendingUp,
      color: 'amber'
    },
    { 
      label: 'Нови Клиенти', 
      value: '12', 
      change: '+18%', 
      trend: 'up',
      icon: Users,
      color: 'purple'
    }
  ];

  if (loading) return <div className="p-8 text-center">Се вчитуваат податоци...</div>;

  return (
    <div className="p-6 lg:p-8 space-y-8 bg-slate-50 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">АНАЛИТИКА</h1>
          <p className="text-slate-500 font-medium">Преглед на перформансите на ресторанот</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-white rounded-xl p-1 shadow-sm border border-slate-200">
            {['24h', '7d', '30d', '12m'].map(range => (
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

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-2xl bg-${stat.color}-50 text-${stat.color}-600`}>
                <stat.icon size={24} />
              </div>
              <div className={`flex items-center gap-1 text-xs font-bold ${stat.trend === 'up' ? 'text-emerald-600' : 'text-red-600'}`}>
                {stat.trend === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {stat.change}
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900">{stat.value}</div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Sales Chart */}
        <div className="bg-white p-6 lg:p-8 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Промет по денови</h3>
            <Calendar className="text-slate-400" size={20} />
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailySales}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  cursor={{ fill: '#f8fafc' }}
                />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue Trend */}
        <div className="bg-white p-6 lg:p-8 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Месечен Тренд</h3>
            <TrendingUp className="text-slate-400" size={20} />
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlySales}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#8b5cf6" 
                  strokeWidth={4} 
                  dot={{ r: 6, fill: '#8b5cf6', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 8, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Top Selling Items */}
        <div className="lg:col-span-2 bg-white p-6 lg:p-8 rounded-3xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-8">Најпродавани производи</h3>
          <div className="space-y-6">
            {topItems.map((item, idx) => (
              <div key={idx} className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center font-black text-slate-400">
                  0{idx + 1}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="font-bold text-slate-900">{item.name}</span>
                    <span className="font-black text-slate-900">{item.count} продадени</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 rounded-full" 
                      style={{ width: `${topItems[0]?.count ? (item.count / topItems[0].count) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Category Distribution */}
        <div className="bg-white p-6 lg:p-8 rounded-3xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-8">Продажба по категории</h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Храна', value: 400 },
                    { name: 'Пијалоци', value: 300 },
                    { name: 'Десерти', value: 200 },
                    { name: 'Друго', value: 100 },
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {[400, 300, 200, 100].map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {['Храна', 'Пијалоци', 'Десерти', 'Друго'].map((cat, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx] }} />
                  <span className="font-bold text-slate-600">{cat}</span>
                </div>
                <span className="font-black text-slate-900">{[40, 30, 20, 10][idx]}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
