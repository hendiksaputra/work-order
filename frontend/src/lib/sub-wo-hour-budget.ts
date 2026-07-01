import type { MechanicActivity, WorkOrder } from '@/lib/types';
import { calculateWorkHours } from '@/lib/activity-hours';

export type SubWoHourBudget = {
  subWoId: number;
  woNumber: string;
  allocatedHours: number;
  loggedHours: number;
  newActivityHours: number;
  totalAfterSave: number;
  exceeded: boolean;
  overByHours: number;
};

export function getSubWoAllocatedHours(subWo: WorkOrder | undefined | null): number {
  if (!subWo) return 0;
  const target = Number(subWo.target_hours ?? 0);
  if (target > 0) return target;
  return Number(subWo.estimated_hours ?? 0);
}

export function getSubWoLoggedHours(subWo: WorkOrder | undefined | null): number {
  if (!subWo) return 0;
  if (typeof subWo.logged_hours_sum === 'number') {
    return Number(subWo.logged_hours_sum);
  }
  return Number(subWo.actual_hours ?? 0);
}

export function buildSubWoHourBudget(
  subWo: WorkOrder | undefined | null,
  newActivityHours: number
): SubWoHourBudget | null {
  if (!subWo) return null;

  const allocatedHours = getSubWoAllocatedHours(subWo);
  const loggedHours = getSubWoLoggedHours(subWo);
  const totalAfterSave = loggedHours + newActivityHours;
  const exceeded = allocatedHours > 0 && totalAfterSave > allocatedHours;

  return {
    subWoId: subWo.id,
    woNumber: subWo.wo_number,
    allocatedHours,
    loggedHours,
    newActivityHours,
    totalAfterSave,
    exceeded,
    overByHours: exceeded ? totalAfterSave - allocatedHours : 0,
  };
}

export function collectSubWoHourBudgetsForActivities(
  activities: MechanicActivity[],
  subWoList: WorkOrder[] = []
): SubWoHourBudget[] {
  const seen = new Set<number>();
  const budgets: SubWoHourBudget[] = [];

  for (const activity of activities) {
    if (activity.mode !== 'working' || !activity.work_order_id || activity.status === 'rejected') {
      continue;
    }
    if (seen.has(activity.work_order_id)) {
      continue;
    }
    seen.add(activity.work_order_id);

    const budget = buildSubWoHourBudget(resolveSubWoForActivity(activity, subWoList), 0);
    if (budget) {
      budgets.push(budget);
    }
  }

  return budgets;
}

export function collectExceededSubWoHourBudgets(
  activities: MechanicActivity[],
  subWoList: WorkOrder[] = []
): SubWoHourBudget[] {
  return collectSubWoHourBudgetsForActivities(activities, subWoList).filter((budget) => budget.exceeded);
}

export function resolveSubWoForActivity(
  activity: MechanicActivity,
  subWoList: WorkOrder[] = []
): WorkOrder | undefined {
  if (!activity.work_order_id) {
    return undefined;
  }

  return (
    subWoList.find((wo) => wo.id === activity.work_order_id) ?? activity.work_order
  );
}

export function computeNewActivityWorkHours(
  startTime: string,
  endTime: string,
  activityDate: string,
  endTimeStopped: boolean
): number {
  if (!endTimeStopped || !startTime || !endTime) return 0;
  return calculateWorkHours(startTime, endTime, activityDate);
}
