export const LUNCH_BREAK_START = '12:00';
export const LUNCH_BREAK_END_WEEKDAY = '13:00';
export const LUNCH_BREAK_END_FRIDAY = '13:30';
export const STANDARD_WORK_END = '18:00';

export type ActivitySegment = { type: 'work' | 'break'; start: string; end: string };

export function timeToMinutes(time: string): number {
  const [h, m] = time.slice(0, 5).split(':').map(Number);
  return h * 60 + m;
}

export function isFridayActivityDate(activityDate: string): boolean {
  return new Date(`${activityDate}T12:00:00`).getDay() === 5;
}

export function lunchBreakEnd(activityDate?: string): string {
  if (activityDate && isFridayActivityDate(activityDate)) {
    return LUNCH_BREAK_END_FRIDAY;
  }
  return LUNCH_BREAK_END_WEEKDAY;
}

export function lunchBreakRangeLabel(activityDate?: string): string {
  return `${LUNCH_BREAK_START}–${lunchBreakEnd(activityDate)}`;
}

/** Normalisasi end ke timeline setelah start; jam sama = durasi nol (bukan shift malam). */
function normalizeEndMinutes(startMins: number, endMins: number): number {
  if (endMins < startMins) {
    return endMins + 24 * 60;
  }
  return endMins;
}

/** Sesi pagi berakhir saat istirahat tanpa lanjut kerja siang. */
export function endedDuringLunchWithoutResume(
  start: string,
  end: string,
  activityDate?: string
): boolean {
  const startMins = timeToMinutes(start);
  const endMins = normalizeEndMinutes(startMins, timeToMinutes(end));

  const lunchStart = timeToMinutes(LUNCH_BREAK_START);
  const lunchEnd = timeToMinutes(lunchBreakEnd(activityDate));

  return startMins < lunchStart && endMins >= lunchStart && endMins <= lunchEnd;
}

export function isAfternoonOnlySession(start: string, activityDate?: string): boolean {
  return timeToMinutes(start) >= timeToMinutes(lunchBreakEnd(activityDate));
}

/** Menit keterlambatan mulai siang vs jadwal akhir istirahat (0 = tepat waktu). */
export function afternoonStartDelayMinutes(start: string, activityDate?: string): number {
  if (!isAfternoonOnlySession(start, activityDate)) {
    return 0;
  }
  return Math.max(0, timeToMinutes(start) - timeToMinutes(lunchBreakEnd(activityDate)));
}

export function formatAfternoonStartLabel(start: string, activityDate?: string): string | null {
  if (!isAfternoonOnlySession(start, activityDate)) {
    return null;
  }
  const scheduled = lunchBreakEnd(activityDate);
  const delay = afternoonStartDelayMinutes(start, activityDate);
  if (delay === 0) {
    return `Mulai siang ${start} (tepat setelah istirahat ${scheduled})`;
  }
  return `Mulai siang ${start} (jadwal ${scheduled}, +${delay} menit)`;
}

/** Mirror backend WorkshopSchedule::splitAroundLunchBreak */
export function splitActivitySegments(
  start: string,
  end: string,
  activityDate?: string
): ActivitySegment[] {
  const startMins = timeToMinutes(start);
  const endMins = normalizeEndMinutes(startMins, timeToMinutes(end));

  const lunchStart = timeToMinutes(LUNCH_BREAK_START);
  const lunchEnd = timeToMinutes(lunchBreakEnd(activityDate));
  const lunchEndTime = lunchBreakEnd(activityDate);

  if (endMins < lunchStart) {
    return [{ type: 'work', start, end }];
  }

  if (startMins >= lunchEnd) {
    return [{ type: 'work', start, end }];
  }

  if (endedDuringLunchWithoutResume(start, end, activityDate)) {
    return [
      { type: 'work', start, end: LUNCH_BREAK_START },
      { type: 'break', start: LUNCH_BREAK_START, end: lunchEndTime },
    ];
  }

  const segments: ActivitySegment[] = [];

  if (startMins < lunchStart) {
    const segEnd = Math.min(endMins, lunchStart);
    if (segEnd > startMins) {
      segments.push({
        type: 'work',
        start,
        end: minutesToTime(segEnd),
      });
    }
  }

  const overlapStart = Math.max(startMins, lunchStart);
  const overlapEnd = Math.min(endMins, lunchEnd);
  if (overlapEnd > overlapStart) {
    segments.push({
      type: 'break',
      start: minutesToTime(overlapStart),
      end: minutesToTime(overlapEnd),
    });
  }

  if (endMins > lunchEnd) {
    const segStart = Math.max(startMins, lunchEnd);
    if (endMins > segStart) {
      segments.push({
        type: 'work',
        start: minutesToTime(segStart),
        end: minutesToTime(endMins),
      });
    }
  }

  if (segments.length === 0) {
    return [{ type: 'work', start, end }];
  }

  return segments;
}

function minutesToTime(minutes: number): string {
  const normalized = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function segmentDurationMinutes(segment: ActivitySegment): number {
  const startMins = timeToMinutes(segment.start);
  const endMins = normalizeEndMinutes(startMins, timeToMinutes(segment.end));
  return Math.max(0, endMins - startMins);
}

export function lunchOverlapMinutes(start: string, end: string, activityDate?: string): number {
  return splitActivitySegments(start, end, activityDate)
    .filter((s) => s.type === 'break')
    .reduce((sum, s) => sum + segmentDurationMinutes(s), 0);
}

export function calculateWorkHours(start: string, end: string, activityDate?: string): number {
  const workMinutes = splitActivitySegments(start, end, activityDate)
    .filter((s) => s.type === 'work')
    .reduce((sum, s) => sum + segmentDurationMinutes(s), 0);

  return Math.round((workMinutes / 60) * 100) / 100;
}

export function overlapsLunchBreak(start: string, end: string, activityDate?: string): boolean {
  return splitActivitySegments(start, end, activityDate).some((s) => s.type === 'break');
}

export function exceedsStandardWorkEnd(end: string): boolean {
  return timeToMinutes(end) > timeToMinutes(STANDARD_WORK_END);
}

export function overlapsOvertime(start: string, end: string): boolean {
  const startMins = timeToMinutes(start);
  const endMins = normalizeEndMinutes(startMins, timeToMinutes(end));
  return endMins > timeToMinutes(STANDARD_WORK_END);
}

export function overtimeMinutes(start: string, end: string): number {
  const startMins = timeToMinutes(start);
  const endMins = normalizeEndMinutes(startMins, timeToMinutes(end));
  if (endMins <= timeToMinutes(STANDARD_WORK_END)) {
    return 0;
  }
  const otStart = Math.max(startMins, timeToMinutes(STANDARD_WORK_END));
  return Math.max(0, endMins - otStart);
}
