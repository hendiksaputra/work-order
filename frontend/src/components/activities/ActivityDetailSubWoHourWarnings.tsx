'use client';

import { useMemo } from 'react';
import type { MechanicActivity, WorkOrder } from '@/lib/types';
import { collectExceededSubWoHourBudgets } from '@/lib/sub-wo-hour-budget';
import { SubWoHourBudgetWarning } from '@/components/activities/SubWoHourBudgetWarning';

export function ActivityDetailSubWoHourWarnings({
  activities,
  subWoList = [],
}: {
  activities: MechanicActivity[];
  subWoList?: WorkOrder[];
}) {
  const exceededBudgets = useMemo(
    () => collectExceededSubWoHourBudgets(activities, subWoList),
    [activities, subWoList]
  );

  if (!exceededBudgets.length) {
    return null;
  }

  return (
    <div className="mb-3 space-y-2">
      {exceededBudgets.map((budget) => (
        <SubWoHourBudgetWarning key={budget.subWoId} budget={budget} />
      ))}
    </div>
  );
}

export function SubWoExceededInlineBadge({
  exceeded,
}: {
  exceeded: boolean;
}) {
  if (!exceeded) {
    return null;
  }

  return (
    <span className="mt-1 inline-flex rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
      Melebihi target
    </span>
  );
}
