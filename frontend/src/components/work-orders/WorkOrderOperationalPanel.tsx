'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { DELAY_CAUSE_OPTIONS } from '@/lib/delay-cause';
import type { DelayCause, WorkOrder } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { WorkOrderOperationalStatusEditor } from '@/components/work-orders/WorkOrderOperationalStatusEditor';
import { operationalStatusOption } from '@/lib/wo-operational-status';

type Props = {
  wo: WorkOrder;
  canEdit: boolean;
  onSaved: (wo: WorkOrder) => void;
};

export function WorkOrderOperationalPanel({ wo, canEdit, onSaved }: Props) {
  const [delayCause, setDelayCause] = useState<DelayCause | ''>(wo.delay_cause ?? '');
  const [delayNotes, setDelayNotes] = useState(wo.delay_notes ?? '');
  const [installedAt, setInstalledAt] = useState(
    wo.component_installed_at ? wo.component_installed_at.slice(0, 10) : ''
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const save = async () => {
    setSaving(true);
    setMessage('');
    try {
      const updated = await api<WorkOrder>(`/work-orders/${wo.id}/operational-fields`, {
        method: 'PATCH',
        body: JSON.stringify({
          delay_cause: delayCause || null,
          delay_notes: delayNotes || null,
          component_installed_at: installedAt || null,
        }),
      });
      onSaved(updated);
      setMessage('Data operasional disimpan.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  const operational = operationalStatusOption(wo.operational_status);

  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="font-semibold text-slate-900">Status Operasional & Laporan</h3>
      <p className="mt-1 text-sm text-slate-500">
        Status operasional (Status WO) dan data delay/komponen untuk Reports.
      </p>

      <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status operasional</p>
        <div className="mt-2">
          <WorkOrderOperationalStatusEditor wo={wo} canEdit={canEdit} onSaved={onSaved} />
        </div>
        {operational && (
          <p className="mt-2 text-sm text-slate-600">
            {operational.description}
            <span className="ml-2 text-xs text-slate-400">({operational.progressHint})</span>
          </p>
        )}
      </div>

      {(canEdit || wo.delay_cause || wo.delay_notes || wo.component_installed_at) &&
        (canEdit ? (
        <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Penyebab keterlambatan</span>
            <select
              value={delayCause}
              onChange={(e) => setDelayCause(e.target.value as DelayCause | '')}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">— Tidak ada —</option>
              {DELAY_CAUSE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Tanggal pasang komponen</span>
            <input
              type="date"
              value={installedAt}
              onChange={(e) => setInstalledAt(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium text-slate-700">Catatan delay</span>
            <textarea
              value={delayNotes}
              onChange={(e) => setDelayNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Opsional — detail keterlambatan"
            />
          </label>
          <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
            >
              {saving ? 'Menyimpan…' : 'Simpan'}
            </button>
            {message && <span className="text-sm text-slate-600">{message}</span>}
          </div>
        </div>
      ) : (
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Penyebab delay</dt>
            <dd className="font-medium">
              {wo.delay_cause
                ? DELAY_CAUSE_OPTIONS.find((o) => o.value === wo.delay_cause)?.label ?? wo.delay_cause
                : '—'}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Tanggal pasang</dt>
            <dd className="font-medium">{formatDate(wo.component_installed_at)}</dd>
          </div>
          {wo.delay_notes && (
            <div>
              <dt className="text-slate-500">Catatan</dt>
              <dd className="mt-1 text-slate-800">{wo.delay_notes}</dd>
            </div>
          )}
        </dl>
        ))}
    </div>
  );
}
