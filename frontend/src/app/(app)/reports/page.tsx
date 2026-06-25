'use client';

import { useState } from 'react';
import { BarChart3, Coins, History } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { AnalyticsTab } from '@/components/reports/AnalyticsTab';
import { CostReportTab } from '@/components/reports/CostReportTab';
import { HistoryTab } from '@/components/reports/HistoryTab';
import { cn } from '@/lib/utils';

type TabId = 'history' | 'analytics' | 'cost';

const tabs: { id: TabId; label: string; icon: typeof History; description: string }[] = [
  {
    id: 'history',
    label: 'History (Riwayat)',
    icon: History,
    description: 'Work Order & aktivitas mekanik',
  },
  {
    id: 'analytics',
    label: 'Report (Laporan KPI)',
    icon: BarChart3,
    description: 'Produktivitas, lead time, kinerja, spare part',
  },
  {
    id: 'cost',
    label: 'Cost Report (Biaya)',
    icon: Coins,
    description: 'Biaya per WO: Labour Cost & Material Cost',
  },
];

export default function ReportsPage() {
  const [tab, setTab] = useState<TabId>('history');

  return (
    <div className="p-8">
      <PageHeader
        title="History & Reports"
        subtitle="Data yang dapat dilihat dan dianalisa — riwayat operasional dan laporan KPI workshop"
      />

      <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-1">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'inline-flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-medium transition',
                active
                  ? 'border border-b-white border-slate-200 bg-white text-orange-700 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      <p className="mb-4 text-xs text-slate-500">{tabs.find((t) => t.id === tab)?.description}</p>

      {tab === 'history' && <HistoryTab />}
      {tab === 'analytics' && <AnalyticsTab />}
      {tab === 'cost' && <CostReportTab />}
    </div>
  );
}
