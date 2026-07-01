'use client';

import { useEffect, useState } from 'react';
import { Play, Square } from 'lucide-react';
import {
  afternoonStartDelayMinutes,
  calculateWorkHours,
  endedDuringLunchWithoutResume,
  isAfternoonOnlySession,
  isFridayActivityDate,
  exceedsStandardWorkEnd,
  lunchBreakRangeLabel,
  overlapsLunchBreak,
  overlapsOvertime,
  overtimeMinutes,
  STANDARD_WORK_END,
  STANDARD_WORK_START,
} from '@/lib/activity-hours';
import type { AfternoonResumeState } from '@/lib/mechanic-day-session';
import { formatLocalTime, todayDateString } from '@/lib/mechanic-day-session';

function TimeDisplay({ value, placeholder = '--:--' }: { value: string; placeholder?: string }) {
  const display = value && /^\d{2}:\d{2}$/.test(value) ? value : placeholder;
  const [hour, minute] = display.includes(':') ? display.split(':') : ['--', '--'];

  return (
    <div className="mt-1 flex items-center gap-2">
      <div className="flex min-w-[4.5rem] flex-1 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800">
        {hour}
      </div>
      <span className="text-lg font-semibold text-slate-400">:</span>
      <div className="flex min-w-[4.5rem] flex-1 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800">
        {minute}
      </div>
    </div>
  );
}

