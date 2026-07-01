import {
  endedDuringLunchWithoutResume,
  lunchBreakEnd,
  STANDARD_WORK_START,
  timeToMinutes,
} from '@/lib/activity-hours';

const STORAGE_PREFIX = 'wo_mechanic_login';
const SESSION_START_PREFIX = 'wo_mechanic_session_start';
const PENDING_AFTERNOON_PREFIX = 'wo_mechanic_pending_afternoon';
const AFTERNOON_START_PREFIX = 'wo_mechanic_afternoon_start';

/** HH:mm dari waktu lokal saat ini. */
export function formatLocalTime(date = new Date()): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function todayDateString(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function storageKey(userId: number, date: string): string {
  return `${STORAGE_PREFIX}_${userId}_${date}`;
}

function sessionStartKey(userId: number, date: string): string {
  return `${SESSION_START_PREFIX}_${userId}_${date}`;
}

function pendingAfternoonKey(userId: number, date: string): string {
  return `${PENDING_AFTERNOON_PREFIX}_${userId}_${date}`;
}

function afternoonStartKey(userId: number, date: string): string {
  return `${AFTERNOON_START_PREFIX}_${userId}_${date}`;
}

/** Catat jam login pertama kali pada hari tersebut (tidak menimpa jika sudah ada). */
export function recordMechanicDayLoginTime(userId: number, at = new Date()): string {
  if (typeof window === 'undefined') return formatLocalTime(at);
  const date = todayDateString(at);
  const key = storageKey(userId, date);
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const time = formatLocalTime(at);
  localStorage.setItem(key, time);
  return time;
}

export function getMechanicDayLoginTime(userId: number, activityDate: string): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(storageKey(userId, activityDate));
}

export function getSessionStartTime(userId: number, activityDate: string): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(sessionStartKey(userId, activityDate));
}

export function setSessionStartTime(userId: number, activityDate: string, time: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(sessionStartKey(userId, activityDate), time);
}

export function clearSessionStartTime(userId: number, activityDate: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(sessionStartKey(userId, activityDate));
}

export function isPendingAfternoonResume(userId: number, activityDate: string): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(pendingAfternoonKey(userId, activityDate)) === '1';
}

export function setPendingAfternoonResume(userId: number, activityDate: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(pendingAfternoonKey(userId, activityDate), '1');
}

export function clearPendingAfternoonResume(userId: number, activityDate: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(pendingAfternoonKey(userId, activityDate));
}

export function getAfternoonStartTime(userId: number, activityDate: string): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(afternoonStartKey(userId, activityDate));
}

export function hasAfternoonSessionStarted(userId: number, activityDate: string): boolean {
  return getAfternoonStartTime(userId, activityDate) !== null;
}

/** Sesi siang aktif (istirahat selesai, belum disimpan ke storage). */
export function isAfternoonSessionLive(
  userId: number,
  activityDate: string,
  now = new Date()
): boolean {
  return (
    isPendingAfternoonResume(userId, activityDate) &&
    isLunchBreakEnded(activityDate, now)
  );
}

/** Mulai kerja siang — hanya persist ke storage saat simpan aktivitas. */
export function startAfternoonSession(userId: number, activityDate: string, at = new Date()): string {
  const actualStart = formatLocalTime(at);
  if (typeof window !== 'undefined') {
    localStorage.setItem(afternoonStartKey(userId, activityDate), actualStart);
    clearPendingAfternoonResume(userId, activityDate);
    setSessionStartTime(userId, activityDate, actualStart);
  }
  return actualStart;
}

export function clearAfternoonSessionState(userId: number, activityDate: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(pendingAfternoonKey(userId, activityDate));
  localStorage.removeItem(afternoonStartKey(userId, activityDate));
}

export function isLunchBreakEnded(activityDate: string, now = new Date()): boolean {
  return timeToMinutes(formatLocalTime(now)) >= timeToMinutes(lunchBreakEnd(activityDate));
}

export type AfternoonResumeState = {
  pending: boolean;
  waitingLunchEnd: boolean;
  canStart: boolean;
  started: boolean;
  scheduledLunchEnd: string;
  actualAfternoonStart: string | null;
};

export function getAfternoonResumeState(
  userId: number,
  activityDate: string,
  now = new Date()
): AfternoonResumeState {
  const scheduledLunchEnd = lunchBreakEnd(activityDate);
  const pending = isPendingAfternoonResume(userId, activityDate);
  const storedAfternoonStart = getAfternoonStartTime(userId, activityDate);
  const lunchEnded = isLunchBreakEnded(activityDate, now);
  const liveAfternoon = pending && lunchEnded;
  const started = storedAfternoonStart !== null || liveAfternoon;
  const actualAfternoonStart = storedAfternoonStart ?? (liveAfternoon ? formatLocalTime(now) : null);

  return {
    pending,
    waitingLunchEnd: pending && !lunchEnded,
    canStart: false,
    started,
    scheduledLunchEnd,
    actualAfternoonStart,
  };
}

