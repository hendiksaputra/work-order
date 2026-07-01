'use client';

import type { WorkOrder } from '@/lib/types';
import { formatWorkshopType } from '@/lib/work-order-location';

export function filterSubWorkOrdersByMain(
  subList: WorkOrder[],
  mainWoId: string
): WorkOrder[] {
  if (!mainWoId) return [];
  return subList.filter((w) => String(w.parent_id) === mainWoId);
}

export function resolveMainWoIdFromSub(subList: WorkOrder[], subWoId: string): string {
  if (!subWoId) return '';
  const sub = subList.find((w) => String(w.id) === subWoId);
  return sub?.parent_id ? String(sub.parent_id) : '';
}

export function defaultSubWoIdForMain(subList: WorkOrder[], mainWoId: string): string {
  const subs = filterSubWorkOrdersByMain(subList, mainWoId);
  return subs.length === 1 ? String(subs[0].id) : '';
}

type Props = {
  mainList: WorkOrder[];
  subList: WorkOrder[];
  mainWoId: string;
  subWoId: string;
  onMainChange: (mainId: string, subId: string) => void;
  onSubChange: (subId: string) => void;
  inputClassName: string;
};

export function MechanicActivityWoFields({
  mainList,
  subList,
  mainWoId,
  subWoId,
  onMainChange,
  onSubChange,
  inputClassName,
}: Props) {
  const filteredSubs = filterSubWorkOrdersByMain(subList, mainWoId);

  return (
    <>
      <div className="col-span-2">
        <label className="text-sm font-medium text-slate-700">Main WO</label>
        <select
          className={inputClassName}
          value={mainWoId}
          onChange={(e) => {
            const mainId = e.target.value;
            onMainChange(mainId, defaultSubWoIdForMain(subList, mainId));
          }}
          required
        >
          <option value="">Pilih Main WO</option>
          {mainList.map((w) => (
            <option key={w.id} value={w.id}>
              {w.wo_number} — {w.title}
            </option>
          ))}
        </select>
      </div>
      <div className="col-span-2">
        <label className="text-sm font-medium text-slate-700">Sub WO</label>
        <select
          className={inputClassName}
          value={subWoId}
          onChange={(e) => onSubChange(e.target.value)}
          required
          disabled={!mainWoId}
        >
          <option value="">
            {!mainWoId
              ? 'Pilih Main WO terlebih dahulu'
              : filteredSubs.length === 0
                ? 'Tidak ada Sub WO yang sudah disetujui'
                : 'Pilih Sub WO'}
          </option>
          {filteredSubs.map((w) => (
            <option key={w.id} value={w.id}>
              {w.wo_number} — {w.title}
              {w.workshop ? ` (${formatWorkshopType(w.workshop)})` : ''}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
