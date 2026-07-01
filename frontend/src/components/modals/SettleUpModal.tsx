import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import Modal from './Modal';
import Avatar from '../Avatar';
import { settlementsApi } from '../../api';
import { todayStr, fmt } from '../../utils/helpers';
import type { DebtTransaction } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
  groupId: number;
  transactions: DebtTransaction[];
}

export default function SettleUpModal({ open, onClose, groupId, transactions }: Props) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<DebtTransaction | null>(null);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const { mutate, isPending } = useMutation({
    mutationFn: settlementsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settlements', groupId] });
      qc.invalidateQueries({ queryKey: ['balances', groupId] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['recent'] });
      onClose();
      setSelected(null); setAmount(''); setNote('');
    },
    onError: (e: any) => setError(e || 'Failed to record settlement'),
  });

  const selectTxn = (t: DebtTransaction) => {
    setSelected(t);
    setAmount(t.amount.toFixed(2));
    setError('');
  };

  const submit = () => {
    if (!selected) { setError('Select a payment first'); return; }
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { setError('Enter a valid amount'); return; }
    mutate({ group_id: groupId, paid_to: selected.to.id, amount: amt, date, note });
  };

  return (
    <Modal open={open} onClose={onClose} title="Settle Up">
      <div className="space-y-4">
        {error && <div className="bg-red-50 text-red-600 px-3 py-2 rounded-xl text-sm">{error}</div>}

        {transactions.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">🎉</div>
            <p className="font-semibold text-slate-700">All settled up!</p>
            <p className="text-sm text-slate-500 mt-1">No outstanding balances in this group</p>
          </div>
        ) : (
          <>
            <div>
              <p className="text-sm text-slate-600 mb-3">Minimum payments to settle all debts:</p>
              <div className="space-y-2">
                {transactions.map((t, i) => (
                  <button key={i} onClick={() => selectTxn(t)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                      selected === t ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300 bg-white'
                    }`}>
                    <Avatar name={t.from.name} color={t.from.avatar_color} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{t.from.name}</p>
                      <p className="text-xs text-slate-500">pays {t.to.name}</p>
                    </div>
                    <ArrowRight size={16} className="text-slate-400 flex-shrink-0" />
                    <Avatar name={t.to.name} color={t.to.avatar_color} size="sm" />
                    <span className="font-bold text-emerald-600 ml-2">{fmt(t.amount)}</span>
                  </button>
                ))}
              </div>
            </div>

            {selected && (
              <div className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-100">
                <p className="text-sm font-medium text-slate-700">
                  Record payment: <strong>{selected.from.name}</strong> → <strong>{selected.to.name}</strong>
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Amount</label>
                    <input className="input" type="number" step="0.01" min="0"
                      value={amount} onChange={e => setAmount(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Date</label>
                    <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="label">Note (optional)</label>
                  <input className="input" placeholder="e.g. Paid via UPI" value={note} onChange={e => setNote(e.target.value)} />
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
              <button className="btn-primary flex-1" onClick={submit} disabled={!selected || isPending}>
                {isPending ? 'Recording...' : 'Record Payment'}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
