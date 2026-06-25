'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getDefaultRoute } from '@/lib/permissions';
import { ShieldX } from 'lucide-react';

export default function UnauthorizedPage() {
  const { user } = useAuth();
  const home = getDefaultRoute(user);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
      <ShieldX className="h-16 w-16 text-red-400" />
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Akses Ditolak</h1>
      <p className="mt-2 max-w-md text-slate-600">
        Role <span className="font-semibold capitalize">{user.role}</span> tidak memiliki izin
        untuk halaman ini. Hubungi supervisor atau admin jika Anda memerlukan akses.
      </p>
      <Link
        href={home}
        className="mt-6 rounded-lg bg-orange-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-orange-700"
      >
        Kembali ke Beranda
      </Link>
    </div>
  );
}
