'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { recordMechanicDayLoginTime } from '@/lib/mechanic-day-session';
import { getDefaultRoute } from '@/lib/permissions';

export default function LoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState('supervisor');
  const [password, setPassword] = useState('password');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { user, token } = await authApi.login(login, password);
      localStorage.setItem('wo_token', token);
      localStorage.setItem('wo_user', JSON.stringify(user));
      if (user.role === 'mechanic') {
        recordMechanicDayLoginTime(user.id);
      }
      router.push(getDefaultRoute(user));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login gagal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 bg-gradient-to-br from-slate-900 via-slate-800 to-orange-900 lg:flex lg:flex-col lg:justify-center lg:px-16">
        <p className="text-sm font-semibold uppercase tracking-widest text-orange-400">
          Workshop APS
        </p>
        <h1 className="mt-4 text-4xl font-bold text-white">
          Workshop Work Order System
        </h1>
        <p className="mt-4 max-w-md text-slate-300">
          Mengelola WO Rebuild & Repair, Mechanic Effective Hours, tracking parts,
          dan workflow Planner → Mechanic → Supervisor.
        </p>
        <p className="mt-8 text-sm italic text-orange-200">
          &quot;Right Process, Right Quality, Right Result.&quot;
        </p>
      </div>
      <div className="flex w-full items-center justify-center px-6 lg:w-1/2">
        <form onSubmit={handleSubmit} className="w-full max-w-md space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Masuk</h2>
            <p className="mt-1 text-sm text-slate-500">
              Gunakan akun demo (password: password)
            </p>
          </div>
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700">Email atau Username</label>
            <input
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              autoComplete="username"
              className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-orange-600 py-3 font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
          >
            {loading ? 'Memproses...' : 'Login'}
          </button>
          <div className="rounded-lg bg-slate-50 p-4 text-xs text-slate-600">
            <p className="font-semibold">Akun demo (password: password):</p>
            <p>Username: admin, administrator, planner, supervisor, mekanik1, logistic</p>
            <p>Atau email: admin@aps.local, supervisor@aps.local, dll.</p>
          </div>
        </form>
      </div>
    </div>
  );
}