/** Jam mulai efektif — null hanya saat menunggu istirahat; siang mengikuti jam real-time. */
export function resolveActivityStartTime(
  userId: number,
  activityDate: string,
  now = new Date()
): string | null {
  if (isAfternoonSessionLive(userId, activityDate, now)) {
    return null;
  }

  const storedAfternoonStart = getAfternoonStartTime(userId, activityDate);
  if (storedAfternoonStart) {
    return storedAfternoonStart;
  }

  if (isPendingAfternoonResume(userId, activityDate)) {
    return null;
  }

  const sessionStart = getSessionStartTime(userId, activityDate);
  if (sessionStart) {
    return sessionStart;
  }

  return STANDARD_WORK_START;
}

type ActivityForSync = {
  user_id: number;
  activity_date: string;
  start_time: string;
  end_time: string;
  activity_type?: { name?: string } | null;
};

function activityDateKey(activityDate: string): string {
  return String(activityDate).slice(0, 10);
}

function isIstirahatActivity(activity: ActivityForSync): boolean {
  return activity.activity_type?.name === 'Istirahat';
}

/** Sudah ada kerja siang (mulai >= akhir istirahat) di data hari ini. */
export function hasAfternoonWorkInActivities(
  activities: ActivityForSync[],
  userId: number,
  activityDate: string
): boolean {
  const lunchEndMins = timeToMinutes(lunchBreakEnd(activityDate));
  const dateKey = activityDateKey(activityDate);

  return activities.some((a) => {
    if (a.user_id !== userId || activityDateKey(a.activity_date) !== dateKey) {
      return false;
    }
    if (isIstirahatActivity(a)) {
      return false;
    }
    return timeToMinutes(a.start_time) >= lunchEndMins;
  });
}

/** Pagi + istirahat tercatat, belum ada kerja siang — lanjut otomatis setelah istirahat. */
export function inferNeedsAfternoonStart(
  activities: ActivityForSync[],
  userId: number,
  activityDate: string
): boolean {
  const dateKey = activityDateKey(activityDate);

  const mine = activities.filter(
    (a) => a.user_id === userId && activityDateKey(a.activity_date) === dateKey
  );
  if (mine.length === 0) {
    return false;
  }

  const hasLunchBreak = mine.some(isIstirahatActivity);
  const hasMorningStoppedForLunch = mine.some(
    (a) =>
      !isIstirahatActivity(a) &&
      endedDuringLunchWithoutResume(a.start_time, a.end_time, activityDate)
  );

  return (hasLunchBreak || hasMorningStoppedForLunch) && !hasAfternoonWorkInActivities(activities, userId, activityDate);
}

/** Sinkronkan localStorage dari aktivitas server (refresh halaman / setelah simpan). */
export function syncAfternoonResumeFromActivities(
  activities: ActivityForSync[],
  userId: number,
  activityDate: string
): void {
  if (typeof window === 'undefined') {
    return;
  }

  const lunchEndMins = timeToMinutes(lunchBreakEnd(activityDate));
  const dateKey = activityDateKey(activityDate);
  const mine = activities.filter(
    (a) => a.user_id === userId && activityDateKey(a.activity_date) === dateKey
  );

  const afternoonWork = mine
    .filter((a) => !isIstirahatActivity(a) && timeToMinutes(a.start_time) >= lunchEndMins)
    .sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));

  if (afternoonWork.length > 0) {
    const start = afternoonWork[0].start_time.slice(0, 5);
    localStorage.setItem(afternoonStartKey(userId, activityDate), start);
    clearPendingAfternoonResume(userId, activityDate);
    setSessionStartTime(userId, activityDate, afternoonWork[afternoonWork.length - 1].end_time.slice(0, 5));
    return;
  }

  if (inferNeedsAfternoonStart(activities, userId, activityDate)) {
    localStorage.removeItem(afternoonStartKey(userId, activityDate));
    setPendingAfternoonResume(userId, activityDate);
    clearSessionStartTime(userId, activityDate);
  }
}

export function afterActivitySaved(
  userId: number,
  activityDate: string,
  startTime: string,
  endTime: string
): void {
  const lunchEnd = lunchBreakEnd(activityDate);
  const startMins = timeToMinutes(startTime);
  const endMins = timeToMinutes(endTime);
  const lunchEndMins = timeToMinutes(lunchEnd);

  // Berhenti saat istirahat — tunggu istirahat selesai, lalu auto-resume siang
  if (endedDuringLunchWithoutResume(startTime, endTime, activityDate)) {
    clearSessionStartTime(userId, activityDate);
    localStorage.removeItem(afternoonStartKey(userId, activityDate));
    setPendingAfternoonResume(userId, activityDate);
    return;
  }

  // Sesi siang sah (setelah auto-resume atau lanjutan)
  if (startMins >= lunchEndMins) {
    clearPendingAfternoonResume(userId, activityDate);
    setSessionStartTime(userId, activityDate, endTime);
    return;
  }

  // Satu simpan melewati istirahat sampai sore (pagi + istirahat + siang otomatis)
  if (endMins > lunchEndMins) {
    clearPendingAfternoonResume(userId, activityDate);
    localStorage.removeItem(afternoonStartKey(userId, activityDate));
    setSessionStartTime(userId, activityDate, endTime);
    return;
  }

  setSessionStartTime(userId, activityDate, endTime);
}

export function ensureEndAfterStart(startTime: string, endTime: string): string {
  const startMins = timeToMinutes(startTime);
  const endMins = timeToMinutes(endTime);
  if (endMins > startMins) return endTime;
  const next = startMins + 1;
  const h = Math.floor(next / 60) % 24;
  const m = next % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
