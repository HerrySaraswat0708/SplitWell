import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { CategoryData } from '../../types';
import { fmt } from '../../utils/helpers';

interface Props { data: CategoryData[]; }

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-100 shadow-lg rounded-xl px-3 py-2 text-sm">
      <p className="font-medium text-slate-700">{payload[0].name}</p>
      <p className="font-bold text-slate-900">{fmt(payload[0].value)}</p>
    </div>
  );
};

const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  if (percent < 0.06) return null;
  const RADIAN = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="600">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export default function CategoryChart({ data }: Props) {
  if (!data?.length) return (
    <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No spending data yet</div>
  );

  const total = data.reduce((s, d) => s + d.amount, 0);

  return (
    <div>
      <div className="flex items-center justify-center mb-2">
        <div className="text-center">
          <p className="text-xs text-slate-400">Total Spending</p>
          <p className="text-xl font-bold text-slate-900">{fmt(total)}</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} dataKey="amount" nameKey="label" cx="50%" cy="50%"
            innerRadius={50} outerRadius={85} labelLine={false} label={renderLabel}>
            {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="grid grid-cols-2 gap-1 mt-2">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
            <span className="text-slate-600 truncate">{d.label}</span>
            <span className="text-slate-400 ml-auto">{fmt(d.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
