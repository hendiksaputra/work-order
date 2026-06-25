import type { PartsRequest, User } from '@/lib/types';

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
  hasSupervisorPermission: boolean
): boolean {
  return hasSupervisorPermission && request.status === 'pending_approval';
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
