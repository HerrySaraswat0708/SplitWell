import { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, Receipt } from 'lucide-react';
import { authApi } from '../api';
import { useAuthStore } from '../store/authStore';

type Status = 'loading' | 'success' | 'error';

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = params.get('token');
    if (!token) { setStatus('error'); setMessage('No verification token found in the link.'); return; }

    authApi.verifyEmail(token)
      .then(({ token: jwt, user, message: msg }) => {
        setAuth(user, jwt);          // update stored session with verified user
        setStatus('success');
        setMessage(msg || 'Email verified!');
        setTimeout(() => navigate('/'), 3000);
      })
      .catch((e: any) => {
        setStatus('error');
        setMessage(e || 'Verification failed. The link may have expired.');
      });
  }, []);

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
              <p className="text-sm text-slate-400 mt-4">Redirecting you to the dashboard…</p>
              <Link to="/" className="btn-primary inline-block mt-4">Go to Dashboard</Link>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle size={56} className="text-red-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-slate-900">Verification failed</h2>
              <p className="text-slate-500 mt-2">{message}</p>
              <div className="flex gap-3 justify-center mt-6">
                <Link to="/" className="btn-secondary">Go to Dashboard</Link>
                <Link to="/login" className="btn-primary">Sign in</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
