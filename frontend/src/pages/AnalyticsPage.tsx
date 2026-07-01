import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { analyticsApi, usersApi } from '../api';
import { fmt, CATEGORY_ICONS } from '../utils/helpers';
import MonthlyChart from '../components/charts/MonthlyChart';
import CategoryChart from '../components/charts/CategoryChart';

export default function AnalyticsPage() {
  const { data: monthly = [] } = useQuery({ queryKey: ['analytics', 'monthly'], queryFn: analyticsApi.monthly });
  const { data: categories = [] } = useQuery({ queryKey: ['analytics', 'categories'], queryFn: analyticsApi.categories });
  const { data: balance } = useQuery({ queryKey: ['dashboard'], queryFn: usersApi.dashboard });

  const totalSpent = categories.reduce((s, c) => s + c.amount, 0);
  const thisMonth = monthly[monthly.length - 1]?.amount || 0;
  const lastMonth = monthly[monthly.length - 2]?.amount || 0;
  const trend = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth * 100) : 0;

  const maxMonthly = Math.max(...monthly.map(m => m.amount), 1);
  const topMonth = monthly.find(m => m.amount === maxMonthly);

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
        <p className="text-slate-500 mt-1">Your spending insights</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 size={18} className="text-indigo-500" />
            <span className="text-sm text-slate-500">All Time</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{fmt(totalSpent)}</p>
          <p className="text-xs text-slate-400 mt-1">Total spending</p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            {trend >= 0 ? <TrendingUp size={18} className="text-red-500" /> : <TrendingDown size={18} className="text-emerald-500" />}
            <span className="text-sm text-slate-500">This Month</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{fmt(thisMonth)}</p>
          <p className={`text-xs mt-1 ${trend === 0 ? 'text-slate-400' : trend > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
            {trend === 0 ? 'No data last month' : `${trend > 0 ? '+' : ''}${trend.toFixed(0)}% vs last month`}
          </p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={18} className="text-emerald-500" />
            <span className="text-sm text-slate-500">Peak Month</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{topMonth ? fmt(maxMonthly) : '$0'}</p>
          <p className="text-xs text-slate-400 mt-1">{topMonth?.label || 'No data yet'}</p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-4 h-4 rounded-full bg-emerald-400" />
            <span className="text-sm text-slate-500">Net Balance</span>
          </div>
          <p className={`text-2xl font-bold ${(balance?.net ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {balance ? fmt(Math.abs(balance.net)) : '$0'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {(balance?.net ?? 0) >= 0 ? 'People owe you' : 'You owe people'}
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-5 gap-4">
        <div className="card p-6 col-span-3">
          <h2 className="font-bold text-slate-900 mb-1">Spending Over Time</h2>
          <p className="text-sm text-slate-500 mb-5">Your share of expenses each month</p>
          <MonthlyChart data={monthly} />

          {/* Monthly breakdown table */}
          <div className="mt-6 border-t border-slate-100 pt-4">
            <div className="space-y-2">
              {[...monthly].reverse().map((m, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-16">{m.label}</span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full transition-all"
                      style={{ width: `${maxMonthly > 0 ? (m.amount / maxMonthly * 100) : 0}%` }} />
                  </div>
                  <span className="text-xs font-medium text-slate-700 w-16 text-right">{fmt(m.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card p-6 col-span-2">
          <h2 className="font-bold text-slate-900 mb-1">Spending by Category</h2>
          <p className="text-sm text-slate-500 mb-5">All-time breakdown</p>
          <CategoryChart data={categories} />
        </div>
      </div>

      {/* Category detail */}
      {categories.length > 0 && (
        <div className="card p-6">
          <h2 className="font-bold text-slate-900 mb-4">Category Details</h2>
          <div className="grid grid-cols-4 gap-3">
            {categories.map((c, i) => (
              <div key={i} className="p-4 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{CATEGORY_ICONS[c.category] || '📦'}</span>
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                </div>
                <p className="text-sm font-medium text-slate-700">{c.label}</p>
                <p className="text-xl font-bold text-slate-900 mt-1">{fmt(c.amount)}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {totalSpent > 0 ? `${(c.amount / totalSpent * 100).toFixed(1)}% of total` : ''}
                </p>
                <div className="h-1 bg-slate-100 rounded-full mt-2 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${totalSpent > 0 ? c.amount / totalSpent * 100 : 0}%`, backgroundColor: c.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {categories.length === 0 && monthly.every(m => m.amount === 0) && (
        <div className="card p-16 text-center">
          <div className="text-5xl mb-4">📊</div>
          <h3 className="text-lg font-bold text-slate-700">No data yet</h3>
          <p className="text-slate-500 mt-2">Add expenses in your groups to see analytics</p>
        </div>
      )}
    </div>
  );
}
