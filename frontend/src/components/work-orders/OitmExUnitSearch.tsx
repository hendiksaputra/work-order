'use client';

import { useCallback } from 'react';
import { api } from '@/lib/api';
import type { OitmRecord } from '@/lib/types';
import { SearchableSelect } from '@/components/ui/SearchableSelect';

function optionLabel(item: OitmRecord) {
  return `${item.U_MIS_UnitNo} — ${item.U_MIS_ModeNo}`;
}

export function OitmExUnitSearch({
  unitNo,
  onSelect,
  onManualInput,
  onClear,
  required,
  className,
  placeholder = 'Ketik nomor unit atau pilih dari daftar...',
}: {
  unitNo: string;
  onSelect: (unitNo: string, unitModel: string) => void;
  onManualInput: (unitNo: string) => void;
  onClear: () => void;
  required?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const search = useCallback((query: string) => {
    const params = new URLSearchParams({ limit: '50' });
    if (query) params.set('search', query);
    return api<OitmRecord[]>(`/oitm/lookup?${params}`);
  }, []);

  return (
    <SearchableSelect<OitmRecord>
      value={unitNo}
      onChange={(next, option) => {
        if (!next) {
          onClear();
          return;
        }
        if (option) {
          onSelect(option.U_MIS_UnitNo, option.U_MIS_ModeNo);
          return;
        }
        onManualInput(next);
      }}
      allowFreeText
      onSearch={search}
      getOptionValue={(item) => item.U_MIS_UnitNo}
      getOptionLabel={optionLabel}
      getOptionKey={(item) => `${item.U_MIS_UnitNo}|${item.U_MIS_ModeNo}`}
      placeholder={placeholder}
      required={required}
      className={className}
    />
  );
}
