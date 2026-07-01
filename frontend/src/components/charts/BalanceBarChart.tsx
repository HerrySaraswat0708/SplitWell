import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import type { Balance } from '../../types';
import { fmt } from '../../utils/helpers';

interface Props { data: Balance[]; }

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  return (
    <div className="bg-white border border-slate-100 shadow-lg rounded-xl px-3 py-2 text-sm">
      <p className="font-medium text-slate-700">{payload[0].name}</p>
      <p className={`font-bold ${val >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
        {val >= 0 ? `+${fmt(val)}` : fmt(val)}
      </p>
    </div>
  );
};

export default function BalanceBarChart({ data }: Props) {
  if (!data?.length) return (
    <div className="h-40 flex items-center justify-center text-slate-400 text-sm">No balances yet</div>
  );

  const chartData = data.map(b => ({ name: b.user.name.split(' ')[0], amount: b.balance }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
          tickFormatter={v => `$${Math.abs(v)}`} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#374151' }} axisLine={false} tickLine={false} width={60} />
        <ReferenceLine x={0} stroke="#e2e8f0" />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="amount" radius={[0, 4, 4, 0]} maxBarSize={24}>
          {chartData.map((d, i) => (
            <Cell key={i} fill={d.amount >= 0 ? '#10b981' : '#ef4444'} fillOpacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
