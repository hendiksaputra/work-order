import type { WorkOrder } from './types';
import { canCompleteWorkOrderExecution } from './work-order-body-utils';
import { workOrderStatusLabel } from './work-order-messages';

/** WO dibuat oleh role supervisor — tidak perlu diajukan ke supervisor lain. */
export function isWorkOrderCreatedBySupervisor(wo: WorkOrder): boolean {
  return wo.creator?.role === 'supervisor';
}

/** Status yang dapat dinaikkan supervisor lewat approve (satu langkah per klik). */
export const WORK_ORDER_ADVANCE_STATUSES = [
  'pending_supervisor',
  'approved',
  'in_execution',
  'qc_pending',
  'qc_approved',
] as const;

export type WorkOrderAdvanceStatus = (typeof WORK_ORDER_ADVANCE_STATUSES)[number];

const NEXT_STATUS: Record<WorkOrderAdvanceStatus, string> = {
  pending_supervisor: 'approved',
  approved: 'in_execution',
  in_execution: 'qc_pending',
  qc_pending: 'qc_approved',
  qc_approved: 'closed',
};

export interface WorkOrderAdvanceAction {
  buttonLabel: string;
  listTitle: string;
  confirmTitle: string;
  confirmMessage: string;
  nextStatus: string;
  nextStatusLabel: string;
  isClose: boolean;
}

export function canAdvanceWorkOrder(wo: WorkOrder, hasApprovePermission: boolean): boolean {
  if (!hasApprovePermission) return false;
  if (wo.status === 'draft' && isWorkOrderCreatedBySupervisor(wo)) return true;
  return WORK_ORDER_ADVANCE_STATUSES.includes(wo.status as WorkOrderAdvanceStatus);
}

/** Aksi advance yang disembunyikan di kolom Action daftar `/work-orders`. */
const WORK_ORDER_LIST_HIDDEN_ADVANCE_STATUSES = ['approved'] as const;

/** Tampilkan tombol advance di tabel daftar WO (tanpa Mulai Eksekusi). */
export function canShowAdvanceOnWorkOrderList(
  wo: WorkOrder,
  hasApprovePermission: boolean
): boolean {
  if (!canAdvanceWorkOrder(wo, hasApprovePermission)) return false;
  return !WORK_ORDER_LIST_HIDDEN_ADVANCE_STATUSES.includes(
    wo.status as (typeof WORK_ORDER_LIST_HIDDEN_ADVANCE_STATUSES)[number]
  );
}

export function canRejectWorkOrder(wo: WorkOrder, hasApprovePermission: boolean): boolean {
  return hasApprovePermission && wo.status === 'pending_supervisor';
}

export function getWorkOrderAdvanceAction(wo: WorkOrder): WorkOrderAdvanceAction | null {
  if (wo.status === 'draft' && isWorkOrderCreatedBySupervisor(wo)) {
    const nextStatus = 'approved';
    const nextStatusLabel = workOrderStatusLabel(nextStatus);
    return {
      buttonLabel: 'Setujui WO',
      listTitle: 'Setujui WO (supervisor)',
      confirmTitle: 'Setujui Work Order',
      confirmMessage: `${wo.wo_number} akan disetujui dan dibuka (TGL BUKA).\nStatus berikutnya: ${nextStatusLabel}.`,
      nextStatus,
      nextStatusLabel,
      isClose: false,
    };
  }

  if (!WORK_ORDER_ADVANCE_STATUSES.includes(wo.status as WorkOrderAdvanceStatus)) {
    return null;
  }

  const status = wo.status as WorkOrderAdvanceStatus;
  const nextStatus = NEXT_STATUS[status];
  const nextStatusLabel = workOrderStatusLabel(nextStatus);
  const base = {
    nextStatus,
    nextStatusLabel,
    isClose: nextStatus === 'closed',
  };

  switch (status) {
    case 'pending_supervisor':
      return {
        ...base,
        buttonLabel: 'Setujui WO',
        listTitle: 'Setujui WO (supervisor)',
        confirmTitle: 'Setujui Work Order',
        confirmMessage: `${wo.wo_number} akan disetujui dan dibuka (TGL BUKA).\nStatus berikutnya: ${nextStatusLabel}.`,
      };
    case 'approved':
      return {
        ...base,
        buttonLabel: 'Finish',
        listTitle: 'Finish eksekusi',
        confirmTitle: 'Finish',
        confirmMessage: `${wo.wo_number} akan diselesaikan dan masuk tahap berikutnya.\nStatus berikutnya: ${nextStatusLabel}.`,
      };
    case 'in_execution':
      return {
        ...base,
        buttonLabel: 'Kirim ke QC',
        listTitle: 'Kirim ke QC',
        confirmTitle: 'Kirim ke QC',
        confirmMessage: `${wo.wo_number} selesai dieksekusi dan dikirim ke QC.\nStatus berikutnya: ${nextStatusLabel}.`,
      };
    case 'qc_pending':
      return {
        ...base,
        buttonLabel: 'Setujui QC',
        listTitle: 'Setujui QC',
        confirmTitle: 'Setujui QC',
        confirmMessage: `QC untuk ${wo.wo_number} disetujui.\nStatus berikutnya: ${nextStatusLabel}.`,
      };
    case 'qc_approved':
      return {
        ...base,
        buttonLabel: 'Tutup Work Order',
        listTitle: 'Tutup WO',
        confirmTitle: 'Tutup Work Order',
        confirmMessage: `${wo.wo_number} akan ditutup permanen (TGL TUTUP).\nSetelah ditutup, WO tidak dapat dilanjutkan lagi.`,
      };
    default:
      return null;
  }
}

export function workOrderWorkflowHint(wo: WorkOrder): string | null {
  if (wo.status === 'approved') {
    const finishCheck = canCompleteWorkOrderExecution(wo);
    if (!finishCheck.allowed) {
      return finishCheck.reason ?? 'Setujui semua aktivitas mekanik sebelum Finish.';
    }
  }

  const action = getWorkOrderAdvanceAction(wo);
  if (!action) {
    if (wo.status === 'closed') {
      return 'Work Order sudah ditutup.';
    }
    if (wo.status === 'rejected') {
      return 'Work Order ditolak supervisor. Perbaiki lalu ajukan ulang dari draft.';
    }
    if (wo.status === 'draft') {
      if (isWorkOrderCreatedBySupervisor(wo)) {
        return 'WO dibuat supervisor — setujui langsung tanpa pengajuan.';
      }
      return 'Ajukan ke supervisor untuk memulai alur persetujuan.';
    }
    return null;
  }
  return `Langkah berikutnya: ${action.buttonLabel} → ${action.nextStatusLabel}`;
}
