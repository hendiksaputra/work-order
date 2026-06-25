'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ClipboardList, Clock, AlertCircle, TrendingUp } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import type { WorkOrder } from '@/lib/types';

interface DashboardData {
  status_counts: Record<string, number>;
  open_main_wo: number;
  pending_approvals: number;
  productive_hours_month: number;
  non_productive_hours_month: number;
  recent_work_orders: WorkOrder[];
  workshop_breakdown: Record<string, number>;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    api<DashboardData>('/dashboard').then(setData).catch(console.error);
  }, []);

  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center p-8">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  const totalHours = data.productive_hours_month + data.non_productive_hours_month;
  const productivePct = totalHours
    ? Math.round((data.productive_hours_month / totalHours) * 100)
    : 0;

  const stats = [
    { label: 'Main WO Aktif', value: data.open_main_wo, icon: ClipboardList, color: 'bg-blue-500' },
    { label: 'Pending Approval', value: data.pending_approvals, icon: AlertCircle, color: 'bg-amber-500' },
    { label: 'Jam Produktif (Bulan)', value: `${data.productive_hours_month}h`, icon: TrendingUp, color: 'bg-green-500' },
    { label: 'Produktivitas', value: `${productivePct}%`, icon: Clock, color: 'bg-orange-500' },
  ];

  return (
    <div className="p-8">
      <PageHeader
        title="Dashboard Work Order"
        subtitle="Monitoring workshop berbasis data — Main WO + Sub WO"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className={`inline-flex rounded-lg p-2 ${s.color}`}>
                <Icon className="h-5 w-5 text-white" />
              </div>
              <p className="mt-3 text-2xl font-bold">{s.value}</p>
              <p className="text-sm text-slate-500">{s.label}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-slate-900">Work Order Terbaru</h3>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="pb-2">No WO</th>
                  <th className="pb-2">Judul</th>
                  <th className="pb-2">Tipe</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_work_orders.map((wo) => (
                  <tr key={wo.id} className="border-b border-slate-50">
                    <td className="py-3">
                      <Link href={`/work-orders/${wo.id}`} className="font-medium text-orange-600 hover:underline">
                        {wo.wo_number}
                      </Link>
                    </td>
                    <td className="py-3">{wo.title}</td>
                    <td className="py-3 capitalize">{wo.type}</td>
                    <td className="py-3"><Badge status={wo.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <InfoCard title="Sub WO per Workshop">
            <ul className="space-y-2">
              {Object.entries(data.workshop_breakdown).map(([ws, count]) => (
                <li key={ws} className="flex justify-between text-sm">
                  <span className="capitalize">{ws}</span>
                  <span className="font-semibold">{count}</span>
                </li>
              ))}
              {Object.keys(data.workshop_breakdown).length === 0 && (
                <li className="text-sm text-slate-400">Tidak ada sub WO aktif</li>
              )}
            </ul>
          </InfoCard>
          <InfoCard title="Alur WO">
            <p className="text-xs leading-relaxed text-slate-600">
              WO Created → Supervisor Approval → Execution → QC → Final Approval → Closed
            </p>
          </InfoCard>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="font-semibold">{title}</h3>
      <div className="mt-4">{children}</div>
    </div>
  );
}
