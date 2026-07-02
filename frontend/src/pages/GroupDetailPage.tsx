import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, HandCoins, UserPlus, Trash2, ArrowRight, LogOut, Skull, UserX } from 'lucide-react';
import { groupsApi, expensesApi, settlementsApi, analyticsApi } from '../api';
import { useAuthStore } from '../store/authStore';
import { fmt, fmtDate, CATEGORY_ICONS } from '../utils/helpers';
import Avatar from '../components/Avatar';
import MonthlyChart from '../components/charts/MonthlyChart';
import MemberContribChart from '../components/charts/MemberContribChart';
import BalanceBarChart from '../components/charts/BalanceBarChart';
import AddExpenseModal from '../components/modals/AddExpenseModal';
import SettleUpModal from '../components/modals/SettleUpModal';
import ConfirmModal from '../components/modals/ConfirmModal';

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const groupId = parseInt(id!);
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Modal / UI state
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showSettle, setShowSettle] = useState(false);
  const [showDeleteGroup, setShowDeleteGroup] = useState(false);
  const [showLeaveGroup, setShowLeaveGroup] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<number | null>(null);
  const [addMemberEmail, setAddMemberEmail] = useState('');
  const [addMemberMsg, setAddMemberMsg] = useState('');
  const [tab, setTab] = useState<'expenses' | 'balances' | 'stats'>('expenses');

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data: group, isLoading } = useQuery({ queryKey: ['group', groupId], queryFn: () => groupsApi.get(groupId) });
  const { data: expenses = [] } = useQuery({ queryKey: ['expenses', groupId], queryFn: () => expensesApi.byGroup(groupId) });
  const { data: balances } = useQuery({ queryKey: ['balances', groupId], queryFn: () => groupsApi.balances(groupId) });
  const { data: settlements = [] } = useQuery({ queryKey: ['settlements', groupId], queryFn: () => settlementsApi.byGroup(groupId) });
  const { data: monthly = [] } = useQuery({ queryKey: ['analytics', 'group', groupId, 'monthly'], queryFn: () => analyticsApi.groupMonthly(groupId) });
  const { data: memberContrib = [] } = useQuery({ queryKey: ['analytics', 'group', groupId, 'members'], queryFn: () => analyticsApi.groupMembers(groupId) });

  // ── Mutations ────────────────────────────────────────────────────────────────
  const { mutate: deleteExpense } = useMutation({
    mutationFn: expensesApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses', groupId] });
      qc.invalidateQueries({ queryKey: ['balances', groupId] });
    },
  });

  const { mutate: deleteSettlement } = useMutation({
    mutationFn: settlementsApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settlements', groupId] });
      qc.invalidateQueries({ queryKey: ['balances', groupId] });
    },
  });

  const { mutate: addMember, isPending: addingMember } = useMutation({
    mutationFn: (email: string) => groupsApi.addMember(groupId, email),
    onSuccess: (data) => {
      setAddMemberMsg(`✓ ${data.user.name} added!`);
      setAddMemberEmail('');
      qc.invalidateQueries({ queryKey: ['group', groupId] });
      setTimeout(() => setAddMemberMsg(''), 3000);
    },
    onError: (e: any) => setAddMemberMsg(`⚠ ${e}`),
  });

  const { mutate: deleteGroup, isPending: deletingGroup } = useMutation({
    mutationFn: () => groupsApi.delete(groupId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] });
      navigate('/groups');
    },
  });

  const { mutate: leaveGroup, isPending: leavingGroup } = useMutation({
    mutationFn: () => groupsApi.leave(groupId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] });
      navigate('/groups');
    },
  });

  const { mutate: removeMember, isPending: removingMember } = useMutation({
    mutationFn: (userId: number) => groupsApi.removeMember(groupId, userId),
    onSuccess: () => {
      setRemovingMemberId(null);
      qc.invalidateQueries({ queryKey: ['group', groupId] });
      qc.invalidateQueries({ queryKey: ['balances', groupId] });
    },
    onError: (e: any) => alert(e),
  });

  // ── Derived state ────────────────────────────────────────────────────────────
  const isCreator = group?.created_by === user?.id;
  const myRole = group?.members.find(m => m.id === user?.id)?.role;
  const isAdmin = myRole === 'admin';
  const myBalance = balances?.netBalances.find(b => b.user.id === user?.id);

  const memberBeingRemoved = group?.members.find(m => m.id === removingMemberId);

  const allActivity = [
    ...expenses.map(e => ({ ...e, itemType: 'expense' as const })),
    ...settlements.map(s => ({
      ...s,
      description: `${s.paid_by_name} paid ${s.paid_to_name}`,
      itemType: 'settlement' as const,
      category: 'settlement',
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // ── Loading / not found ──────────────────────────────────────────────────────
  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!group) return <div className="text-center py-20 text-slate-500">Group not found</div>;

  return (
    <div className="space-y-6 animate-slide-up">

      {/* ── Header ── */}
      <div className="flex items-start gap-4">
        <button onClick={() => navigate('/groups')} className="p-2 hover:bg-slate-100 rounded-xl transition-colors mt-1">
          <ArrowLeft size={20} className="text-slate-600" />
        </button>

        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-xl font-bold"
              style={{ backgroundColor: group.cover_color }}>
              {group.name[0]}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{group.name}</h1>
              {group.description && <p className="text-slate-500 text-sm">{group.description}</p>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Leave group — visible to non-creator members */}
          {!isCreator && (
            <button
              onClick={() => setShowLeaveGroup(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-slate-500 hover:text-amber-600 hover:bg-amber-50 border border-slate-200 hover:border-amber-200 text-sm font-medium transition-all"
              title="Leave this group"
            >
              <LogOut size={15} /> Leave
            </button>
          )}

          {/* Delete group — visible to creator only */}
          {isCreator && (
            <button
              onClick={() => setShowDeleteGroup(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 border border-slate-200 hover:border-red-200 text-sm font-medium transition-all"
              title="Delete this group"
            >
              <Trash2 size={15} /> Delete Group
            </button>
          )}

          <button onClick={() => setShowSettle(true)} className="btn-secondary flex items-center gap-2">
            <HandCoins size={16} /> Settle Up
          </button>
          <button onClick={() => setShowAddExpense(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Add Expense
          </button>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{fmt(group.total_spent || 0)}</p>
          <p className="text-xs text-slate-500 mt-1">Total spent</p>
        </div>
        <div className={`card p-4 text-center ${myBalance && myBalance.balance > 0 ? 'border-l-4 border-emerald-400' : myBalance && myBalance.balance < 0 ? 'border-l-4 border-red-400' : ''}`}>
          <p className={`text-2xl font-bold ${myBalance && myBalance.balance >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {myBalance ? fmt(Math.abs(myBalance.balance)) : '$0.00'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {!myBalance || myBalance.balance === 0 ? 'All settled' : myBalance.balance > 0 ? 'You are owed' : 'You owe'}
          </p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{expenses.length}</p>
          <p className="text-xs text-slate-500 mt-1">Expenses</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{group.members.length}</p>
          <p className="text-xs text-slate-500 mt-1">Members</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">

        {/* ── Main panel ── */}
        <div className="col-span-2 space-y-4">

          {/* Debt summary */}
          {balances?.transactions && balances.transactions.length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold text-slate-900 mb-3">Settle Up Summary</h3>
              <div className="space-y-2">
                {balances.transactions.map((t, i) => (
                  <div key={i} className={`flex items-center gap-3 p-3 rounded-xl ${t.from.id === user?.id ? 'bg-red-50' : t.to.id === user?.id ? 'bg-emerald-50' : 'bg-slate-50'}`}>
                    <Avatar name={t.from.name} color={t.from.avatar_color} size="sm" />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-slate-800">{t.from.name}</span>
                      <span className="text-slate-400 mx-2">→</span>
                      <span className="text-sm font-medium text-slate-800">{t.to.name}</span>
                    </div>
                    <Avatar name={t.to.name} color={t.to.avatar_color} size="sm" />
                    <span className="font-bold text-slate-900 ml-2">{fmt(t.amount)}</span>
                    {t.from.id === user?.id && (
                      <button onClick={() => setShowSettle(true)} className="btn-primary py-1 px-3 text-xs ml-1">
                        Pay
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="card overflow-hidden">
            <div className="flex border-b border-slate-100">
              {(['expenses', 'balances', 'stats'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`flex-1 py-3 text-sm font-medium capitalize transition-colors ${
                    tab === t ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700'
                  }`}>
                  {t}
                </button>
              ))}
            </div>

            <div className="p-5">

              {/* Expenses tab */}
              {tab === 'expenses' && (
                <div>
                  {allActivity.length === 0 ? (
                    <div className="text-center py-10">
                      <div className="text-4xl mb-3">🧾</div>
                      <p className="font-semibold text-slate-700">No expenses yet</p>
                      <p className="text-sm text-slate-500 mt-1">Add the first expense to get started</p>
                      <button onClick={() => setShowAddExpense(true)} className="btn-primary mt-4 mx-auto flex items-center gap-2">
                        <Plus size={16} /> Add Expense
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {allActivity.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3 py-2.5 px-2 rounded-xl hover:bg-slate-50 group transition-colors">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                            style={{ backgroundColor: item.itemType === 'settlement' ? '#eff6ff' : '#f0fdf4' }}>
                            {item.itemType === 'settlement' ? '💸' : CATEGORY_ICONS[item.category] || '📦'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">{item.description}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {item.itemType === 'expense' && (
                                <span className="text-xs text-slate-500">Paid by {item.paid_by_name} · {fmtDate(item.date)}</span>
                              )}
                              {item.itemType === 'settlement' && (
                                <span className="text-xs text-indigo-500 font-medium">Settlement · {fmtDate(item.date)}</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-bold ${item.itemType === 'settlement' ? 'text-indigo-600' : 'text-slate-900'}`}>
                              {fmt(item.amount)}
                            </p>
                            {item.itemType === 'expense' && (item as any).splits && (
                              <p className="text-xs text-slate-400">
                                your share: {fmt((item as any).splits.find((s: any) => s.user_id === user?.id)?.amount || 0)}
                              </p>
                            )}
                          </div>
                          {(item.itemType === 'expense'
                            ? ((item as any).created_by === user?.id || (item as any).paid_by === user?.id)
                            : (item as any).paid_by === user?.id) && (
                            <button
                              onClick={() => item.itemType === 'expense' ? deleteExpense(item.id) : deleteSettlement(item.id)}
                              className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-red-400 transition-all rounded-lg hover:bg-red-50">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Balances tab */}
              {tab === 'balances' && (
                <div className="space-y-3">
                  {balances?.netBalances.map((b, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
                      <Avatar name={b.user.name} color={b.user.avatar_color} size="sm" />
                      <span className="text-sm font-medium text-slate-700 flex-1">{b.user.name}</span>
                      <span className={`font-bold text-sm ${b.balance >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {b.balance === 0
                          ? <span className="text-slate-400">settled</span>
                          : b.balance > 0 ? `+${fmt(b.balance)}` : fmt(b.balance)}
                      </span>
                    </div>
                  ))}
                  <BalanceBarChart data={balances?.netBalances || []} />
                </div>
              )}

              {/* Stats tab */}
              {tab === 'stats' && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-600 mb-3">Monthly Spending</h4>
                    <MonthlyChart data={monthly} color="#8b5cf6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-600 mb-3">Member Contributions</h4>
                    <MemberContribChart data={memberContrib} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-4">

          {/* Members card */}
          <div className="card p-4">
            <h3 className="font-semibold text-slate-900 mb-3">
              Members <span className="text-slate-400 font-normal text-sm">({group.members.length})</span>
            </h3>

            <div className="space-y-1">
              {group.members.map(m => {
                const isGroupCreator = m.id === group.created_by;
                const canRemove = isAdmin && !isGroupCreator && m.id !== user?.id;

                return (
                  <div key={m.id} className="group/member flex items-center gap-2.5 py-1.5 px-2 rounded-xl hover:bg-slate-50 transition-colors">
                    <Avatar name={m.name} color={m.avatar_color} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-slate-800 truncate">{m.name}</p>
                        {m.id === user?.id && <span className="text-xs text-slate-400">(you)</span>}
                      </div>
                      <p className="text-xs text-slate-400 truncate">{m.email}</p>
                    </div>

                    {isGroupCreator
                      ? <span className="badge bg-indigo-50 text-indigo-600 text-xs flex-shrink-0">Creator</span>
                      : m.role === 'admin'
                        ? <span className="badge bg-indigo-50 text-indigo-600 text-xs flex-shrink-0">Admin</span>
                        : null}

                    {/* Remove button — admins only, not for creator or self */}
                    {canRemove && (
                      <button
                        onClick={() => setRemovingMemberId(m.id)}
                        className="opacity-0 group-hover/member:opacity-100 p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all flex-shrink-0"
                        title={`Remove ${m.name}`}
                      >
                        <UserX size={15} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Add member */}
            {isAdmin && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <div className="flex gap-2">
                  <input
                    className="input text-xs"
                    placeholder="Invite by email…"
                    value={addMemberEmail}
                    onChange={e => setAddMemberEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addMember(addMemberEmail))}
                  />
                  <button
                    onClick={() => addMember(addMemberEmail)}
                    disabled={addingMember || !addMemberEmail.trim()}
                    className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors disabled:opacity-50"
                    title="Add member"
                  >
                    <UserPlus size={16} />
                  </button>
                </div>
                {addMemberMsg && (
                  <p className={`text-xs mt-1.5 ${addMemberMsg.startsWith('⚠') ? 'text-red-500' : 'text-emerald-600'}`}>
                    {addMemberMsg}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Settlements */}
          {settlements.length > 0 && (
            <div className="card p-4">
              <h3 className="font-semibold text-slate-900 mb-3">Settlements</h3>
              <div className="space-y-2">
                {settlements.slice(0, 5).map(s => (
                  <div key={s.id} className="flex items-center gap-2 text-xs">
                    <Avatar name={s.paid_by_name} color={s.paid_by_color} size="xs" />
                    <ArrowRight size={10} className="text-slate-300" />
                    <Avatar name={s.paid_to_name} color={s.paid_to_color} size="xs" />
                    <span className="text-slate-500 flex-1 truncate">{s.paid_by_name} → {s.paid_to_name}</span>
                    <span className="font-medium text-emerald-600">{fmt(s.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      <AddExpenseModal
        open={showAddExpense}
        onClose={() => setShowAddExpense(false)}
        groupId={groupId}
        members={group.members}
      />
      <SettleUpModal
        open={showSettle}
        onClose={() => setShowSettle(false)}
        groupId={groupId}
        transactions={balances?.transactions || []}
      />

      {/* Delete group confirm */}
      <ConfirmModal
        open={showDeleteGroup}
        onClose={() => setShowDeleteGroup(false)}
        onConfirm={() => deleteGroup()}
        title="Delete Group"
        message={`Are you sure you want to delete "${group.name}"? All expenses and settlement history will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete Group"
        danger
        loading={deletingGroup}
      />

      {/* Leave group confirm */}
      <ConfirmModal
        open={showLeaveGroup}
        onClose={() => setShowLeaveGroup(false)}
        onConfirm={() => leaveGroup()}
        title="Leave Group"
        message={`You will be removed from "${group.name}". Your past expenses will remain on record but you won't see this group anymore.`}
        confirmLabel="Leave Group"
        loading={leavingGroup}
      />

      {/* Remove member confirm */}
      <ConfirmModal
        open={removingMemberId !== null}
        onClose={() => setRemovingMemberId(null)}
        onConfirm={() => removingMemberId !== null && removeMember(removingMemberId)}
        title="Remove Member"
        message={`Remove ${memberBeingRemoved?.name ?? 'this member'} from "${group.name}"? Their past expenses stay on record.`}
        confirmLabel="Remove Member"
        danger
        loading={removingMember}
      />
    </div>
  );
}
