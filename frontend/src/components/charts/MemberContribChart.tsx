import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { fmt } from '../../utils/helpers';

interface MemberData { id: number; name: string; avatar_color: string; paid: number; }
interface Props { data: MemberData[]; }

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-100 shadow-lg rounded-xl px-3 py-2 text-sm">
      <p className="font-medium text-slate-700">{payload[0].payload.name}</p>
      <p className="font-bold text-slate-900">{fmt(payload[0].value)}</p>
    </div>
  );
};

export default function MemberContribChart({ data }: Props) {
  if (!data?.length) return null;
  const chartData = data.map(d => ({ name: d.name.split(' ')[0], paid: d.paid, color: d.avatar_color }));

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
          tickFormatter={v => `$${v}`} width={45} />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="paid" radius={[6, 6, 0, 0]} maxBarSize={40}>
          {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
