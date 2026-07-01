import { useState } from 'react';
import { MailCheck, X, RefreshCw } from 'lucide-react';
import { authApi } from '../api';
import { useAuthStore } from '../store/authStore';

export default function EmailBanner() {
  const { user } = useAuthStore();
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  if (!user || user.email_verified || dismissed) return null;

  const resend = async () => {
    setSending(true); setError('');
    try {
      await authApi.resendVerification();
      setSent(true);
      setTimeout(() => setSent(false), 5000);
    } catch (e: any) {
      setError(e || 'Could not send email');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center gap-3 text-sm">
      <MailCheck size={18} className="text-amber-600 flex-shrink-0" />
      <div className="flex-1">
        <span className="text-amber-800 font-medium">Please verify your email address.</span>
        <span className="text-amber-700 ml-2">
          We sent a link to <strong>{user.email}</strong>.
          {' '}Check your spam folder if you don't see it.
        </span>
        {sent && <span className="text-emerald-700 font-medium ml-2">✓ Email sent!</span>}
        {error && <span className="text-red-600 ml-2">{error}</span>}
      </div>
      <button
        onClick={resend}
        disabled={sending}
        className="flex items-center gap-1.5 text-amber-700 hover:text-amber-900 font-medium px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50 flex-shrink-0"
      >
        <RefreshCw size={14} className={sending ? 'animate-spin' : ''} />
        {sending ? 'Sending…' : 'Resend email'}
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="text-amber-500 hover:text-amber-700 transition-colors flex-shrink-0 p-1"
        title="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  );
}
