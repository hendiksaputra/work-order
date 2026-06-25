import type { DelayCause } from '@/lib/types';

export const DELAY_CAUSE_LABELS: Record<DelayCause, string> = {
  spare_part: 'Spare part',
  manpower: 'Manpower',
  tools: 'Tools / peralatan',
  other: 'Lainnya',
};

export const DELAY_CAUSE_OPTIONS: { value: DelayCause; label: string }[] = (
  Object.entries(DELAY_CAUSE_LABELS) as [DelayCause, string][]
).map(([value, label]) => ({ value, label }));
