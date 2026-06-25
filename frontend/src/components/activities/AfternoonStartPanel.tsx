'use client';

import { afternoonStartDelayMinutes, lunchBreakRangeLabel } from '@/lib/activity-hours';
import type { AfternoonResumeState } from '@/lib/mechanic-day-session';
import { formatLocalTime } from '@/lib/mechanic-day-session';

export function AfternoonStartPanel({
  state,
  activityDate,
  needsStart,
}: {
  state: AfternoonResumeState;
  activityDate: string;
  needsStart?: boolean;
}) {
  const showPanel = state.pending || state.started || needsStart;
  if (!showPanel) {
    return null;
  }

  const lunchRange = lunchBreakRangeLabel(activityDate);

  if (state.waitingLunchEnd) {
    return (
      <div className="col-span-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <p className="font-semibold">Istirahat {lunchRange}</p>
        <p className="mt-1">
          Sesi pagi sudah tercatat. Jam mulai siang akan berjalan otomatis mengikuti waktu
          sebenarnya setelah pukul <strong>{state.scheduledLunchEnd}</strong>.
        </p>
      </div>
    );
  }

  if (state.started && state.actualAfternoonStart) {
    const delayMins = afternoonStartDelayMinutes(state.actualAfternoonStart, activityDate);

    return (
      <div className="col-span-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
        <p className="font-semibold">Sesi siang aktif — mulai pukul {state.actualAfternoonStart}</p>
        <p className="mt-1">
          Dimulai otomatis setelah istirahat ({state.scheduledLunchEnd})
          {delayMins > 0 ? (
            <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
              +{delayMins} menit dari jadwal
            </span>
          ) : (
            <span className="ml-2 text-green-700">(tepat setelah istirahat)</span>
          )}
          <span className="ml-2 text-green-700">· jam berjalan {formatLocalTime()}</span>
        </p>
      </div>
    );
  }

  if (needsStart && !state.started) {
    return (
      <div className="col-span-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
        <p className="font-semibold">Menunggu lanjutan kerja siang</p>
        <p className="mt-1">
          Istirahat selesai pukul <strong>{state.scheduledLunchEnd}</strong>. Jam mulai akan
          tercatat otomatis mengikuti waktu sebenarnya.
        </p>
      </div>
    );
  }

  return null;
}
