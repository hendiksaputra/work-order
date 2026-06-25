import type { WorkOrder } from './types';
import { STATUS_LABELS } from './utils';

export function workOrderStatusLabel(status: string): string {
  return STATUS_LABELS[status] || status;
}

export function workOrderApproveSuccessMessage(
  wo: WorkOrder,
  action: 'approve' | 'reject',
  apiMessage?: string
): string {
  if (apiMessage) return apiMessage;
  if (action === 'reject') {
    return `Work Order ${wo.wo_number} ditolak supervisor.`;
  }
  if (wo.status === 'closed') {
    return `Work Order ${wo.wo_number} ditutup. TGL TUTUP tercatat di laporan.`;
  }
  return `Work Order ${wo.wo_number} berhasil diproses. Status: ${workOrderStatusLabel(wo.status)}.`;
}

export function workOrderSubmitSuccessMessage(wo: WorkOrder, apiMessage?: string): string {
  return (
    apiMessage ||
    `Work Order ${wo.wo_number} berhasil diajukan. Menunggu persetujuan supervisor.`
  );
}
