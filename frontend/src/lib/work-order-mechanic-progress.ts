import type { MechanicActivity, WorkOrder } from '@/lib/types';

export type SubWoMechanicProgress = {
  approved: number;
  target: number;
  open: number;
  complete: boolean;
};

function workingActivities(wo: WorkOrder): MechanicActivity[] {
  return (wo.mechanic_activities ?? []).filter(
    (a) => a.mode === 'working' && a.status !== 'rejected'
  );
}

function distinctUserIds(activities: MechanicActivity[]): number {
  return new Set(activities.map((a) => a.user_id)).size;
}

export function targetManpower(wo: WorkOrder): number {
  return Math.max(1, wo.manpower_count ?? 1);
}

export function getSubWoMechanicProgress(wo: WorkOrder): SubWoMechanicProgress {
  if (
    typeof wo.approved_mechanics_count === 'number' &&
    typeof wo.open_mechanics_count === 'number'
  ) {
    const approved = wo.approved_mechanics_count;
    const target = targetManpower(wo);
    const open = wo.open_mechanics_count;

    return {
      approved,
      target,
      open,
      complete: approved >= target && open === 0,
    };
  }

  const working = workingActivities(wo);
  const approved = distinctUserIds(working.filter((a) => a.status === 'approved'));
  const open = distinctUserIds(
    working.filter((a) => a.status === 'draft' || a.status === 'pending_approval')
  );
  const target = targetManpower(wo);

  return {
    approved,
    target,
    open,
    complete: approved >= target && open === 0,
  };
}

export function isSubWoMechanicCrewComplete(wo: WorkOrder): boolean {
  return getSubWoMechanicProgress(wo).complete;
}

export function subWoMechanicProgressLabel(wo: WorkOrder): string {
  const { approved, target, open, complete } = getSubWoMechanicProgress(wo);

  if (complete) {
    return `Selesai (${approved}/${target} mekanik)`;
  }
  if (open > 0) {
    return `Progress (${approved}/${target} mekanik, ${open} masih kerja)`;
  }
  return `Progress (${approved}/${target} mekanik)`;
}

export function canFinishWorkOrderByMechanicCrew(wo: WorkOrder): {
  allowed: boolean;
  reason?: string;
} {
  const progress = getSubWoMechanicProgress(wo);

  if (progress.open > 0) {
    return {
      allowed: false,
      reason: `Masih ada ${progress.open} mekanik dengan aktivitas belum disetujui pada WO ini.`,
    };
  }

  if (progress.approved < progress.target) {
    return {
      allowed: false,
      reason: `Belum semua mekanik selesai (${progress.approved}/${progress.target} manpower). Tunggu setiap mekanik mencatat dan disetujui aktivitasnya.`,
    };
  }

  return { allowed: true };
}
