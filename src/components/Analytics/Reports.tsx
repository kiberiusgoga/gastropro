import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  FileText, 
  Download, 
  Calendar,
  Activity,
  ChevronRight
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart,
  Area
} from 'recharts';

const Reports = () => {
  const { products, transactions, invoices, fetchProducts, fetchInventory, fetchInvoices } = useStore();
  const { t } = useTranslation();

  useEffect(() => {
    if (!products.length) fetchProducts();
    if (!transactions.length) fetchInventory();
    if (!invoices.length) fetchInvoices();
  }, [products.length, transactions.length, invoices.length, fetchProducts, fetchInventory, fetchInvoices]);

  // Calculate stats
  const totalStockValue = products.reduce((acc, p) => acc + (p.currentStock * (p.purchasePrice || 0)), 0);
  const totalInvoicesValue = invoices.reduce((acc, inv) => acc + inv.totalAmount, 0);
  
  // Group transactions by date for chart
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split('T')[0];
  }).reverse();

  const chartData = last7Days.map(date => {
    const dayTxs = transactions.filter(tx => tx.date.startsWith(date));
    return {
      date: new Date(date).toLocaleDateString('mk-MK', { weekday: 'short' }),
      inputs: dayTxs.filter(tx => tx.type === 'input' || tx.type === 'receipt').reduce((acc, tx) => acc + tx.quantity, 0),
      outputs: dayTxs.filter(tx => tx.type === 'output').reduce((acc, tx) => acc + tx.quantity, 0),
    };
  });

  return (
    <div className="space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">{t('reports')}</h2>
          <p className="text-slate-500 font-medium">{t('business_analytics_and_insights')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn btn-secondary">
            <Calendar size={20} />
            {t('last_30_days')}
          </button>
          <button className="btn btn-primary">
            <Download size={20} />
            {t('export_pdf')}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-8 bg-gradient-to-br from-blue-600 to-blue-700 text-white border-none shadow-xl shadow-blue-200">
          <div className="flex items-center justify-between mb-6">
            <div className="p-3 bg-white/20 rounded-2xl">
              <DollarSign size={24} />
            </div>
            <span className="text-xs font-bold bg-white/20 px-3 py-1 rounded-full uppercase tracking-widest">
              {t('inventory_value')}
            </span>
          </div>
          <p className="text-4xl font-black mb-2">{totalStockValue.toLocaleString()} ден.</p>
          <p className="text-sm text-blue-100 font-medium">{t('total_asset_value_in_warehouse')}</p>
        </div>

        <div className="card p-8 bg-white">
          <div className="flex items-center justify-between mb-6">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
              <FileText size={24} />
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full uppercase tracking-widest">
              {t('purchases')}
            </span>
          </div>
          <p className="text-4xl font-black text-slate-900 mb-2">{totalInvoicesValue.toLocaleString()} ден.</p>
          <p className="text-sm text-slate-500 font-medium">{t('total_goods_received_value')}</p>
        </div>

        <div className="card p-8 bg-white">
          <div className="flex items-center justify-between mb-6">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
              <Activity size={24} />
            </div>
            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-widest">
              {t('movements')}
            </span>
          </div>
          <p className="text-4xl font-black text-slate-900 mb-2">{transactions.length}</p>
          <p className="text-sm text-slate-500 font-medium">{t('total_stock_transactions')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Stock Movement Chart */}
        <div className="card p-8">
          <h3 className="text-xl font-bold text-slate-900 mb-8 flex items-center gap-2">
            <BarChart3 size={24} className="text-blue-600" />
            {t('stock_movement_trends')}
          </h3>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorInputs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorOutputs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
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
                />
                <Area type="monotone" dataKey="inputs" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorInputs)" />
                <Area type="monotone" dataKey="outputs" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorOutputs)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Products */}
        <div className="card p-8">
          <h3 className="text-xl font-bold text-slate-900 mb-8 flex items-center gap-2">
            <TrendingUp size={24} className="text-blue-600" />
            {t('top_moving_products')}
          </h3>
          <div className="space-y-6">
            {products.sort((a, b) => b.currentStock - a.currentStock).slice(0, 5).map((product, idx) => (
              <div key={product.id} className="flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 font-bold group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                    {idx + 1}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{product.name}</p>
                    <p className="text-xs text-slate-500">{product.unit}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black text-slate-900">{product.currentStock.toLocaleString()}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('in_stock')}</p>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full mt-10 py-4 border-2 border-dashed border-slate-100 rounded-2xl text-slate-400 font-bold hover:border-blue-200 hover:text-blue-600 transition-all flex items-center justify-center gap-2">
            {t('view_full_inventory_report')}
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Reports;
