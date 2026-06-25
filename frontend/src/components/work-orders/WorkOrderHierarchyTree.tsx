'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-react';
import type { WorkOrder } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { MainWoSubProgressBar } from './MainWoSubProgressBar';
import { isSubWorkOrderProgressComplete } from '@/lib/work-order-sub-progress';
import { subWoMechanicProgressLabel } from '@/lib/work-order-mechanic-progress';

function sortSubs(subs: WorkOrder[]): WorkOrder[] {
  return [...subs].sort((a, b) => a.wo_number.localeCompare(b.wo_number));
}

function WoLine({
  wo,
  linked = true,
  highlighted = false,
}: {
  wo: WorkOrder;
  linked?: boolean;
  highlighted?: boolean;
}) {
  return (
    <p
      className={cn(
        'text-sm leading-relaxed text-slate-900',
        highlighted && 'rounded-md bg-orange-50 px-2 py-0.5'
      )}
    >
      {linked ? (
        <Link href={`/work-orders/${wo.id}`} className="font-semibold text-orange-600 hover:underline">
          {wo.wo_number}
        </Link>
      ) : (
        <span className="font-semibold">{wo.wo_number}</span>
      )}
      <span> → {wo.title}</span>
    </p>
  );
}

export function WorkOrderHierarchyTree({
  main,
  subs,
  highlightId,
  className,
  canDeleteSub,
  onDeleteSub,
  canEditSub,
  onEditSub,
}: {
  main: WorkOrder;
  subs: WorkOrder[];
  highlightId?: number;
  className?: string;
  canDeleteSub?: (sub: WorkOrder) => boolean;
  onDeleteSub?: (sub: WorkOrder) => void;
  canEditSub?: (sub: WorkOrder) => boolean;
  onEditSub?: (sub: WorkOrder) => void;
}) {
  const sortedSubs = sortSubs(subs);
  const showSubActions = Boolean(onDeleteSub || onEditSub);

  return (
    <div className={cn('text-slate-900', className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="text-sm font-bold">Main WO</p>
        {sortedSubs.length > 0 && (
          <MainWoSubProgressBar subs={sortedSubs} className="max-w-xs flex-1 sm:min-w-[12rem]" />
        )}
      </div>
      <div className="mt-1">
        <WoLine wo={main} highlighted={highlightId === main.id} />
      </div>

      {sortedSubs.length > 0 && (
        <div className="mt-4 pl-10">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold">Sub WO</p>
            {showSubActions && (
              <p className="text-xs text-slate-500">
                Hapus Sub WO terlebih dahulu agar Main WO dapat dihapus.
              </p>
            )}
          </div>
          <div className="relative mt-2">
            <div
              className="absolute bottom-2 left-0 top-0 w-0.5 bg-slate-900"
              aria-hidden
            />
            <ul className="space-y-2 pl-8">
              {sortedSubs.map((sub) => {
                const canDel = canDeleteSub?.(sub) ?? false;
                const canEdit = canEditSub?.(sub) ?? false;

                return (
                  <li key={sub.id} className="relative">
                    <span
                      className="absolute -left-8 top-[0.65rem] flex w-7 items-center text-slate-900"
                      aria-hidden
                    >
                      <span className="h-0.5 flex-1 bg-slate-900" />
                      <span className="px-0.5 text-sm leading-none">→</span>
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <WoLine wo={sub} highlighted={highlightId === sub.id} />
                      <Badge status={sub.status} />
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[10px] font-medium',
                          isSubWorkOrderProgressComplete(sub)
                            ? 'bg-green-100 text-green-800'
                            : 'bg-amber-100 text-amber-800'
                        )}
                        title={subWoMechanicProgressLabel(sub)}
                      >
                        {subWoMechanicProgressLabel(sub)}
                      </span>
                      {showSubActions && (canDel || canEdit) && (
                        <div className="ml-auto flex shrink-0 gap-1">
                          {canEdit && onEditSub && (
                            <button
                              type="button"
                              onClick={() => onEditSub(sub)}
                              className="rounded p-1 text-slate-500 hover:bg-slate-100"
                              title={`Edit ${sub.wo_number}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {canDel && onDeleteSub && (
                            <button
                              type="button"
                              onClick={() => onDeleteSub(sub)}
                              className="rounded p-1 text-red-500 hover:bg-red-50"
                              title={`Hapus ${sub.wo_number}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

/** Bangun data hierarki dari Main WO atau Sub WO (butuh relasi parent + sub_work_orders). */
export function resolveWorkOrderHierarchy(wo: WorkOrder): {
  main: WorkOrder;
  subs: WorkOrder[];
} | null {
  if (wo.type === 'main') {
    return {
      main: wo,
      subs: wo.sub_work_orders ?? [],
    };
  }

  if (wo.parent) {
    const subs = wo.parent.sub_work_orders?.length
      ? wo.parent.sub_work_orders
      : [wo];

    return {
      main: wo.parent,
      subs,
    };
  }

  return null;
}

export function shouldShowWorkOrderHierarchy(wo: WorkOrder): boolean {
  if (wo.type === 'main' && (wo.sub_work_orders?.length ?? 0) > 0) {
    return true;
  }
  return wo.type === 'sub' && !!wo.parent;
}

const hierarchyToggleBtnClass =
  'inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100';

export function WorkOrderHierarchyToggleButton({
  open,
  subCount,
  onClick,
}: {
  open: boolean;
  subCount: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={hierarchyToggleBtnClass}
      aria-expanded={open}
      title={open ? 'Tutup struktur Main/Sub WO' : 'Buka struktur Main/Sub WO'}
    >
      {open ? (
        <>
          <ChevronUp className="h-4 w-4" />
          Tutup
        </>
      ) : (
        <>
          <ChevronDown className="h-4 w-4" />
          {subCount} Sub WO
        </>
      )}
    </button>
  );
}

export function WorkOrderHierarchyPanel({
  main,
  subs,
  highlightId,
  defaultOpen = false,
  className,
  canDeleteSub,
  onDeleteSub,
  canEditSub,
  onEditSub,
}: {
  main: WorkOrder;
  subs: WorkOrder[];
  highlightId?: number;
  defaultOpen?: boolean;
  className?: string;
  canDeleteSub?: (sub: WorkOrder) => boolean;
  onDeleteSub?: (sub: WorkOrder) => void;
  canEditSub?: (sub: WorkOrder) => boolean;
  onEditSub?: (sub: WorkOrder) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm',
        className
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-slate-50"
        aria-expanded={open}
      >
        <h3 className="font-semibold text-slate-900">Struktur Main WO & Sub WO</h3>
        <span className={cn(hierarchyToggleBtnClass, 'shrink-0')}>
          {open ? (
            <>
              <ChevronUp className="h-4 w-4" />
              Tutup
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" />
              Buka ({subs.length} Sub WO)
            </>
          )}
        </span>
      </button>
      {open && (
        <div className="border-t border-slate-100 px-5 py-4">
          <WorkOrderHierarchyTree
            main={main}
            subs={subs}
            highlightId={highlightId}
            canDeleteSub={canDeleteSub}
            onDeleteSub={onDeleteSub}
            canEditSub={canEditSub}
            onEditSub={onEditSub}
          />
        </div>
      )}
    </div>
  );
}
