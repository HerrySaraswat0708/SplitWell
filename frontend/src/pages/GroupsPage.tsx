import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Users, ArrowRight, Search } from 'lucide-react';
import { groupsApi } from '../api';
import { fmt, GROUP_CATEGORIES } from '../utils/helpers';
import Avatar from '../components/Avatar';
import AddGroupModal from '../components/modals/AddGroupModal';

export default function GroupsPage() {
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: groupsApi.list,
  });

  const filtered = groups.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase())
  );

  const getCategoryLabel = (cat: string) =>
    GROUP_CATEGORIES.find(c => c.value === cat)?.label || cat;

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Groups</h1>
          <p className="text-slate-500 mt-1">{groups.length} group{groups.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> New Group
        </button>
      </div>

      {/* Search */}
      {groups.length > 3 && (
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Search groups..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3].map(i => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="w-12 h-12 bg-slate-100 rounded-2xl mb-4" />
              <div className="h-4 bg-slate-100 rounded w-3/4 mb-2" />
              <div className="h-3 bg-slate-50 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-5xl mb-4">👥</div>
          <h3 className="font-bold text-slate-700 text-lg">
            {search ? 'No groups found' : 'No groups yet'}
          </h3>
          <p className="text-slate-500 mt-2">
            {search ? 'Try a different search term' : 'Create your first group to start splitting expenses'}
          </p>
          {!search && (
            <button onClick={() => setShowAdd(true)} className="btn-primary mt-4 mx-auto flex items-center gap-2">
              <Plus size={16} /> Create Group
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {filtered.map(group => (
            <Link key={group.id} to={`/groups/${group.id}`}
              className="card p-5 hover:shadow-md transition-shadow group block">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-xl font-bold"
                  style={{ backgroundColor: group.cover_color }}>
                  {group.name[0].toUpperCase()}
                </div>
                <span className="text-xs text-slate-400 badge bg-slate-50">{getCategoryLabel(group.category)}</span>
              </div>

              <h3 className="font-bold text-slate-900 truncate">{group.name}</h3>
              {group.description && (
                <p className="text-xs text-slate-500 mt-1 truncate">{group.description}</p>
              )}

              {/* Stats */}
              <div className="mt-4 flex items-center justify-between">
                <div>
                  <p className="text-lg font-bold text-slate-900">{fmt(group.total_spent || 0)}</p>
                  <p className="text-xs text-slate-400">total spent</p>
                </div>
                <div className="flex -space-x-2">
                  {group.members.slice(0, 4).map(m => (
                    <Avatar key={m.id} name={m.name} color={m.avatar_color} size="sm"
                      className="ring-2 ring-white" />
                  ))}
                  {group.members.length > 4 && (
                    <div className="w-8 h-8 rounded-full bg-slate-100 ring-2 ring-white flex items-center justify-center text-xs font-medium text-slate-500">
                      +{group.members.length - 4}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 mt-3 text-indigo-600 text-sm font-medium group-hover:gap-2 transition-all">
                <Users size={14} />
                <span>{group.member_count} members</span>
                <ArrowRight size={14} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Link>
          ))}
        </div>
      )}

      <AddGroupModal open={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  );
}
