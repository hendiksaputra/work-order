'use client';

import { useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
import { api } from '@/lib/api';
import type { WorkOrder } from '@/lib/types';
import {
  OPERATIONAL_STATUS_COLORS,
  WORK_ORDER_OPERATIONAL_STATUS_OPTIONS,
  canSelectOperationalStatus,
  hasInvalidOperationalCompletion,
  operationalCompletionBlockedMessage,
  operationalStatusLabel,
  operationalStatusOption,
  resolveEditableOperationalStatus,
  type WorkOrderOperationalStatus,
} from '@/lib/wo-operational-status';
import { calcWorkOrderProgressPercent } from '@/lib/work-order-sub-progress';
import { cn } from '@/lib/utils';

type Props = {
  wo: WorkOrder;
  canEdit: boolean;
  onSaved?: (wo: WorkOrder) => void;
  compact?: boolean;
};

export function WorkOrderOperationalStatusEditor({ wo, canEdit, onSaved, compact }: Props) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<WorkOrderOperationalStatus>(
    resolveEditableOperationalStatus(wo)
  );
  const [notes, setNotes] = useState(wo.operational_status_notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setStatus(resolveEditableOperationalStatus(wo));
      setNotes(wo.operational_status_notes ?? '');
      setError('');
    }
  }, [open, wo]);

  const current = operationalStatusOption(wo.operational_status) ?? operationalStatusOption('open');
  const selected = operationalStatusOption(status);
  const progressPercent = calcWorkOrderProgressPercent(wo);
  const completionBlocked = progressPercent < 100;
  const invalidCompletion = hasInvalidOperationalCompletion(wo);

  const save = async () => {
    if (!canSelectOperationalStatus(wo, status)) {
      setError(operationalCompletionBlockedMessage(wo));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const updated = await api<WorkOrder>(`/work-orders/${wo.id}/operational-fields`, {
        method: 'PATCH',
        body: JSON.stringify({
          operational_status: status,
          operational_status_notes: notes.trim() || null,
        }),
      });
      onSaved?.(updated);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan status operasional');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className={cn('min-w-[8rem]', compact && 'max-w-[11rem]')}>
        <button
          type="button"
          onClick={() => canEdit && setOpen(true)}
          disabled={!canEdit}
          className={cn(
            'group w-full text-left',
            canEdit && 'cursor-pointer rounded-lg hover:bg-slate-100/80'
          )}
          title={
            canEdit
              ? 'Klik untuk ubah status operasional'
              : [current?.description, wo.operational_status_notes].filter(Boolean).join(' — ')
          }
        >
          <span
            className={cn(
              'inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
              OPERATIONAL_STATUS_COLORS[wo.operational_status ?? 'open'] ??
                'bg-gray-100 text-gray-700'
            )}
          >
            <span className="truncate">{operationalStatusLabel(wo.operational_status)}</span>
            {canEdit && <Pencil className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-70" />}
          </span>
          {invalidCompletion && (
            <p className="mt-1 text-xs font-medium text-red-600">
              Tidak valid — progress {progressPercent}%
            </p>
          )}
          {wo.operational_status_notes && (
            <p className="mt-1 line-clamp-2 text-xs text-slate-500">{wo.operational_status_notes}</p>
          )}
          {!invalidCompletion && !wo.operational_status_notes && (
            <p className="mt-1 line-clamp-2 text-xs text-slate-400">
              Progress WO {progressPercent}%
            </p>
          )}
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="wo-operational-status-title"
        >
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h2 id="wo-operational-status-title" className="text-lg font-semibold text-slate-900">
              Status Operasional — {wo.wo_number}
            </h2>
            <p className="mt-1 text-sm text-slate-500">{wo.title}</p>
            <p className="mt-2 text-sm font-medium text-slate-700">
              Progress WO: <span className="text-orange-600">{progressPercent}%</span>
            </p>

            {invalidCompletion && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                Status <strong>{operationalStatusLabel(wo.operational_status)}</strong> tidak
                sesuai progress ({progressPercent}%). Pilih status lain lalu simpan untuk
                memperbaiki.
              </div>
            )}

            <div className="mt-4 space-y-4">
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Status</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as WorkOrderOperationalStatus)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {WORK_ORDER_OPERATIONAL_STATUS_OPTIONS.map((o) => {
                    const disabled = !canSelectOperationalStatus(wo, o.value);
                    return (
                      <option key={o.value} value={o.value} disabled={disabled}>
                        {o.label}
                        {disabled ? ' (perlu progress 100%)' : ''}
                      </option>
                    );
                  })}
                </select>
              </label>

              {completionBlocked && (
                <p className="text-xs text-amber-800">{operationalCompletionBlockedMessage(wo)}</p>
              )}

              {selected && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  <p>{selected.description}</p>
                  <p className="mt-1 text-xs font-medium text-slate-500">{selected.progressHint}</p>
                </div>
              )}

              <label className="block text-sm">
                <span className="font-medium text-slate-700">Keterangan tambahan</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Opsional — detail kondisi WO saat ini"
                />
              </label>

              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
              >
                {saving ? 'Menyimpan…' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
