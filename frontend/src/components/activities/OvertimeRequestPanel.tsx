'use client';

import { useState } from 'react';
import { Clock } from 'lucide-react';
import { api } from '@/lib/api';
import { STANDARD_WORK_END } from '@/lib/activity-hours';
import { formatLocalTime } from '@/lib/mechanic-day-session';
import type { OvertimeRequestStatus } from '@/lib/types';

export function OvertimeRequestPanel({
  status,
  activityDate,
  workOrderId,
  suggestedEndTime,
  onSubmitted,
}: {
  status: OvertimeRequestStatus;
  activityDate: string;
  workOrderId: string;
  suggestedEndTime: string;
  onSubmitted: () => void;
}) {
  const [reason, setReason] = useState('');
  const [overtimeEnd, setOvertimeEnd] = useState(
    exceedsSuggested(suggestedEndTime) ? suggestedEndTime : formatLocalTime()
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (status.has_approved) {
    return (
      <div className="col-span-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
        <p className="font-semibold">Lembur disetujui supervisor</p>
        <p className="mt-1">
          Anda boleh bekerja hingga pukul <strong>{status.approved_until}</strong> (jam normal berakhir{' '}
          {STANDARD_WORK_END}).
        </p>
        {status.approved?.reason && (
          <p className="mt-1 text-xs text-green-800">Alasan: {status.approved.reason}</p>
        )}
      </div>
    );
  }

  if (status.has_pending) {
    return (
      <div className="col-span-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-semibold">Pengajuan lembur menunggu supervisor</p>
        <p className="mt-1">
          Rencana selesai: <strong>{status.pending?.overtime_end?.slice(0, 5)}</strong> —{' '}
          {status.pending?.reason}
        </p>
        <p className="mt-1 text-xs">Anda belum dapat menyimpan aktivitas melewati jam {STANDARD_WORK_END}.</p>
      </div>
    );
  }

  return (
    <div className="col-span-2 rounded-lg border-2 border-red-200 bg-red-50 px-4 py-4">
      <div className="flex items-start gap-2">
        <Clock className="mt-0.5 h-5 w-5 shrink-0 text-red-700" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-red-900">
            Jam kerja normal berakhir pukul {STANDARD_WORK_END}
          </p>
          <p className="mt-1 text-sm text-red-800">
            Untuk melanjutkan pekerjaan setelah {STANDARD_WORK_END}, ajukan lembur ke supervisor
            terlebih dahulu.
          </p>
          {error && (
            <p className="mt-2 rounded border border-red-300 bg-white px-2 py-1 text-xs text-red-700">
              {error}
            </p>
          )}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-red-900">
              Rencana selesai lembur
              <input
                type="time"
                value={overtimeEnd}
                min={STANDARD_WORK_END}
                onChange={(e) => setOvertimeEnd(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-red-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm text-red-900 sm:col-span-2">
              Alasan lembur
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="Contoh: menyelesaikan perakitan Sub WO sebelum shift logistic"
                className="mt-1 block w-full rounded-lg border border-red-200 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <button
            type="button"
            disabled={submitting || reason.trim().length < 5}
            onClick={async () => {
              setSubmitting(true);
              setError('');
              try {
                await api('/overtime-requests', {
                  method: 'POST',
                  body: JSON.stringify({
                    activity_date: activityDate,
                    work_order_id: workOrderId ? Number(workOrderId) : null,
                    overtime_end: overtimeEnd,
                    reason: reason.trim(),
                  }),
                });
                setReason('');
                onSubmitted();
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Gagal mengajukan lembur');
              } finally {
                setSubmitting(false);
              }
            }}
            className="mt-3 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"
          >
            {submitting ? 'Mengajukan…' : 'Ajukan Lembur ke Supervisor'}
          </button>
        </div>
      </div>
    </div>
  );
}

function exceedsSuggested(time: string): boolean {
  const [h, m] = time.split(':').map(Number);
  const [eh, em] = STANDARD_WORK_END.split(':').map(Number);
  return h * 60 + m > eh * 60 + em;
}
