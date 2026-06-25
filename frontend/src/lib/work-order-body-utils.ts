import {
  canFinishWorkOrderByMechanicCrew,
} from '@/lib/work-order-mechanic-progress';
import type { MechanicActivity, PartsRequest, PartsRequestItem, WorkOrder } from './types';
import { formatPartsCurrency, partsItemLineTotal } from './parts-item-utils';
import { STATUS_LABELS } from './utils';

const APPROVED_PARTS_STATUSES = ['approved', 'logistic_check', 'taken'] as const;

const ID_MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
] as const;

export type JobActivityRow = {
  workDescription: string;
  startDate: string;
  finishDate: string;
  totalManHours: number;
  status: string;
  statusLabel: string;
};

export type PartConsumableRow = {
  partNumber: string;
  description: string;
  qty: number;
  price: number;
  totalPrice: number;
};

export type CrewRow = {
  nik: string;
  mechanic: string;
  totalManHours: number;
  statusNote?: string;
};

export function formatDateLong(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  return `${day} ${ID_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function activityStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status.replace(/_/g, ' ');
}

function woSubWorkOrders(wo: WorkOrder): WorkOrder[] {
  const extended = wo as WorkOrder & { subWorkOrders?: WorkOrder[] };
  return wo.sub_work_orders ?? extended.subWorkOrders ?? [];
}

function activitiesOnWorkOrder(wo: WorkOrder): MechanicActivity[] {
  const extended = wo as WorkOrder & { mechanicActivities?: MechanicActivity[] };
  const acts = wo.mechanic_activities ?? extended.mechanicActivities ?? [];
  return acts.map((a) => (a.work_order ? a : { ...a, work_order: wo }));
}

function partsOnWorkOrder(wo: WorkOrder): PartsRequest[] {
  const extended = wo as WorkOrder & { partsRequests?: PartsRequest[] };
  return wo.parts_requests ?? extended.partsRequests ?? [];
}

/** Aktivitas pada WO ini; Main WO menggabungkan semua Sub WO di bawahnya. */
export function woMechanicActivities(wo: WorkOrder): MechanicActivity[] {
  const own = activitiesOnWorkOrder(wo);
  if (wo.type !== 'main') {
    return own;
  }
  const subActivities = woSubWorkOrders(wo).flatMap((sub) => activitiesOnWorkOrder(sub));
  return [...own, ...subActivities];
}

/** Parts request pada WO ini; Main WO menggabungkan semua Sub WO di bawahnya. */
export function woPartsRequests(wo: WorkOrder): PartsRequest[] {
  const own = partsOnWorkOrder(wo);
  if (wo.type !== 'main') {
    return own;
  }
  const subParts = woSubWorkOrders(wo).flatMap((sub) => partsOnWorkOrder(sub));
  return [...own, ...subParts];
}

/** Aktivitas working yang ditampilkan (semua kecuali ditolak). */
function visibleActivities(wo: WorkOrder): MechanicActivity[] {
  return woMechanicActivities(wo).filter((a) => a.mode === 'working' && a.status !== 'rejected');
}

function approvedPartsRequests(wo: WorkOrder): PartsRequest[] {
  return woPartsRequests(wo).filter((pr) =>
    APPROVED_PARTS_STATUSES.includes(pr.status as (typeof APPROVED_PARTS_STATUSES)[number])
  );
}

function activityToJobRow(activity: MechanicActivity): JobActivityRow {
  const typeName = activity.activity_type?.name ?? 'Aktivitas';
  const subWo = activity.work_order?.wo_number;
  return {
    workDescription: subWo ? `${subWo} — ${typeName}` : typeName,
    startDate: formatDateLong(activity.activity_date),
    finishDate: formatDateLong(activity.activity_date),
    totalManHours: Math.round(Number(activity.total_hours || 0) * 100) / 100,
    status: activity.status,
    statusLabel: activityStatusLabel(activity.status),
  };
}

export function buildJobActivityRows(wo: WorkOrder): JobActivityRow[] {
  const activities = visibleActivities(wo);
  const approved = activities.filter((a) => a.status === 'approved');
  const other = activities.filter((a) => a.status !== 'approved');

  const groups = new Map<string, MechanicActivity[]>();
  for (const activity of approved) {
    const key = String(activity.activity_type_id);
    const list = groups.get(key) ?? [];
    list.push(activity);
    groups.set(key, list);
  }

  const approvedRows: JobActivityRow[] = [...groups.values()].map((list) => {
    const dates = list.map((a) => a.activity_date).sort();
    const hours = list.reduce((sum, a) => sum + Number(a.total_hours || 0), 0);
    return {
      workDescription: list[0]?.activity_type?.name ?? 'Aktivitas',
      startDate: formatDateLong(dates[0]),
      finishDate: formatDateLong(dates[dates.length - 1]),
      totalManHours: Math.round(hours * 100) / 100,
      status: 'approved',
      statusLabel: activityStatusLabel('approved'),
    };
  });

  const otherRows = other
    .sort((a, b) => String(a.activity_date).localeCompare(String(b.activity_date)))
    .map(activityToJobRow);

  return [...approvedRows, ...otherRows];
}

export function buildPartConsumableRows(wo: WorkOrder): PartConsumableRow[] {
  const rows: PartConsumableRow[] = [];

  for (const pr of approvedPartsRequests(wo)) {
    for (const item of pr.items ?? []) {
      rows.push(mapPartItem(item));
    }
  }

  return rows;
}

function mapPartItem(item: PartsRequestItem): PartConsumableRow {
  const qty = Number(item.qty) || 0;
  const price = Number(item.unit_cost) || 0;
  return {
    partNumber: item.part_number?.trim() || '—',
    description: item.part_name,
    qty,
    price,
    totalPrice: partsItemLineTotal(item),
  };
}

export function buildCrewRows(wo: WorkOrder): CrewRow[] {
  const byUser = new Map<
    number,
    { nik: string; mechanic: string; totalManHours: number; statuses: Set<string> }
  >();

  for (const activity of visibleActivities(wo)) {
    const userId = activity.user_id;
    const hours = Number(activity.total_hours) || 0;
    const existing = byUser.get(userId);

    if (existing) {
      existing.totalManHours = Math.round((existing.totalManHours + hours) * 100) / 100;
      existing.statuses.add(activity.status);
      continue;
    }

    byUser.set(userId, {
      nik: activity.user?.employee_id?.trim() || '—',
      mechanic: activity.user?.name ?? '—',
      totalManHours: Math.round(hours * 100) / 100,
      statuses: new Set([activity.status]),
    });
  }

  return [...byUser.values()]
    .map((row) => ({
      nik: row.nik,
      mechanic: row.mechanic,
      totalManHours: row.totalManHours,
      statusNote:
        row.statuses.size === 1 && row.statuses.has('approved')
          ? undefined
          : [...row.statuses].map(activityStatusLabel).join(', '),
    }))
    .sort((a, b) => a.mechanic.localeCompare(b.mechanic, 'id'));
}

export function hasWorkOrderBodyData(wo: WorkOrder): boolean {
  return (
    visibleActivities(wo).length > 0 ||
    buildPartConsumableRows(wo).length > 0
  );
}

export function hasUnapprovedActivities(wo: WorkOrder): boolean {
  return visibleActivities(wo).some((a) => a.status !== 'approved');
}

/** Supervisor boleh tekan Finish (approved → in_execution) hanya jika semua aktivitas working sudah approved. */
export function canCompleteWorkOrderExecution(wo: WorkOrder): {
  allowed: boolean;
  reason?: string;
} {
  const activities = visibleActivities(wo);
  if (activities.length === 0) {
    return {
      allowed: false,
      reason: 'Belum ada aktivitas mekanik pada Work Order ini.',
    };
  }
  if (hasUnapprovedActivities(wo)) {
    return {
      allowed: false,
      reason: 'Semua aktivitas mekanik di JOB ACTIVITY harus disetujui terlebih dahulu.',
    };
  }

  const crewCheck = canFinishWorkOrderByMechanicCrew(wo);
  if (!crewCheck.allowed) {
    return crewCheck;
  }

  return { allowed: true };
}

export function isWorkOrderFinishAdvanceBlocked(wo: WorkOrder): boolean {
  return wo.status === 'approved' && !canCompleteWorkOrderExecution(wo).allowed;
}
