'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Halaman legacy — redirect ke daftar WO (form sekarang modal). */
export default function NewWorkOrderPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/work-orders');
  }, [router]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center p-8 text-slate-500">
      Mengalihkan ke Work Order...
    </div>
  );
}
