'use client';

import type { SubWoHourBudget } from '@/lib/sub-wo-hour-budget';
import { formatDecimalHours } from '@/lib/utils';

export function SubWoHourBudgetWarning({ budget }: { budget: SubWoHourBudget | null }) {
  if (!budget || budget.allocatedHours <= 0) {
    return null;
  }

  if (!budget.exceeded) {
    return (
      <p className="text-xs text-slate-500">
        Jam Sub WO {budget.woNumber}:{' '}
        <span className="font-medium text-slate-700">
          {formatDecimalHours(budget.totalAfterSave)} / {formatDecimalHours(budget.allocatedHours)}
        </span>
        {budget.newActivityHours > 0 && (
          <span className="text-slate-400">
            {' '}
            (tercatat {formatDecimalHours(budget.loggedHours)} + baru{' '}
            {formatDecimalHours(budget.newActivityHours)})
          </span>
        )}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex shrink-0 items-center rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
          Melebihi Jam Sub WO
        </span>
        <span className="font-semibold">{budget.woNumber}</span>
      </div>
      <p>
        Total jam kerja setelah aktivitas ini{' '}
        <strong>{formatDecimalHours(budget.totalAfterSave)}</strong> melebihi target Sub WO{' '}
        <strong>{formatDecimalHours(budget.allocatedHours)}</strong>
        {budget.overByHours > 0 && (
          <>
            {' '}
            (lebih <strong>{formatDecimalHours(budget.overByHours)}</strong>)
          </>
        )}
        .
      </p>
      <p className="text-xs text-red-800/90">
        Sudah tercatat {formatDecimalHours(budget.loggedHours)} + aktivitas baru{' '}
        {formatDecimalHours(budget.newActivityHours)}. Aktivitas tetap dapat disimpan; supervisor
        akan meninjau.
      </p>
    </div>
  );
}
