'use client';

import type { PartsPendingApprovalSummary } from '@/lib/types';
import { formatWorkshopLabel } from '@/lib/parts-pending-summary';

export function PartsPendingPlannerNotice({ summary }: { summary: PartsPendingApprovalSummary | null }) {
  if (!summary || summary.count <= 0) {
    return null;
  }

  const rows = summary.by_department ?? [];

  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <p className="font-semibold">
        {summary.count} permintaan parts menunggu approval supervisor
      </p>
      {rows.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {rows.map((row) => (
            <li
              key={row.workshop}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 rounded-lg bg-white/70 px-3 py-2"
            >
              <span>
                <strong>{formatWorkshopLabel(row.workshop)}</strong>
                {row.supervisors.length > 0 && (
                  <span className="text-amber-800/80"> — {row.supervisors.join(', ')}</span>
                )}
              </span>
              <span className="font-semibold tabular-nums">{row.count} request</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-amber-800">Belum ada breakdown per lokasi supervisor.</p>
      )}
    </div>
  );
}
