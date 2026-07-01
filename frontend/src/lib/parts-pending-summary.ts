import type { PartsPendingApprovalSummary } from '@/lib/types';
import { formatWorkshopLabel } from '@/lib/parts-workshop';

export { formatWorkshopLabel } from '@/lib/parts-workshop';

export function formatPartsPendingBadgeTitle(summary: PartsPendingApprovalSummary): string {
  if (!summary.by_department?.length) {
    return `${summary.count} parts request menunggu persetujuan supervisor`;
  }

  const details = summary.by_department
    .map((row) => {
      const label = formatWorkshopLabel(row.workshop);
      const names =
        row.supervisors.length > 0
          ? ` (${row.supervisors.join(', ')})`
          : '';
      return `${label}: ${row.count}${names}`;
    })
    .join(' · ');

  return `${summary.count} parts menunggu approval supervisor — ${details}`;
}
