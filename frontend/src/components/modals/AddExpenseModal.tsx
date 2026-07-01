import { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import Modal from './Modal';
import Avatar from '../Avatar';
import { expensesApi } from '../../api';
import { useAuthStore } from '../../store/authStore';
import { todayStr, CATEGORY_ICONS } from '../../utils/helpers';
import type { GroupMember } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
  groupId: number;
  members: GroupMember[];
}

const CATEGORIES = ['food','transport','entertainment','utilities','shopping','health','travel','other'];
const SPLIT_TYPES = ['equal', 'percentage', 'exact'] as const;

export default function AddExpenseModal({ open, onClose, groupId, members }: Props) {
  const qc = useQueryClient();
  const { user } = useAuthStore();

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState(user?.id || 0);
  const [category, setCategory] = useState('other');
  const [splitType, setSplitType] = useState<typeof SPLIT_TYPES[number]>('equal');
  const [date, setDate] = useState(todayStr());
  const [notes, setNotes] = useState('');
  const [splits, setSplits] = useState<Record<number, string>>({});
  const [error, setError] = useState('');
  const [autoCategory, setAutoCategory] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (open) {
      setPaidBy(user?.id || 0);
      setSplits(Object.fromEntries(members.map(m => [m.id, ''])));
    }
  }, [open, members, user]);

  useEffect(() => {
    if (description.length < 3) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const { category: suggested } = await expensesApi.suggestCategory(description);
        setCategory(suggested);
        setAutoCategory(true);
        setTimeout(() => setAutoCategory(false), 2000);
      } catch {}
    }, 600);
  }, [description]);

  const equalShare = members.length > 0 && amount
    ? (parseFloat(amount) / members.length).toFixed(2) : '0.00';

  const { mutate, isPending } = useMutation({
    mutationFn: expensesApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses', groupId] });
      qc.invalidateQueries({ queryKey: ['balances', groupId] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['recent'] });
      onClose();
      resetForm();
    },
    onError: (e: any) => setError(e || 'Failed to add expense'),
  });

  const resetForm = () => {
    setDescription(''); setAmount(''); setCategory('other');
    setSplitType('equal'); setDate(todayStr()); setNotes(''); setError('');
    setSplits({});
  };

  const submit = () => {
    if (!description || !amount || !paidBy) {
      setError('Description, amount and who paid are required');
      return;
    }
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { setError('Amount must be a positive number'); return; }

    let splitData: { user_id: number; amount: number }[] | undefined;

    if (splitType === 'equal') {
      splitData = undefined; // backend handles equal split
    } else {
      const total = Object.values(splits).reduce((s, v) => s + (parseFloat(v) || 0), 0);
      if (Math.abs(total - amt) > 0.05) {
        setError(`Split amounts must total $${amt.toFixed(2)} (currently $${total.toFixed(2)})`);
        return;
      }
      splitData = Object.entries(splits).map(([uid, val]) => ({
        user_id: parseInt(uid), amount: parseFloat(val) || 0
      }));
    }

    setError('');
    mutate({ group_id: groupId, description, amount: amt, paid_by: paidBy, category, split_type: splitType, date, notes, splits: splitData });
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Expense" size="lg">
      <div className="space-y-4">
        {error && <div className="bg-red-50 text-red-600 px-3 py-2.5 rounded-xl text-sm">{error}</div>}

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="label">Description *</label>
            <input className="input" placeholder="e.g. Dinner at Olive Garden" value={description}
              onChange={e => setDescription(e.target.value)} />
          </div>
          <div>
            <label className="label">Amount ($) *</label>
            <input className="input" type="number" placeholder="0.00" step="0.01" min="0"
              value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="label">Date</label>
            <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="label flex items-center gap-2">
            Category
            {autoCategory && (
              <span className="badge bg-indigo-50 text-indigo-600 text-xs animate-fade-in">
                <Sparkles size={10} /> Auto-detected
              </span>
            )}
          </label>
          <div className="grid grid-cols-4 gap-2">
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setCategory(c)}
                className={`px-2 py-2 rounded-xl text-xs font-medium border transition-all flex flex-col items-center gap-1 ${
                  category === c ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:border-indigo-300'
                }`}>
                <span className="text-base">{CATEGORY_ICONS[c]}</span>
                <span className="capitalize">{c}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Paid by */}
        <div>
          <label className="label">Paid by</label>
          <div className="flex flex-wrap gap-2">
            {members.map(m => (
              <button key={m.id} onClick={() => setPaidBy(m.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm border transition-all ${
                  paidBy === m.id ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}>
                <Avatar name={m.name} color={m.avatar_color} size="xs" />
                {m.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Split type */}
        <div>
          <label className="label">Split</label>
          <div className="flex gap-2">
            {SPLIT_TYPES.map(t => (
              <button key={t} onClick={() => setSplitType(t)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium border capitalize transition-all ${
                  splitType === t ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}>
                {t}
              </button>
            ))}
          </div>

          {splitType === 'equal' && amount && (
            <p className="text-xs text-slate-500 mt-2 bg-slate-50 px-3 py-2 rounded-lg">
              Each person owes <strong>${equalShare}</strong>
            </p>
          )}

          {splitType !== 'equal' && (
            <div className="mt-3 space-y-2">
              {members.map(m => (
                <div key={m.id} className="flex items-center gap-3">
                  <Avatar name={m.name} color={m.avatar_color} size="sm" />
                  <span className="text-sm text-slate-700 flex-1">{m.name}</span>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                      {splitType === 'percentage' ? '%' : '$'}
                    </span>
                    <input
                      className="input w-28 pl-7 text-right"
                      type="number" step="0.01" min="0"
                      placeholder={splitType === 'percentage' ? '0' : '0.00'}
                      value={splits[m.id] || ''}
                      onChange={e => setSplits(prev => ({ ...prev, [m.id]: e.target.value }))}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="label">Notes (optional)</label>
          <input className="input" placeholder="Any notes..." value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        <div className="flex gap-3 pt-2">
          <button className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
          <button className="btn-primary flex-1" onClick={submit} disabled={isPending}>
            {isPending ? 'Adding...' : 'Add Expense'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
