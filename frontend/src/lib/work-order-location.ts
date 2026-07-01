import type { WorkOrder } from '@/lib/types';

export function formatWorkshopType(value?: string | null): string {
  const trimmed = value?.trim();
  if (!trimmed) return '—';

  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/** Label lokasi WO: Sub WO dari workshop-nya; Main WO dari gabungan workshop Sub WO. */
export function workOrderLocationLabel(wo: WorkOrder): string {
  if (wo.type === 'sub') {
    return formatWorkshopType(wo.workshop);
  }

  const workshops = [
    ...new Set(
      (wo.sub_work_orders ?? [])
        .map((sub) => sub.workshop?.trim())
        .filter((workshop): workshop is string => Boolean(workshop))
    ),
  ];

  if (workshops.length === 0) {
    return '—';
  }

  return workshops.map(formatWorkshopType).join(', ');
}
