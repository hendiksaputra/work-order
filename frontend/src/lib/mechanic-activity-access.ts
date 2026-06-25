import type { MechanicActivity, User } from '@/lib/types';

const editableStatuses = ['draft', 'rejected'] as const;

export function canManageMechanicActivity(
  activity: MechanicActivity,
  user: User | null | undefined,
  hasUpdatePermission: boolean
): boolean {
  if (!user || !hasUpdatePermission) return false;
  if (!editableStatuses.includes(activity.status as (typeof editableStatuses)[number])) {
    return false;
  }
  return activity.user_id === user.id;
}

export function canEditMechanicActivityAnyStatus(hasEditAnyStatus: boolean): boolean {
  return hasEditAnyStatus;
}

export function canEditMechanicActivity(
  activity: MechanicActivity,
  user: User | null | undefined,
  hasUpdatePermission: boolean,
  hasEditAnyStatus: boolean
): boolean {
  return (
    canEditMechanicActivityAnyStatus(hasEditAnyStatus) ||
    canManageMechanicActivity(activity, user, hasUpdatePermission)
  );
}

export function canDeleteMechanicActivityAnyStatus(hasDeleteAnyStatus: boolean): boolean {
  return hasDeleteAnyStatus;
}

export function canSubmitMechanicActivity(
  activity: MechanicActivity,
  user: User | null | undefined,
  hasSubmitPermission: boolean
): boolean {
  if (!user || !hasSubmitPermission || activity.status !== 'draft') return false;
  return activity.user_id === user.id;
}

export function canDeleteMechanicActivity(
  activity: MechanicActivity,
  user: User | null | undefined,
  hasDeletePermission: boolean,
  hasDeleteAnyStatus: boolean
): boolean {
  return (
    canDeleteMechanicActivityAnyStatus(hasDeleteAnyStatus) ||
    canManageMechanicActivity(activity, user, hasDeletePermission)
  );
}
