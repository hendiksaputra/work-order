import type { PartsRequest, User } from '@/lib/types';
import { isWorkOrderVisibleToUser } from '@/lib/department-scope';

const editableStatuses = ['draft', 'rejected'] as const;

export function canManagePartsRequest(
  request: PartsRequest,
  user: User | null | undefined,
  hasUpdatePermission: boolean
): boolean {
  if (!user || !hasUpdatePermission) return false;
  if (!editableStatuses.includes(request.status as (typeof editableStatuses)[number])) {
    return false;
  }
  return request.created_by === user.id;
}

export function canEditPartsRequest(
  request: PartsRequest,
  user: User | null | undefined,
  hasUpdatePermission: boolean,
  hasEditAnyStatus: boolean
): boolean {
  return (
    hasEditAnyStatus || canManagePartsRequest(request, user, hasUpdatePermission)
  );
}

export function canDeletePartsRequest(
  request: PartsRequest,
  user: User | null | undefined,
  hasDeletePermission: boolean,
  hasDeleteAnyStatus: boolean
): boolean {
  return (
    hasDeleteAnyStatus || canManagePartsRequest(request, user, hasDeletePermission)
  );
}

export function canSupervisorApprovePartsRequest(
  request: PartsRequest,
  user: User | null | undefined,
  hasSupervisorPermission: boolean
): boolean {
  if (!hasSupervisorPermission || request.status !== 'pending_approval') {
    return false;
  }

  return isWorkOrderVisibleToUser(request.work_order, user);
}

const submittableStatuses = ['draft', 'rejected'] as const;

export function canSubmitPartsRequest(
  request: PartsRequest,
  user: User | null | undefined,
  hasSubmitPermission: boolean
): boolean {
  if (!hasSubmitPermission || !user) return false;
  if (!submittableStatuses.includes(request.status as (typeof submittableStatuses)[number])) {
    return false;
  }
  if (user.role === 'admin' || user.role === 'planner') {
    return true;
  }
  return request.created_by === user.id;
}

function isLogisticUser(user: User | null | undefined, hasLogisticPermission: boolean): boolean {
  return Boolean(user && hasLogisticPermission && user.role === 'logistic');
}

export function canLogisticCheckPartsRequest(
  request: PartsRequest,
  user: User | null | undefined,
  hasLogisticPermission: boolean
): boolean {
  return isLogisticUser(user, hasLogisticPermission) && request.status === 'approved';
}

export function canLogisticTakenPartsRequest(
  request: PartsRequest,
  user: User | null | undefined,
  hasLogisticPermission: boolean
): boolean {
  return (
    isLogisticUser(user, hasLogisticPermission) &&
    ['approved', 'logistic_check'].includes(request.status)
  );
}
