import React from 'react';
import { DailyStats, MenuItem } from '../../types';
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
  Cell
} from 'recharts';
import { TrendingUp, ShoppingBag, Calendar, PieChart as PieChartIcon, DollarSign } from 'lucide-react';
import { motion } from 'motion/react';
import D3CategoryChart from './D3CategoryChart';
import D3RevenueChart from './D3RevenueChart';

interface AnalyticsViewProps {
  stats: DailyStats[];
  menu: MenuItem[];
  isDarkMode: boolean;
}

const AnalyticsView: React.FC<AnalyticsViewProps> = ({ stats, menu, isDarkMode }) => {
  const totalRevenue = stats.reduce((acc, s) => acc + s.revenue, 0);
  const totalOrders = stats.reduce((acc, s) => acc + s.ordersCount, 0);
  const avgOrderValue = totalOrders > 0 ? (totalRevenue / totalOrders).toFixed(2) : 0;

  const itemCounts: { [key: string]: number } = {};
  stats.forEach(s => {
    s.topItems.forEach(item => {
      itemCounts[item.name] = (itemCounts[item.name] || 0) + item.count;
    });
  });

  const topItemsData = Object.entries(itemCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const COLORS = ['#c2652a', '#10b981', '#f59e0b', '#d47238', '#ef4444'];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Вкупен промет', value: `${totalRevenue} ден.`, icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-900/20' },
          { label: 'Вкупно нарачки', value: totalOrders, icon: ShoppingBag, color: 'text-blue-400', bg: 'bg-blue-900/20' },
          { label: 'Просечна сметка', value: `${avgOrderValue} ден.`, icon: TrendingUp, color: 'text-amber-400', bg: 'bg-amber-900/20' },
          { label: 'Денови активни', value: stats.length, icon: Calendar, color: 'text-accent-light', bg: 'bg-accent/10' },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-surface p-6 rounded-3xl border border-warm-line shadow-card"
          >
            <div className={`w-12 h-12 rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center mb-4`}>
              <stat.icon size={24} />
            </div>
            <h3 className="text-cream-faint text-sm font-bold uppercase tracking-wider">{stat.label}</h3>
            <p className="text-2xl font-black mt-1 text-cream">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-surface p-8 rounded-[2.5rem] border border-warm-line shadow-card">
          <h3 className="text-xl font-black mb-8 text-cream">Дневен промет</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2e2921" />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#8c8279', fontSize: 12 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#8c8279', fontSize: 12 }}
                  dx={-10}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.3)', backgroundColor: '#252118', color: '#f5ede0' }}
                  itemStyle={{ color: '#f5ede0' }}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#c2652a"
                  strokeWidth={4}
                  dot={{ r: 6, fill: '#c2652a', strokeWidth: 2, stroke: '#252118' }}
                  activeDot={{ r: 8, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-surface p-8 rounded-[2.5rem] border border-warm-line shadow-card">
          <h3 className="text-xl font-black mb-8 text-cream">Најпродавани артикли</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topItemsData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#2e2921" />
                <XAxis type="number" hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#b8aa97', fontSize: 12, fontWeight: 700 }}
                  width={120}
                />
                <Tooltip
                  cursor={{ fill: '#2f2a1f', opacity: 0.5 }}
                  contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.3)', backgroundColor: '#252118', color: '#f5ede0' }}
                />
                <Bar dataKey="count" radius={[0, 10, 10, 0]} barSize={30}>
                  {topItemsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-surface p-8 rounded-[2.5rem] border border-warm-line shadow-card">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-surface-2 text-cream flex items-center justify-center">
            <PieChartIcon size={20} />
          </div>
          <h3 className="text-xl font-black text-cream">Продажба по категории (D3.js)</h3>
        </div>
        <D3CategoryChart stats={stats} menu={menu} isDarkMode={isDarkMode} />
      </div>

      <div className="bg-surface p-8 rounded-[2.5rem] border border-warm-line shadow-card">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-accent text-[#faf5ee] flex items-center justify-center">
            <TrendingUp size={20} />
          </div>
          <h3 className="text-xl font-black text-cream">Трендови на промет (D3.js)</h3>
        </div>
        <D3RevenueChart stats={stats} isDarkMode={isDarkMode} />
      </div>

      <div className="bg-surface-2 text-cream p-10 rounded-[3rem] shadow-card-lg relative overflow-hidden border border-warm-line-strong">
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="text-4xl font-black mb-4 leading-tight text-cream font-serif italic">Интелигентна прогноза за залихи</h2>
            <p className="text-cream-muted text-lg mb-8">Врз основа на вашата продажба во последните 7 дена, предвидуваме дека следните намирници ќе бидат потрошени наскоро:</p>

            <div className="space-y-4">
              {[
                { name: 'Домати', daysLeft: 2, status: 'critical' },
                { name: 'Пилешко филе', daysLeft: 3, status: 'warning' },
                { name: 'Кафе во зрно', daysLeft: 5, status: 'safe' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-base/30 rounded-2xl border border-warm-line">
                  <div className="flex items-center gap-4">
                    <div className={`w-3 h-3 rounded-full ${
                      item.status === 'critical' ? 'bg-red-500' : item.status === 'warning' ? 'bg-orange-500' : 'bg-emerald-500'
                    }`} />
                    <span className="font-bold text-cream">{item.name}</span>
                  </div>
                  <span className="text-sm font-bold text-cream-faint">Уште {item.daysLeft} дена</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-center">
            <div className="w-64 h-64 rounded-full border-8 border-emerald-500/20 flex items-center justify-center relative">
              <div className="text-center">
                <p className="text-5xl font-black text-emerald-500">84%</p>
                <p className="text-xs font-bold text-cream-faint uppercase tracking-widest mt-2">Ефикасност на залиха</p>
              </div>
              <div className="absolute inset-0 border-8 border-emerald-500 rounded-full border-t-transparent animate-spin-slow"></div>
            </div>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-accent/8 rounded-full blur-[100px] -mr-48 -mt-48"></div>
      </div>
    </div>
  );
};

export default AnalyticsView;
