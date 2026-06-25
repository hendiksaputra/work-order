import type { WorkOrder } from './types';
import { isSubWoMechanicCrewComplete } from '@/lib/work-order-mechanic-progress';

/** Sub WO dianggap selesai setelah supervisor menekan Finish (≥ in_execution). */
export const SUB_WO_FINISHED_STATUSES = [
  'in_execution',
  'qc_pending',
  'qc_approved',
  'closed',
] as const;

export function isSubWorkOrderFinished(status: string): boolean {
  return (SUB_WO_FINISHED_STATUSES as readonly string[]).includes(status);
}

/** Sub WO dihitung selesai jika Finish+ dan seluruh manpower sudah selesai bekerja. */
export function isSubWorkOrderProgressComplete(sub: WorkOrder): boolean {
  if (!isSubWorkOrderFinished(sub.status)) {
    return false;
  }
  const count = sub.working_activities_count;
  const hasActivities =
    typeof count === 'number'
      ? count > 0
      : (sub.mechanic_activities ?? []).some(
          (a) => a.mode === 'working' && a.status !== 'rejected'
        );
  if (!hasActivities) {
    return false;
  }
  return isSubWoMechanicCrewComplete(sub);
}

export function calcMainWoSubProgress(subs: WorkOrder[]): {
  total: number;
  finished: number;
  percent: number;
} {
  const total = subs.length;
  if (total === 0) {
    return { total: 0, finished: 0, percent: 0 };
  }
  const finished = subs.filter((sub) => isSubWorkOrderProgressComplete(sub)).length;
  const percent = Math.round((finished / total) * 100);
  return { total, finished, percent };
}

function woSubWorkOrders(wo: WorkOrder): WorkOrder[] {
  const extended = wo as WorkOrder & { subWorkOrders?: WorkOrder[] };
  return wo.sub_work_orders ?? extended.subWorkOrders ?? [];
}

/** Progress % WO — Main dari Sub WO selesai; Sub dari status alur (Finish+). */
export function calcWorkOrderProgressPercent(wo: WorkOrder): number {
  if (wo.type === 'main') {
    const subs = woSubWorkOrders(wo);
    if (subs.length === 0) {
      return isSubWorkOrderProgressComplete(wo) ? 100 : 0;
    }
    return calcMainWoSubProgress(subs).percent;
  }
  return isSubWorkOrderProgressComplete(wo) ? 100 : 0;
}

export type SubWoProgressColor = {
  bar: string;
  text: string;
  track: string;
};

/** Warna progress bar & label berdasarkan % Sub WO selesai. */
export function getSubWoProgressColor(percent: number): SubWoProgressColor {
  if (percent >= 100) {
    return {
      bar: 'bg-green-500',
      text: 'text-green-700',
      track: 'bg-green-100',
    };
  }
  if (percent >= 75) {
    return {
      bar: 'bg-teal-500',
      text: 'text-teal-700',
      track: 'bg-teal-100',
    };
  }
  if (percent >= 50) {
    return {
      bar: 'bg-blue-500',
      text: 'text-blue-700',
      track: 'bg-blue-100',
    };
  }
  if (percent >= 25) {
    return {
      bar: 'bg-amber-500',
      text: 'text-amber-700',
      track: 'bg-amber-100',
    };
  }
  if (percent > 0) {
    return {
      bar: 'bg-orange-500',
      text: 'text-orange-700',
      track: 'bg-orange-100',
    };
  }
  return {
    bar: 'bg-red-400',
    text: 'text-red-600',
    track: 'bg-red-100',
  };
}
