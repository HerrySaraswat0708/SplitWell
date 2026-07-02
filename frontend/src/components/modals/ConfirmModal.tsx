import Modal from './Modal';
import { AlertTriangle } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
}

export default function ConfirmModal({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', danger = false, loading = false }: Props) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        <div className={`flex items-start gap-3 p-4 rounded-xl ${danger ? 'bg-red-50' : 'bg-amber-50'}`}>
          <AlertTriangle size={20} className={`flex-shrink-0 mt-0.5 ${danger ? 'text-red-500' : 'text-amber-500'}`} />
          <p className={`text-sm ${danger ? 'text-red-700' : 'text-amber-700'}`}>{message}</p>
        </div>
        <div className="flex gap-3">
          <button className="btn-secondary flex-1" onClick={onClose} disabled={loading}>Cancel</button>
          <button
            className={`flex-1 px-4 py-2 rounded-xl font-medium transition-colors disabled:opacity-50 ${
              danger ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-amber-500 text-white hover:bg-amber-600'
            }`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
