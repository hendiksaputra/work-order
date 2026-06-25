import { cn } from '@/lib/utils';

export function PageHeader({
  title,
  subtitle,
  action,
  centered,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  centered?: boolean;
}) {
  return (
    <div
      className={cn(
        'mb-6 flex flex-wrap gap-4 border-b border-slate-200 pb-4',
        centered ? 'flex-col items-center text-center' : 'items-start justify-between'
      )}
    >
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
