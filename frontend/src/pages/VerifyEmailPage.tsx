import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, Receipt, MailCheck } from 'lucide-react';
import { authApi } from '../api';

type Status = 'idle' | 'loading' | 'success' | 'error';

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [status, setStatus] = useState<Status>(token ? 'idle' : 'error');
  const [message, setMessage] = useState(token ? '' : 'No verification token found in the link.');

  const verify = () => {
    if (!token) return;
    setStatus('loading');

    authApi.verifyEmail(token)
      .then(({ message: msg }) => {
        setStatus('success');
        setMessage(msg || 'Email verified!');
      })
      .catch((e: any) => {
        setStatus('error');
        setMessage(e || 'Verification failed. The link may have expired.');
      });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Receipt size={24} className="text-white" />
            </div>
          </div>
        </div>

        <div className="card p-10 shadow-xl text-center">
          {status === 'idle' && (
            <>
              <MailCheck size={48} className="text-indigo-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-slate-900">Confirm your email</h2>
              <p className="text-slate-500 mt-2">Tap the button below to verify this address for Splitwell.</p>
              <button onClick={verify} className="btn-primary inline-block mt-6">Verify Email Address</button>
            </>
          )}

          {status === 'loading' && (
            <>
              <Loader2 size={48} className="text-indigo-500 animate-spin mx-auto mb-4" />
              <h2 className="text-xl font-bold text-slate-900">Verifying your email…</h2>
              <p className="text-slate-500 mt-2">Please wait a moment.</p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle size={56} className="text-emerald-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-slate-900">Email verified!</h2>
              <p className="text-slate-500 mt-2">{message}</p>
              <p className="text-sm text-slate-400 mt-4">You're all set — you can close this tab now and go back to Splitwell.</p>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle size={56} className="text-red-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-slate-900">Verification failed</h2>
              <p className="text-slate-500 mt-2">{message}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
