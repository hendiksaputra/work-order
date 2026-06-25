export type WorkOrderOperationalStatus =
  | 'open'
  | 'wait_man_power'
  | 'ready_to_start'
  | 'in_progress'
  | 'wait_decision'
  | 'waiting_part'
  | 'waiting_tool'
  | 'waiting_alat_angkat'
  | 'waiting_inspection'
  | 'waiting_machining'
  | 'waiting_fabrication'
  | 'hold'
  | 'cancel'
  | 'completed'
  | 'verified_closed';

import type { WorkOrder } from '@/lib/types';
import {
  calcMainWoSubProgress,
  calcWorkOrderProgressPercent,
} from '@/lib/work-order-sub-progress';

export const OPERATIONAL_COMPLETION_STATUSES: WorkOrderOperationalStatus[] = [
  'completed',
  'verified_closed',
];

export type WorkOrderOperationalStatusOption = {
  value: WorkOrderOperationalStatus;
  label: string;
  description: string;
  progressHint: string;
};

/** Status operasional WO — sumber: Status WO.docx */
export const WORK_ORDER_OPERATIONAL_STATUS_OPTIONS: WorkOrderOperationalStatusOption[] = [
  {
    value: 'open',
    label: 'OPEN',
    description: 'WO baru dibuat dan belum diproses',
    progressHint: 'Progress terhitung 0%',
  },
  {
    value: 'wait_man_power',
    label: 'WAIT MAN POWER',
    description: 'WO belum dikerjakan karena manpower belum ditentukan supervisor',
    progressHint: 'Tidak berjalan',
  },
  {
    value: 'ready_to_start',
    label: 'READY TO START',
    description: 'WO siap dikerjakan',
    progressHint: 'Bisa berjalan',
  },
  {
    value: 'in_progress',
    label: 'IN PROGRESS',
    description: 'Pekerjaan sedang berjalan',
    progressHint: 'Progress berjalan',
  },
  {
    value: 'wait_decision',
    label: 'WAIT DECISION',
    description: 'Pekerjaan tertunda menunggu keputusan customer / management / engineering',
    progressHint: 'Progress berhenti',
  },
  {
    value: 'waiting_part',
    label: 'WAITING PART',
    description: 'Pekerjaan tertunda karena part/material belum tersedia',
    progressHint: 'Progress berhenti',
  },
  {
    value: 'waiting_tool',
    label: 'WAITING TOOL',
    description: 'Pekerjaan tertunda karena tools belum tersedia',
    progressHint: 'Progress berhenti',
  },
  {
    value: 'waiting_alat_angkat',
    label: 'WAITING ALAT ANGKAT',
    description: 'Pekerjaan tertunda karena crane/forklift/alat angkat tidak tersedia',
    progressHint: 'Progress berhenti',
  },
  {
    value: 'waiting_inspection',
    label: 'WAITING INSPECTION',
    description: 'Menunggu proses inspeksi/QC/customer',
    progressHint: 'Progress berhenti',
  },
  {
    value: 'waiting_machining',
    label: 'WAITING MACHINING',
    description: 'Menunggu proses machining',
    progressHint: 'Progress berhenti',
  },
  {
    value: 'waiting_fabrication',
    label: 'WAITING FABRICATION',
    description: 'Menunggu proses fabrikasi',
    progressHint: 'Progress berhenti',
  },
  {
    value: 'hold',
    label: 'HOLD',
    description: 'Pekerjaan dihentikan sementara',
    progressHint: 'Progress berhenti',
  },
  {
    value: 'cancel',
    label: 'CANCEL',
    description: 'Pekerjaan dibatalkan',
    progressHint: 'Tidak dihitung',
  },
  {
    value: 'completed',
    label: 'COMPLETED',
    description: 'Pekerjaan selesai',
    progressHint: '100%',
  },
  {
    value: 'verified_closed',
    label: 'CLOSED',
    description: 'WO sudah diverifikasi dan ditutup',
    progressHint: 'Final',
  },
];

export function operationalStatusLabel(value?: string | null): string {
  if (!value) return '—';
  return WORK_ORDER_OPERATIONAL_STATUS_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function operationalStatusOption(
  value?: string | null
): WorkOrderOperationalStatusOption | undefined {
  if (!value) return undefined;
  return WORK_ORDER_OPERATIONAL_STATUS_OPTIONS.find((o) => o.value === value);
}

export function isOperationalCompletionStatus(
  status: WorkOrderOperationalStatus
): boolean {
  return OPERATIONAL_COMPLETION_STATUSES.includes(status);
}

/** COMPLETED / CLOSED hanya jika progress WO sudah 100%. */
export function canSelectOperationalStatus(
  wo: WorkOrder,
  status: WorkOrderOperationalStatus
): boolean {
  if (!isOperationalCompletionStatus(status)) {
    return true;
  }
  return calcWorkOrderProgressPercent(wo) >= 100;
}

export function hasInvalidOperationalCompletion(wo: WorkOrder): boolean {
  const current = wo.operational_status as WorkOrderOperationalStatus | undefined;
  if (!current || !isOperationalCompletionStatus(current)) {
    return false;
  }
  return calcWorkOrderProgressPercent(wo) < 100;
}

/** Status operasional yang aman untuk diedit saat progress belum 100%. */
export function resolveEditableOperationalStatus(wo: WorkOrder): WorkOrderOperationalStatus {
  const current = (wo.operational_status as WorkOrderOperationalStatus) || 'open';
  if (canSelectOperationalStatus(wo, current)) {
    return current;
  }
  if (current === 'verified_closed' || current === 'completed') {
    return calcWorkOrderProgressPercent(wo) > 0 ? 'in_progress' : 'open';
  }
  return current;
}

export function operationalCompletionBlockedMessage(wo: WorkOrder): string {
  const percent = calcWorkOrderProgressPercent(wo);
  if (wo.type === 'main') {
    const extended = wo as WorkOrder & { subWorkOrders?: WorkOrder[] };
    const subs = wo.sub_work_orders ?? extended.subWorkOrders ?? [];
    if (subs.length > 0) {
      const { finished, total } = calcMainWoSubProgress(subs);
      return `Progress ${percent}% (${finished}/${total} Sub WO selesai). COMPLETED dan CLOSED hanya bisa dipilih setelah 100%.`;
    }
  }
  return `Progress ${percent}%. COMPLETED dan CLOSED hanya bisa dipilih setelah semua pekerjaan selesai (100%).`;
}

export const OPERATIONAL_STATUS_COLORS: Record<string, string> = {
  open: 'bg-slate-100 text-slate-700',
  wait_man_power: 'bg-orange-100 text-orange-900',
  ready_to_start: 'bg-sky-100 text-sky-800',
  in_progress: 'bg-indigo-100 text-indigo-800',
  wait_decision: 'bg-amber-100 text-amber-900',
  waiting_part: 'bg-yellow-100 text-yellow-900',
  waiting_tool: 'bg-yellow-100 text-yellow-900',
  waiting_alat_angkat: 'bg-yellow-100 text-yellow-900',
  waiting_inspection: 'bg-purple-100 text-purple-800',
  waiting_machining: 'bg-purple-100 text-purple-800',
  waiting_fabrication: 'bg-purple-100 text-purple-800',
  hold: 'bg-red-100 text-red-800',
  cancel: 'bg-gray-200 text-gray-600 line-through',
  completed: 'bg-teal-100 text-teal-800',
  verified_closed: 'bg-green-100 text-green-800',
};
