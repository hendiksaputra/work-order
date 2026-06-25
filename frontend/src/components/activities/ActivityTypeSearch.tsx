'use client';

import { useCallback, useMemo } from 'react';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import type { ActivityType } from '@/lib/types';

function activityTypeLabel(type: ActivityType): string {
  return `[${type.category}] ${type.name}`;
}

function filterActivityTypes(types: ActivityType[], query: string): ActivityType[] {
  const q = query.trim().toLowerCase();
  const filtered = q
    ? types.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          activityTypeLabel(t).toLowerCase().includes(q)
      )
    : types;

  return filtered.slice(0, 50);
}

export function ActivityTypeSearch({
  types,
  value,
  onChange,
  wrapperClassName,
  placeholder = 'Ketik untuk mencari aktivitas...',
  required,
}: {
  types: ActivityType[];
  value: string;
  onChange: (activityTypeId: string) => void;
  wrapperClassName?: string;
  placeholder?: string;
  required?: boolean;
}) {
  const selected = useMemo(
    () => types.find((t) => String(t.id) === value),
    [types, value]
  );
  const displayValue = selected ? activityTypeLabel(selected) : '';

  const search = useCallback(
    (query: string) => Promise.resolve(filterActivityTypes(types, query)),
    [types]
  );

  return (
    <div className={wrapperClassName}>
      <SearchableSelect<ActivityType>
        value={displayValue}
        onChange={(next, option) => {
          if (!next || !option) {
            onChange('');
            return;
          }
          onChange(String(option.id));
        }}
        onSearch={search}
        getOptionValue={activityTypeLabel}
        getOptionLabel={activityTypeLabel}
        getOptionKey={(t) => String(t.id)}
        placeholder={placeholder}
        required={required}
        className="w-full border-0 bg-transparent px-0 py-0 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
      />
    </div>
  );
}
