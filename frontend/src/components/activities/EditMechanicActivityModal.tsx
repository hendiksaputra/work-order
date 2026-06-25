'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  calculateWorkHours,
  lunchBreakRangeLabel,
  overlapsLunchBreak,
} from '@/lib/activity-hours';
import { api } from '@/lib/api';
import { TimePicker } from '@/components/ui/TimePicker';
import { ActivityTypeSearch } from '@/components/activities/ActivityTypeSearch';
import { MechanicActivityWoFields, resolveMainWoIdFromSub } from '@/components/activities/MechanicActivityWoFields';
import type { ActivityType, MechanicActivity, WorkOrder } from '@/lib/types';

function dateInputValue(value: string): string {
  return value.slice(0, 10);
}

function timeInputValue(value: string): string {
  return value.slice(0, 5);
}

type Props = {
  activity: MechanicActivity;
  types: ActivityType[];
  mainWoList: WorkOrder[];
  subWoList: WorkOrder[];
  onClose: () => void;
  onSaved: () => void;
};

export function EditMechanicActivityModal({
  activity,
  types,
  mainWoList,
  subWoList,
  onClose,
  onSaved,
}: Props) {
  const initialSubWoId = activity.work_order_id ? String(activity.work_order_id) : '';

  const [form, setForm] = useState({
    mode: activity.mode,
    main_work_order_id: resolveMainWoIdFromSub(subWoList, initialSubWoId),
    work_order_id: initialSubWoId,
    activity_type_id: String(activity.activity_type_id),
    activity_date: dateInputValue(activity.activity_date),
    start_time: timeInputValue(activity.start_time),
    end_time: timeInputValue(activity.end_time),
    notes: activity.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const subWoId = activity.work_order_id ? String(activity.work_order_id) : '';
    setForm({
      mode: activity.mode,
      main_work_order_id: resolveMainWoIdFromSub(subWoList, subWoId),
      work_order_id: subWoId,
      activity_type_id: String(activity.activity_type_id),
      activity_date: dateInputValue(activity.activity_date),
      start_time: timeInputValue(activity.start_time),
      end_time: timeInputValue(activity.end_time),
      notes: activity.notes || '',
    });
    setError('');
  }, [activity, subWoList]);

  const ic =
    'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200';
  const lunchRange = lunchBreakRangeLabel(form.activity_date);
  const workHours = calculateWorkHours(form.start_time, form.end_time, form.activity_date);
  const hasLunchBreak = overlapsLunchBreak(form.start_time, form.end_time, form.activity_date);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api(`/mechanic-activities/${activity.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          mode: form.mode,
          work_order_id: form.mode === 'working' ? Number(form.work_order_id) : null,
          activity_type_id: Number(form.activity_type_id),
          activity_date: form.activity_date,
          start_time: form.start_time,
          end_time: form.end_time,
          notes: form.notes || null,
        }),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan perubahan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-activity-title"
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 id="edit-activity-title" className="text-lg font-bold text-slate-900">
              Edit Aktivitas
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {activity.user?.name} · status {activity.status}
              {activity.status === 'approved' &&
                ' · perubahan jam/WO akan memperbarui ringkasan WO terkait'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Tutup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Mode</label>
                <select
                  className={ic}
                  value={form.mode}
                  onChange={(e) =>
                    setForm({ ...form, mode: e.target.value as 'working' | 'standby' })
                  }
                >
                  <option value="working">Working (Pilih Sub WO)</option>
                  <option value="standby">Stand by (Tanpa WO)</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Tanggal</label>
                <input
                  type="date"
                  className={ic}
                  value={form.activity_date}
                  onChange={(e) => setForm({ ...form, activity_date: e.target.value })}
                  required
                />
              </div>
              {form.mode === 'working' && (
                <MechanicActivityWoFields
                  mainList={mainWoList}
                  subList={subWoList}
                  mainWoId={form.main_work_order_id}
                  subWoId={form.work_order_id}
                  inputClassName={ic}
                  onMainChange={(mainId, subId) =>
                    setForm({ ...form, main_work_order_id: mainId, work_order_id: subId })
                  }
                  onSubChange={(subId) => setForm({ ...form, work_order_id: subId })}
                />
              )}
              <div className="col-span-2">
                <label className="text-sm font-medium text-slate-700">Aktivitas</label>
                <ActivityTypeSearch
                  types={types}
                  value={form.activity_type_id}
                  onChange={(activity_type_id) => setForm({ ...form, activity_type_id })}
                  wrapperClassName={ic}
                  required
                />
              </div>
              <TimePicker
                label="Jam Mulai"
                value={form.start_time}
                onChange={(start_time) => setForm({ ...form, start_time })}
                required
              />
              <TimePicker
                label="Jam Selesai"
                value={form.end_time}
                onChange={(end_time) => setForm({ ...form, end_time })}
                required
              />
              <div className="col-span-2">
                <label className="text-sm font-medium text-slate-700">Keterangan (opsional)</label>
                <input
                  className={ic}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
              <div className="col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <p>
                  Jam kerja tercatat:{' '}
                  <span className="font-semibold text-slate-800">{workHours} jam</span>
                </p>
                {hasLunchBreak && (
                  <p className="mt-1 text-amber-800">
                    Rentang melewati {lunchRange}: jam istirahat dikurangi otomatis dari total jam
                    kerja.
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-orange-600 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
            >
              {saving ? 'Menyimpan…' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
