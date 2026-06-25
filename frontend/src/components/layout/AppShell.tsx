'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { User } from '@/lib/types';
import { AuthProvider } from '@/lib/auth-context';
import { canAccessRoute } from '@/lib/permissions';
import { authApi } from '@/lib/api';
import { Sidebar } from './Sidebar';

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('wo_token');
    const raw = localStorage.getItem('wo_user');
    if (!token || !raw) {
      router.replace('/login');
      return;
    }

    setUser(JSON.parse(raw));

    authApi
      .me()
      .then((fresh) => {
        localStorage.setItem('wo_user', JSON.stringify(fresh));
        setUser(fresh);
      })
      .catch(() => {
        /* keep cached user if refresh fails */
      });
  }, [router]);

  useEffect(() => {
    if (!user || pathname === '/unauthorized') return;
    if (!canAccessRoute(user, pathname)) {
      router.replace('/unauthorized');
    }
  }, [user, pathname, router]);

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <AuthProvider user={user}>
      <div className="flex min-h-screen bg-slate-100">
        <Sidebar user={user} />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </AuthProvider>
  );
}
