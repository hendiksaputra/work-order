import type { User, WorkOrder } from '@/lib/types';
import { Permission, type PermissionName } from '@/lib/permissions';
import {
  canAdvanceWorkOrder,
  canRejectWorkOrder,
  isWorkOrderCreatedBySupervisor,
} from './work-order-status-flow';

const editableStatuses = ['draft', 'rejected'] as const;

type CanFn = (permission: PermissionName) => boolean;

function hasSubWoDraftPermission(
  wo: WorkOrder,
  action: 'edit' | 'delete',
  hasUpdatePermission: boolean,
  hasSubEditPermission: boolean,
  hasSubDeletePermission: boolean
): boolean {
  if (wo.type !== 'sub') {
    return hasUpdatePermission;
  }
  if (action === 'delete') {
    return hasUpdatePermission || hasSubDeletePermission;
  }
  return hasUpdatePermission || hasSubEditPermission;
}

/** Buat Main WO (permission umum). */
export function canCreateMainWorkOrder(can: CanFn): boolean {
  return can(Permission.WORK_ORDERS_CREATE);
}

/** Buat Sub WO — permission khusus atau fallback ke create umum. */
export function canCreateSubWorkOrder(can: CanFn): boolean {
  return can(Permission.WORK_ORDERS_SUB_CREATE) || can(Permission.WORK_ORDERS_CREATE);
}

/** Edit WO draft/rejected (pemilik atau planner). */
export function canManageWorkOrder(
  wo: WorkOrder,
  user: User | null | undefined,
  hasDraftPermission: boolean
): boolean {
  if (!user || !editableStatuses.includes(wo.status as (typeof editableStatuses)[number])) {
    return false;
  }
  if (!hasDraftPermission) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'planner') return true;
  return wo.created_by === user.id;
}

/** Edit WO termasuk approved, in execution, dll. (permission khusus). */
export function canEditWorkOrderAnyStatus(
  _user: User | null | undefined,
  hasEditAnyStatus: boolean
): boolean {
  return hasEditAnyStatus;
}

export function canEditWorkOrder(
  wo: WorkOrder,
  user: User | null | undefined,
  hasUpdatePermission: boolean,
  hasEditAnyStatus: boolean,
  hasSubEditPermission = false
): boolean {
  if (canEditWorkOrderAnyStatus(user, hasEditAnyStatus)) return true;
  const canEditType = hasSubWoDraftPermission(
    wo,
    'edit',
    hasUpdatePermission,
    hasSubEditPermission,
    false
  );
  if (!canEditType) return false;
  return canManageWorkOrder(wo, user, canEditType);
}

/** Hapus WO termasuk semua status (permission khusus). */
export function canDeleteWorkOrderAnyStatus(
  _user: User | null | undefined,
  hasDeleteAnyStatus: boolean
): boolean {
  return hasDeleteAnyStatus;
}

export function canDeleteWorkOrder(
  wo: WorkOrder,
  user: User | null | undefined,
  hasUpdatePermission: boolean,
  hasDeleteAnyStatus: boolean,
  hasSubDeletePermission = false,
  hasSubEditPermission = false
): boolean {
  if (canDeleteWorkOrderAnyStatus(user, hasDeleteAnyStatus)) return true;
  const canDeleteType = hasSubWoDraftPermission(
    wo,
    'delete',
    hasUpdatePermission,
    hasSubEditPermission,
    hasSubDeletePermission
  );
  if (!canDeleteType) return false;
  return canManageWorkOrder(wo, user, canDeleteType);
}

export function canSubmitWorkOrder(
  wo: WorkOrder,
  user: User | null | undefined,
  hasSubmitPermission: boolean
): boolean {
  if (!user || !hasSubmitPermission || wo.status !== 'draft') return false;
  if (isWorkOrderCreatedBySupervisor(wo)) return false;
  if (user.role === 'supervisor' && wo.created_by === user.id) return false;
  return user.role === 'admin' || user.role === 'planner' || wo.created_by === user.id;
}

/** Supervisor dapat lanjutkan alur atau tolak (hanya saat menunggu supervisor). */
export function canApproveWorkOrder(wo: WorkOrder, hasApprovePermission: boolean): boolean {
  return canAdvanceWorkOrder(wo, hasApprovePermission) || canRejectWorkOrder(wo, hasApprovePermission);
}

/** Jumlah Man Power & Estimasi Jam Kerja — hanya Supervisor (dan admin). */
export function canEditWorkOrderManpowerFields(
  user: User | null | undefined,
  hasApprovePermission: boolean
): boolean {
  if (!user) return false;
  return user.role === 'admin' || hasApprovePermission;
}

export { canAdvanceWorkOrder, canRejectWorkOrder } from './work-order-status-flow';
