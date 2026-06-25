'use client';

import type { WorkOrder } from '@/lib/types';
import { calcMainWoSubProgress, getSubWoProgressColor } from '@/lib/work-order-sub-progress';
import { cn } from '@/lib/utils';

export function MainWoSubProgressBar({
  subs,
  compact = false,
  className,
}: {
  subs: WorkOrder[];
  compact?: boolean;
  className?: string;
}) {
  const { total, finished, percent } = calcMainWoSubProgress(subs);
  if (total === 0) return null;

  const colors = getSubWoProgressColor(percent);

  return (
    <div className={cn('min-w-[8rem]', className)} title={`${finished} dari ${total} Sub WO sudah selesai`}>
      <div
        className={cn(
          'w-full overflow-hidden rounded-full',
          colors.track,
          compact ? 'h-1.5' : 'h-2'
        )}
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progress Sub WO ${percent}%`}
      >
        <div
          className={cn('h-full rounded-full transition-all duration-300', colors.bar)}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className={cn('mt-1 text-slate-500', compact ? 'text-[10px]' : 'text-xs')}>
        <span className={cn('font-semibold', colors.text)}>{percent}%</span>
        <span className="mx-1">·</span>
        {finished}/{total} Sub WO selesai
      </p>
    </div>
  );
}
