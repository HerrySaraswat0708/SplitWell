import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { authApi } from '../api';
import { useAuthStore } from '../store/authStore';
import Sidebar from './Sidebar';
import EmailBanner from './EmailBanner';

export default function Layout({ children }: { children: React.ReactNode }) {
  const setUser = useAuthStore(s => s.setUser);
  // Keep the cached user (e.g. email_verified) fresh — it can change server-side
  // without this tab knowing, e.g. verifying the email link on another device.
  const { data } = useQuery({ queryKey: ['me'], queryFn: () => authApi.me() });

  useEffect(() => {
    if (data?.user) setUser(data.user);
  }, [data, setUser]);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        <EmailBanner />
        <main className="flex-1">
          <div className="max-w-6xl mx-auto px-6 py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