export function MechanicAutoTimeFields({
  startTime,
  plannedStartTime,
  startTimeStarted,
  endTime,
  endTimeStopped,
  activityDate,
  afternoonResume,
  onStart,
  onStop,
}: {
  startTime: string;
  plannedStartTime: string;
  startTimeStarted: boolean;
  endTime: string;
  endTimeStopped: boolean;
  activityDate: string;
  afternoonResume?: AfternoonResumeState | null;
  onStart: () => void;
  onStop: () => void;
}) {
  const [nowClock, setNowClock] = useState(() => formatLocalTime());

  useEffect(() => {
    const id = window.setInterval(() => setNowClock(formatLocalTime()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const lunchRange = lunchBreakRangeLabel(activityDate);
  const afternoonSession = isAfternoonOnlySession(startTime, activityDate);
  const willStopAtLunch =
    endTimeStopped && endedDuringLunchWithoutResume(startTime, endTime, activityDate);
  const hasLunchBreak =
    endTimeStopped && overlapsLunchBreak(startTime, endTime, activityDate);
  const workHours = endTimeStopped
    ? calculateWorkHours(startTime, endTime, activityDate)
    : 0;
  const hasOvertime = endTimeStopped && overlapsOvertime(startTime, endTime);
  const otMins = endTimeStopped ? overtimeMinutes(startTime, endTime) : 0;
  const afternoonDelay =
    afternoonSession && startTime
      ? afternoonStartDelayMinutes(startTime, activityDate)
      : 0;
  const waitingLunch = afternoonResume?.waitingLunchEnd;
  const isToday = activityDate === todayDateString();
  const afternoonLive =
    afternoonSession || Boolean(afternoonResume?.started && !afternoonResume?.waitingLunchEnd);

  if (waitingLunch || (!startTime && !isToday)) {
    return (
      <div className="col-span-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">
        Istirahat berlangsung — jam mulai siang akan berjalan otomatis setelah{' '}
        <strong>{afternoonResume?.scheduledLunchEnd ?? 'istirahat selesai'}</strong>.
      </div>
    );
  }

  return (
    <>
      <div>
        <label className="text-sm font-medium text-slate-700">Jam Mulai</label>
        <TimeDisplay value={startTimeStarted ? startTime : ''} />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onStart}
            disabled={startTimeStarted}
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            Start
          </button>
          {startTimeStarted && (
            <span className="text-xs text-slate-500">
              Sesi aktif sejak <strong className="text-slate-700">{startTime}</strong>
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {!startTimeStarted ? (
            plannedStartTime === STANDARD_WORK_START ? (
              <>Tekan <strong>Start</strong> untuk memulai sesi pagi (default pukul {STANDARD_WORK_START})</>
            ) : (
              <>Tekan <strong>Start</strong> untuk memulai sesi (rencana pukul {plannedStartTime})</>
            )
          ) : afternoonLive ? (
            <>
              Sesi siang — mulai pukul {startTime}
              {afternoonDelay > 0 && (
                <span className="text-amber-700"> (+{afternoonDelay} menit dari jadwal istirahat)</span>
              )}
            </>
          ) : startTime === STANDARD_WORK_START ? (
            <>Sesi pagi dimulai pukul {STANDARD_WORK_START}</>
          ) : (
            <>Sesi pagi — lanjutan dari aktivitas sebelumnya ({startTime})</>
          )}
        </p>
      </div>
      <div>
        <label className="text-sm font-medium text-slate-700">Jam Selesai</label>
        <TimeDisplay value={endTime} />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onStop}
            disabled={!startTimeStarted}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
            Stop
          </button>
          {startTimeStarted && (
            <span className="text-xs text-slate-500">
              Jam berjalan: <strong className="text-slate-700">{nowClock}</strong>
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {!startTimeStarted ? (
            'Tekan Start terlebih dahulu sebelum Stop'
          ) : endTimeStopped ? (
            `Berhenti pukul ${endTime} — tekan Stop lagi jika perlu perbarui, lalu Simpan Aktivitas`
          ) : (
            `Tekan Stop saat selesai bekerja (maks. ${STANDARD_WORK_END} tanpa lembur)`
          )}
        </p>
        {endTimeStopped && exceedsStandardWorkEnd(endTime) && (
          <p className="mt-1 text-xs font-medium text-red-700">
            Melewati {STANDARD_WORK_END} — wajib ajukan lembur sebelum simpan
          </p>
        )}
      </div>
      <div className="col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        {!startTimeStarted ? (
          <p>
            Tekan <strong>Start</strong> untuk memulai sesi kerja, lalu <strong>Stop</strong> saat
            selesai, dan <strong>Simpan Aktivitas</strong>. Jam istirahat ({lunchRange}) dipisah
            otomatis saat simpan.
          </p>
        ) : !endTimeStopped ? (
          <p>
            Sesi kerja aktif. Tekan <strong>Stop</strong> untuk mencatat jam selesai, lalu{' '}
            <strong>Simpan Aktivitas</strong>. Jam istirahat ({lunchRange}) tetap dipisah otomatis
            saat simpan.
          </p>
        ) : (
          <>
            <p>
              Estimasi jam kerja: <span className="font-semibold text-slate-800">{workHours} jam</span>
              {hasOvertime && (
                <span className="ml-2 text-purple-800">
                  (termasuk lembur ~{(otMins / 60).toFixed(1)} jam jika disetujui supervisor)
                </span>
              )}
            </p>
            {willStopAtLunch ? (
              <p className="mt-1 text-amber-800">
                Simpan = sesi pagi berakhir + istirahat penuh {lunchRange} tercatat otomatis. Lanjut
                setelah istirahat dengan aktivitas baru.
              </p>
            ) : afternoonSession ? (
              <p className="mt-1 text-green-800">
                Sesi siang aktif — jam kerja dihitung normal (setelah istirahat).
              </p>
            ) : hasLunchBreak ? (
              <p className="mt-1 text-amber-800">
                Rentang melewati {lunchRange}: pagi + istirahat + siang dipisah otomatis (aktivitas{' '}
                <span className="font-medium">Istirahat</span> non-produktif di antaranya).
              </p>
            ) : (
              <p className="mt-1">
                Istirahat ({lunchRange}) otomatis jika berhenti saat jam istirahat
                {isFridayActivityDate(activityDate) ? ' (Jumat: istirahat lebih panjang)' : ''}.
              </p>
            )}
          </>
        )}
      </div>
    </>
  );
}
