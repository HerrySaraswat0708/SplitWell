import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import Modal from './Modal';
import { groupsApi } from '../../api';
import { GROUP_CATEGORIES, COVER_COLORS } from '../../utils/helpers';

interface Props { open: boolean; onClose: () => void; }

export default function AddGroupModal({ open, onClose }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('other');
  const [coverColor, setCoverColor] = useState(COVER_COLORS[0]);
  const [emails, setEmails] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [error, setError] = useState('');

  const { mutate, isPending } = useMutation({
    mutationFn: groupsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] });
      onClose();
      resetForm();
    },
    onError: (e: any) => setError(e || 'Failed to create group'),
  });

  const resetForm = () => {
    setName(''); setDescription(''); setCategory('other');
    setCoverColor(COVER_COLORS[0]); setEmails([]); setEmailInput(''); setError('');
  };

  const addEmail = () => {
    const e = emailInput.trim().toLowerCase();
    if (e && !emails.includes(e)) setEmails([...emails, e]);
    setEmailInput('');
  };

  const submit = () => {
    if (!name.trim()) { setError('Group name is required'); return; }
    setError('');
    mutate({ name: name.trim(), description, category, cover_color: coverColor, member_emails: emails });
  };

  return (
    <Modal open={open} onClose={onClose} title="Create New Group">
      <div className="space-y-4">
        {error && <div className="bg-red-50 text-red-600 px-3 py-2 rounded-xl text-sm">{error}</div>}

        {/* Cover color picker */}
        <div>
          <label className="label">Color</label>
          <div className="flex gap-2 flex-wrap">
            {COVER_COLORS.map(c => (
              <button key={c} onClick={() => setCoverColor(c)}
                className={`w-8 h-8 rounded-full transition-transform hover:scale-110 ${coverColor === c ? 'ring-2 ring-offset-2 ring-slate-600 scale-110' : ''}`}
                style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>

        <div>
          <label className="label">Group Name *</label>
          <input className="input" placeholder="e.g. Goa Trip 2024" value={name} onChange={e => setName(e.target.value)} />
        </div>

        <div>
          <label className="label">Description</label>
          <input className="input" placeholder="Optional description" value={description} onChange={e => setDescription(e.target.value)} />
        </div>

        <div>
          <label className="label">Category</label>
          <div className="grid grid-cols-3 gap-2">
            {GROUP_CATEGORIES.map(c => (
              <button key={c.value} onClick={() => setCategory(c.value)}
                className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                  category === c.value ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:border-indigo-300'
                }`}>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Add Members by Email</label>
          <div className="flex gap-2">
            <input className="input" placeholder="friend@example.com" value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addEmail())} />
            <button onClick={addEmail} className="btn-secondary px-3 flex-shrink-0">
              <Plus size={16} />
            </button>
          </div>
          {emails.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {emails.map(e => (
                <span key={e} className="badge bg-indigo-50 text-indigo-700">
                  {e}
                  <button onClick={() => setEmails(emails.filter(x => x !== e))} className="ml-1 hover:text-indigo-900">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <p className="text-xs text-slate-400 mt-1">Members must already have an account</p>
        </div>

        <div className="flex gap-3 pt-2">
          <button className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
          <button className="btn-primary flex-1" onClick={submit} disabled={isPending}>
            {isPending ? 'Creating...' : 'Create Group'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
