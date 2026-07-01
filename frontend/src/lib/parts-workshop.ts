import type { WorkOrder } from '@/lib/types';

/** Workshop parts request dari WO (main → sub jika perlu). */
export function resolveWorkshopFromWorkOrder(wo: WorkOrder | undefined | null): string {
  if (!wo) return '';

  const direct = (wo.workshop ?? '').trim();
  if (direct) {
    return direct.toLowerCase();
  }

  if (wo.type === 'main') {
    const subs = wo.sub_work_orders ?? [];
    const workshops = [
      ...new Set(
        subs
          .map((sub) => (sub.workshop ?? '').trim().toLowerCase())
          .filter((value) => value !== '')
      ),
    ];
    if (workshops.length === 1) {
      return workshops[0];
    }
  }

  return '';
}

export function formatWorkshopLabel(workshop: string | undefined | null): string {
  const value = (workshop ?? '').trim();
  if (!value || value === 'unknown') return '—';
  return value.charAt(0).toUpperCase() + value.slice(1);
}
