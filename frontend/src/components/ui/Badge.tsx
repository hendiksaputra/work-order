import { cn, STATUS_COLORS } from '@/lib/utils';

export function Badge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
        STATUS_COLORS[status] || 'bg-gray-100 text-gray-700',
        className
      )}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}
