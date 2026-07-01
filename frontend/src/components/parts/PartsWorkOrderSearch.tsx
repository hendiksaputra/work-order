'use client';

import { useCallback, useMemo } from 'react';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import type { WorkOrder } from '@/lib/types';

export type PartsWorkOrderOption = Pick<
  WorkOrder,
  'id' | 'wo_number' | 'title' | 'main_category' | 'status'
>;

function workOrderLabel(wo: PartsWorkOrderOption): string {
  const cat = wo.main_category ? ` [${wo.main_category}]` : '';
  return `${wo.wo_number} — ${wo.title}${cat}`;
}

function filterWorkOrders(list: PartsWorkOrderOption[], query: string): PartsWorkOrderOption[] {
  const q = query.trim().toLowerCase();
  const filtered = q
    ? list.filter(
        (w) =>
          w.wo_number.toLowerCase().includes(q) ||
          w.title.toLowerCase().includes(q) ||
          (w.main_category?.toLowerCase().includes(q) ?? false) ||
          (w.status?.toLowerCase().includes(q) ?? false) ||
          workOrderLabel(w).toLowerCase().includes(q)
      )
    : list;

  return filtered.slice(0, 50);
}

export function PartsWorkOrderSearch({
  workOrders,
  value,
  onChange,
  wrapperClassName,
  placeholder = 'Ketik nomor WO atau judul...',
  required,
}: {
  workOrders: PartsWorkOrderOption[];
  value: string;
  onChange: (workOrderId: string) => void;
  wrapperClassName?: string;
  placeholder?: string;
  required?: boolean;
}) {
  const selected = useMemo(
    () => workOrders.find((w) => String(w.id) === value),
    [workOrders, value]
  );
  const displayValue = selected ? workOrderLabel(selected) : '';

  const search = useCallback(
    (query: string) => Promise.resolve(filterWorkOrders(workOrders, query)),
    [workOrders]
  );

  const defaultWrapper =
    'mt-1 flex w-full rounded-lg border border-slate-300 px-2 py-0.5 focus-within:border-orange-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-orange-200';

  return (
    <div className={wrapperClassName ?? defaultWrapper}>
      <SearchableSelect<PartsWorkOrderOption>
        value={displayValue}
        onChange={(next, option) => {
          if (!next || !option) {
            onChange('');
            return;
          }
          onChange(String(option.id));
        }}
        onSearch={search}
        getOptionValue={workOrderLabel}
        getOptionLabel={workOrderLabel}
        getOptionKey={(w) => String(w.id)}
        placeholder={placeholder}
        required={required}
        className="w-full border-0 bg-transparent px-0 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
      />
    </div>
  );
}
