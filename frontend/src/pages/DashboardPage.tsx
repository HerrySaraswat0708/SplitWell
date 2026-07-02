import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, DollarSign, ArrowRight, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { usersApi, analyticsApi } from '../api';
import { fmt, fmtDate, timeGreeting, CATEGORY_ICONS, COVER_COLORS } from '../utils/helpers';
import MonthlyChart from '../components/charts/MonthlyChart';
import CategoryChart from '../components/charts/CategoryChart';
import Avatar from '../components/Avatar';
import AddGroupModal from '../components/modals/AddGroupModal';
import { useState } from 'react';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [showAddGroup, setShowAddGroup] = useState(false);

  const { data: balance } = useQuery({ queryKey: ['dashboard'], queryFn: usersApi.dashboard });
  const { data: monthly = [] } = useQuery({ queryKey: ['analytics', 'monthly'], queryFn: analyticsApi.monthly });
  const { data: categories = [] } = useQuery({ queryKey: ['analytics', 'categories'], queryFn: analyticsApi.categories });
  const { data: recent = [] } = useQuery({ queryKey: ['recent'], queryFn: analyticsApi.recent });

  const balanceColor = (balance?.net ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-500';

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {timeGreeting()}, {user?.name.split(' ')[0]} 👋
          </h1>
          <p className="text-slate-500 mt-1">Here's your expense summary</p>
        </div>
        <button onClick={() => setShowAddGroup(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> New Group
        </button>
      </div>

      {/* Balance cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
              <DollarSign size={20} className="text-slate-600" />
            </div>
            <span className="text-sm font-medium text-slate-500">Net Balance</span>
          </div>
          <p className={`text-2xl font-bold ${balanceColor}`}>
            {balance ? fmt(Math.abs(balance.net)) : '$0.00'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {(balance?.net ?? 0) >= 0 ? 'Overall you are owed' : 'Overall you owe'}
          </p>
        </div>

        <div className="card p-5 border-l-4 border-emerald-400">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
              <TrendingUp size={20} className="text-emerald-600" />
            </div>
            <span className="text-sm font-medium text-slate-500">You're Owed</span>
          </div>
          <p className="text-2xl font-bold text-emerald-600">{balance ? fmt(balance.owed) : '$0.00'}</p>
          <p className="text-xs text-slate-400 mt-1">Total across all groups</p>
        </div>

        <div className="card p-5 border-l-4 border-red-400">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
              <TrendingDown size={20} className="text-red-500" />
            </div>
            <span className="text-sm font-medium text-slate-500">You Owe</span>
          </div>
          <p className="text-2xl font-bold text-red-500">{balance ? fmt(balance.owing) : '$0.00'}</p>
          <p className="text-xs text-slate-400 mt-1">Total across all groups</p>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-5 gap-4">
        <div className="card p-5 col-span-3">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-semibold text-slate-900">Monthly Spending</h2>
            <span className="text-xs text-slate-400">Last 6 months</span>
          </div>
          <p className="text-xs text-slate-500 mb-4">Your share of all group expenses</p>
          <MonthlyChart data={monthly} />
        </div>

        <div className="card p-5 col-span-2">
          <h2 className="font-semibold text-slate-900 mb-1">By Category</h2>
          <p className="text-xs text-slate-500 mb-4">All-time spending breakdown</p>
          <CategoryChart data={categories} />
        </div>
      </div>

      {/* Recent activity */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900">Recent Activity</h2>
          <Link to="/groups" className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
            View groups <ArrowRight size={14} />
          </Link>
        </div>

        {recent.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">💸</div>
            <p className="font-semibold text-slate-700">No activity yet</p>
            <p className="text-sm text-slate-500 mt-1">Create a group and add your first expense!</p>
            <button onClick={() => setShowAddGroup(true)} className="btn-primary mt-4 flex items-center gap-2 mx-auto">
              <Plus size={16} /> Create Group
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {recent.map((item, i) => (
              <div key={`${item.type}-${item.id}-${i}`} className="flex items-center gap-4 py-3 hover:bg-slate-50 -mx-2 px-2 rounded-lg transition-colors">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
                  style={{ backgroundColor: item.type === 'expense' ? '#f0fdf4' : '#eff6ff' }}>
                  {item.type === 'expense' ? CATEGORY_ICONS[item.category || 'other'] : '💸'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {item.type === 'expense' ? item.description : `${item.paid_by_name} paid ${item.paid_to_name}`}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Avatar name={item.paid_by_name} color={item.paid_by_color} size="xs" />
                    <span className="text-xs text-slate-500">{item.paid_by_name}</span>
                    {item.group_name && (
                      <>
                        <span className="text-slate-300">·</span>
                        <span className="text-xs text-slate-400">{item.group_name}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-bold ${item.type === 'settlement' ? 'text-emerald-600' : 'text-slate-900'}`}>
                    {item.type === 'settlement' ? '+' : ''}{fmt(item.amount, item.currency)}
                  </p>
                  <p className="text-xs text-slate-400">{fmtDate(item.date)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AddGroupModal open={showAddGroup} onClose={() => setShowAddGroup(false)} />
    </div>
  );
}
