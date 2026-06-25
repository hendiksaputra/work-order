'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AfternoonStartPanel } from '@/components/activities/AfternoonStartPanel';
import { MechanicAutoTimeFields } from '@/components/activities/MechanicAutoTimeFields';
import { OvertimeRequestPanel } from '@/components/activities/OvertimeRequestPanel';
import Link from 'next/link';
import { Pencil, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { ConfirmAlert } from '@/components/ui/ConfirmAlert';
import { FlashMessage } from '@/components/ui/FlashMessage';
import {
  afternoonStartDelayMinutes,
  formatAfternoonStartLabel,
  endedDuringLunchWithoutResume,
  isAfternoonOnlySession,
  exceedsStandardWorkEnd,
  lunchBreakRangeLabel,
  overlapsLunchBreak,
  overlapsOvertime,
  STANDARD_WORK_END,
} from '@/lib/activity-hours';
import {
  afterActivitySaved,
  ensureEndAfterStart,
  formatLocalTime,
  getAfternoonResumeState,
  getMechanicDayLoginTime,
  hasAfternoonSessionStarted,
  inferNeedsAfternoonStart,
  isAfternoonSessionLive,
  recordMechanicDayLoginTime,
  resolveActivityStartTime,
  syncAfternoonResumeFromActivities,
  todayDateString,
} from '@/lib/mechanic-day-session';
import { EditMechanicActivityModal } from '@/components/activities/EditMechanicActivityModal';
import { ActivityTypeSearch } from '@/components/activities/ActivityTypeSearch';
import { MechanicActivityWoFields } from '@/components/activities/MechanicActivityWoFields';
import type {
  ActivityType,
  MechanicActivity,
  OvertimeRequestStatus,
  Paginated,
  WorkOrder,
} from '@/lib/types';
import { useAuth } from '@/lib/auth-context';
import { Permission } from '@/lib/permissions';
import {
  canDeleteMechanicActivity,
  canEditMechanicActivity,
  canSubmitMechanicActivity,
} from '@/lib/mechanic-activity-access';

export default function ActivitiesPage() {
  const { user, can } = useAuth();
  const canCreate = can(Permission.MECHANIC_ACTIVITIES_CREATE);
  const canSubmit = can(Permission.MECHANIC_ACTIVITIES_SUBMIT);
  const canApprove = can(Permission.MECHANIC_ACTIVITIES_APPROVE);
  const canUpdate = can(Permission.MECHANIC_ACTIVITIES_UPDATE);
  const canEditAny = can(Permission.MECHANIC_ACTIVITIES_EDIT_ANY_STATUS);
  const canDelete = can(Permission.MECHANIC_ACTIVITIES_DELETE);
  const canDeleteAny = can(Permission.MECHANIC_ACTIVITIES_DELETE_ANY_STATUS);
  const canEditForm = canCreate || canEditAny || canUpdate;
  const [activities, setActivities] = useState<Paginated<MechanicActivity> | null>(null);
  const [loadError, setLoadError] = useState('');
  const [types, setTypes] = useState<ActivityType[]>([]);
  const [mainWoList, setMainWoList] = useState<WorkOrder[]>([]);
  const [subWoList, setSubWoList] = useState<WorkOrder[]>([]);
  const [editingActivity, setEditingActivity] = useState<MechanicActivity | null>(null);
  const [form, setForm] = useState({
    mode: 'working' as 'working' | 'standby',
    main_work_order_id: '',
    work_order_id: '',
    activity_type_id: '',
    activity_date: todayDateString(),
    start_time: '08:00',
    end_time: '',
    notes: '',
  });
  const [endTimePreview, setEndTimePreview] = useState('');
  const [endTimeStopped, setEndTimeStopped] = useState(false);
  const [formFlash, setFormFlash] = useState<{ variant: 'success' | 'error'; message: string } | null>(
    null
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitConfirmActivity, setSubmitConfirmActivity] = useState<MechanicActivity | null>(null);
  const [submittingApproval, setSubmittingApproval] = useState(false);
  const [sessionTick, setSessionTick] = useState(0);
  const [overtimeStatus, setOvertimeStatus] = useState<OvertimeRequestStatus | null>(null);
  const [draftCount, setDraftCount] = useState(0);
  const [listFilter, setListFilter] = useState({ main_work_order_id: '', work_order_id: '' });

  const loadDraftCount = useCallback(() => {
    if (!canSubmit) {
      setDraftCount(0);
      return Promise.resolve();
    }
    return api<{ count: number }>('/mechanic-activities/draft-count')
      .then((res) => setDraftCount(res.count))
      .catch(() => setDraftCount(0));
  }, [canSubmit]);

  const notifyDraftCountChanged = () => {
    window.dispatchEvent(new Event('activities-draft-count-changed'));
  };

  const afternoonResume = useMemo(() => {
    if (!canCreate || !user) {
      return null;
    }
    return getAfternoonResumeState(user.id, form.activity_date);
  }, [canCreate, user, form.activity_date, sessionTick]);

  const needsAfternoonStartButton =
    Boolean(user) &&
    inferNeedsAfternoonStart(activities?.data ?? [], user!.id, form.activity_date) &&
    !hasAfternoonSessionStarted(user!.id, form.activity_date) &&
    !isAfternoonSessionLive(user!.id, form.activity_date);

  const blockedUntilAfternoonStart = Boolean(afternoonResume?.waitingLunchEnd);

  const loadOvertimeStatus = useCallback(() => {
    if (!canCreate) return Promise.resolve();
    const params = new URLSearchParams({ activity_date: form.activity_date });
    return api<OvertimeRequestStatus>(`/overtime-requests/status?${params}`)
      .then(setOvertimeStatus)
      .catch(() => setOvertimeStatus(null));
  }, [canCreate, form.activity_date]);

  const needsOvertimeApproval =
    endTimeStopped &&
    Boolean(form.start_time) &&
    (overlapsOvertime(form.start_time, endTimePreview) ||
      exceedsStandardWorkEnd(endTimePreview));

  const blockedByOvertime =
    needsOvertimeApproval &&
    overtimeStatus !== null &&
    !overtimeStatus.has_approved;

  const load = useCallback(() => {
    setLoadError('');
    const params = new URLSearchParams();
    if (listFilter.work_order_id) {
      params.set('work_order_id', listFilter.work_order_id);
    }
    const qs = params.toString();
    return api<Paginated<MechanicActivity>>(`/mechanic-activities${qs ? `?${qs}` : ''}`)
      .then(setActivities)
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : 'Gagal memuat aktivitas');
        setActivities(null);
      });
  }, [listFilter.work_order_id]);

  useEffect(() => {
    load();
    loadDraftCount();
    api<ActivityType[]>('/activity-types')
      .then(setTypes)
      .catch(console.error);
    Promise.all([
      api<WorkOrder[]>('/work-orders/main-list?for_activity=1'),
      api<WorkOrder[]>('/work-orders/sub-list?for_activity=1'),
    ])
      .then(([mains, subs]) => {
        setMainWoList(mains);
        setSubWoList(subs);
      })
      .catch(console.error);
  }, [load]);

  useEffect(() => {
    loadOvertimeStatus();
  }, [loadOvertimeStatus, sessionTick]);

  useEffect(() => {
    if (!user || !canCreate || !activities?.data) {
      return;
    }
    syncAfternoonResumeFromActivities(activities.data, user.id, form.activity_date);
    setSessionTick((t) => t + 1);
  }, [activities, user, canCreate, form.activity_date]);

  useEffect(() => {
    if (!canCreate) return;
    const id = window.setInterval(() => setSessionTick((t) => t + 1), 1_000);
    return () => window.clearInterval(id);
  }, [canCreate]);

  useEffect(() => {
    if (!canCreate || !user) return;
    if (form.activity_date === todayDateString()) {
      recordMechanicDayLoginTime(user.id);
    }

    const now = new Date();
    const loginTime = getMechanicDayLoginTime(user.id, form.activity_date);
    const isToday = form.activity_date === todayDateString();
    const liveAfternoon = isAfternoonSessionLive(user.id, form.activity_date, now);
    const nowTime = formatLocalTime(now);

    if (liveAfternoon && !endTimeStopped && isToday) {
      setForm((prev) => {
        if (prev.start_time && isAfternoonOnlySession(prev.start_time, form.activity_date)) {
          return prev;
        }
        return { ...prev, start_time: nowTime };
      });
      return;
    }

    const resolved = resolveActivityStartTime(user.id, form.activity_date, loginTime, now);
    const start_time = resolved ?? '';
    setForm((prev) => (prev.start_time === start_time ? prev : { ...prev, start_time }));
  }, [canCreate, user, form.activity_date, sessionTick, endTimeStopped]);

  const resetWorkStopState = () => {
    setEndTimeStopped(false);
    setEndTimePreview('');
  };

  const handleStopWork = () => {
    const stoppedAt = formatLocalTime();
    setEndTimePreview(stoppedAt);
    setEndTimeStopped(true);
    setForm((prev) => ({ ...prev, end_time: stoppedAt }));
  };

  const validateActivityForm = (): string | null => {
    if (blockedUntilAfternoonStart) {
      return `Istirahat belum selesai (hingga ${afternoonResume?.scheduledLunchEnd}). Jam mulai siang akan berjalan otomatis setelah waktu tersebut.`;
    }

    if (!form.start_time) {
      return 'Jam mulai belum tersedia — tunggu istirahat selesai atau muat ulang halaman.';
    }
    if (!endTimeStopped || !endTimePreview) {
      return 'Tekan tombol Stop terlebih dahulu untuk mencatat jam selesai, lalu simpan aktivitas.';
    }

    const end_time = ensureEndAfterStart(form.start_time, endTimePreview);

    if (!form.activity_type_id) {
      return 'Pilih aktivitas dari daftar pencarian (klik salah satu hasil).';
    }
    if (form.mode === 'working') {
      if (!form.main_work_order_id) return 'Pilih Main WO terlebih dahulu.';
      if (!form.work_order_id) return 'Pilih Sub WO.';
    }
    if (!types.some((t) => String(t.id) === form.activity_type_id)) {
      return 'Aktivitas tidak valid. Pilih ulang dari daftar.';
    }
    if (exceedsStandardWorkEnd(end_time)) {
      if (!overtimeStatus?.has_approved) {
        if (overtimeStatus?.has_pending) {
          return `Pengajuan lembur menunggu persetujuan supervisor. Jam kerja normal berakhir ${STANDARD_WORK_END}.`;
        }
        return `Jam kerja melewati ${STANDARD_WORK_END}. Ajukan lembur ke supervisor terlebih dahulu.`;
      }
      if (
        overtimeStatus.approved_until &&
        end_time > overtimeStatus.approved_until
      ) {
        return `Jam selesai melebihi lembur yang disetujui (hingga ${overtimeStatus.approved_until}).`;
      }
    }
    return null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormFlash(null);
    const validationError = validateActivityForm();
    if (validationError) {
      setFormFlash({ variant: 'error', message: validationError });
      return;
    }
    setSubmitting(true);
    try {
      const end_time = ensureEndAfterStart(form.start_time, endTimePreview);
      const stoppedAtLunch = endedDuringLunchWithoutResume(
        form.start_time,
        end_time,
        form.activity_date
      );
      const includesLunchBreak = overlapsLunchBreak(form.start_time, end_time, form.activity_date);
      const afternoonSession = isAfternoonOnlySession(form.start_time, form.activity_date);
      await api('/mechanic-activities', {
        method: 'POST',
        body: JSON.stringify({
          mode: form.mode,
          activity_date: form.activity_date,
          start_time: form.start_time,
          end_time,
          notes: form.notes || null,
          work_order_id: form.mode === 'working' ? Number(form.work_order_id) : null,
          activity_type_id: Number(form.activity_type_id),
        }),
      });
      if (user) {
        afterActivitySaved(user.id, form.activity_date, form.start_time, end_time);
      }
      const nextResolved = user
        ? resolveActivityStartTime(
            user.id,
            form.activity_date,
            getMechanicDayLoginTime(user.id, form.activity_date)
          )
        : form.start_time;
      setForm({
        ...form,
        notes: '',
        start_time: nextResolved ?? '',
        end_time: '',
      });
      resetWorkStopState();
      await load();

      let successMessage = 'Aktivitas disimpan. Ajukan approval dari daftar jika perlu.';
      if (stoppedAtLunch) {
        setSessionTick((t) => t + 1);
        successMessage = `Sesi pagi + istirahat ${lunchBreakRangeLabel(form.activity_date)} tercatat. Jam mulai siang akan berjalan otomatis setelah istirahat selesai.`;
      } else if (afternoonSession) {
        const delay = afternoonStartDelayMinutes(form.start_time, form.activity_date);
        successMessage =
          delay > 0
            ? `Aktivitas siang disimpan. Mulai aktual ${form.start_time} (+${delay} menit dari jadwal istirahat).`
            : `Aktivitas siang disimpan. Mulai aktual ${form.start_time} (tepat setelah istirahat).`;
      } else if (includesLunchBreak) {
        successMessage = `Aktivitas disimpan (pagi + istirahat + siang). Jam istirahat ${lunchBreakRangeLabel(form.activity_date)} dipisah otomatis.`;
      }

      setFormFlash({ variant: 'success', message: successMessage });
      notifyDraftCountChanged();
      await loadDraftCount();
    } catch (err) {
      setFormFlash({
        variant: 'error',
        message: err instanceof Error ? err.message : 'Gagal menyimpan aktivitas.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const requestSubmitApproval = (activity: MechanicActivity) => {
    setSubmitConfirmActivity(activity);
  };

  const confirmSubmitApproval = async () => {
    if (!submitConfirmActivity) return;
    setSubmittingApproval(true);
    try {
      await api(`/mechanic-activities/${submitConfirmActivity.id}/submit`, { method: 'POST' });
      setSubmitConfirmActivity(null);
      await load();
      window.dispatchEvent(new Event('activities-pending-count-changed'));
      notifyDraftCountChanged();
      await loadDraftCount();
      setFormFlash({
        variant: 'success',
        message: `Aktivitas "${submitConfirmActivity.activity_type?.name ?? '—'}" berhasil diajukan ke supervisor.`,
      });
    } catch (err) {
      setFormFlash({
        variant: 'error',
        message: err instanceof Error ? err.message : 'Gagal mengajukan aktivitas.',
      });
    } finally {
      setSubmittingApproval(false);
    }
  };

  const approveActivity = async (id: number, action: 'approve' | 'reject') => {
    if (!confirm(action === 'approve' ? 'Setujui aktivitas ini?' : 'Tolak aktivitas ini?')) return;
    try {
      await api(`/mechanic-activities/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      load();
      window.dispatchEvent(new Event('activities-pending-count-changed'));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal memproses aktivitas');
    }
  };

  const removeActivity = async (activity: MechanicActivity) => {
    const warn =
      activity.status !== 'draft' && activity.status !== 'rejected'
        ? `\n\nStatus: ${activity.status}. Aktivitas yang sudah disetujui akan dihapus permanen dan ringkasan WO diperbarui.`
        : '';
    if (!confirm(`Hapus aktivitas #${activity.id}?${warn}`)) return;
    try {
      await api(`/mechanic-activities/${activity.id}`, { method: 'DELETE' });
      await load();
      notifyDraftCountChanged();
      await loadDraftCount();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal menghapus aktivitas');
    }
  };

  const ic = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm';
  const selectedSubWo = subWoList.find((w) => String(w.id) === listFilter.work_order_id);
  const selectedMainWo = mainWoList.find((w) => String(w.id) === listFilter.main_work_order_id);
  const showingTeamActivities = Boolean(listFilter.work_order_id);

  return (
    <div className="p-8">
      <PageHeader
        title="Mechanic Activity"
        subtitle={
          canCreate
            ? `Jam kerja normal hingga ${STANDARD_WORK_END} · lembur wajib diajukan ke supervisor`
            : canApprove
              ? 'Supervisor: lihat semua aktivitas mekanik. Persetujuan pending ada di menu Inspection atau tombol di bawah.'
              : 'Daftar aktivitas mekanik'
        }
      />

      {canApprove && !canCreate && (
        <p className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Untuk approve aktivitas yang menunggu, buka juga{' '}
          <Link href="/inspection" className="font-semibold underline">
            Inspection → Mechanic Activity
          </Link>
          .
        </p>
      )}

      {canSubmit && draftCount > 0 && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Anda memiliki{' '}
          <strong>
            {draftCount} aktivitas draft
          </strong>{' '}
          yang belum diajukan ke supervisor. Buka daftar di bawah lalu tekan{' '}
          <strong>Ajukan</strong> pada setiap aktivitas yang sudah benar.
        </p>
      )}

      {formFlash && (
        <FlashMessage
          variant={formFlash.variant}
          message={formFlash.message}
          onDismiss={() => setFormFlash(null)}
        />
      )}

      {loadError && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}. Coba logout lalu login ulang sebagai Supervisor.
        </p>
      )}

      {canCreate && (
        <div className="mb-10 flex justify-center">
          <form
            noValidate
            onSubmit={submit}
            className="w-full max-w-2xl space-y-4 rounded-xl border bg-white p-6 shadow-sm"
          >
            <h3 className="text-center text-lg font-semibold text-slate-900">Input Aktivitas Baru</h3>
            {types.length === 0 && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Daftar aktivitas belum dimuat. Refresh halaman atau login ulang.
              </p>
            )}
            {form.mode === 'working' && mainWoList.length === 0 && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Belum ada Main WO / Sub WO yang disetujui supervisor. Minta supervisor menyetujui WO
                terlebih dahulu.
              </p>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Mode</label>
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
                <label className="text-sm font-medium">Tanggal</label>
                <input
                  type="date"
                  className={ic}
                  value={form.activity_date}
                  onChange={(e) => setForm({ ...form, activity_date: e.target.value })}
                />
              </div>
              {form.mode === 'working' && (
                <MechanicActivityWoFields
                  mainList={mainWoList}
                  subList={subWoList}
                  mainWoId={form.main_work_order_id}
                  subWoId={form.work_order_id}
                  inputClassName={ic}
                  onMainChange={(mainId, subId) => {
                    setForm({ ...form, main_work_order_id: mainId, work_order_id: subId });
                    setListFilter({ main_work_order_id: mainId, work_order_id: subId });
                  }}
                  onSubChange={(subId) => {
                    setForm({ ...form, work_order_id: subId });
                    setListFilter((prev) => ({ ...prev, work_order_id: subId }));
                  }}
                />
              )}
              {afternoonResume && (
                <AfternoonStartPanel
                  state={afternoonResume}
                  activityDate={form.activity_date}
                  needsStart={needsAfternoonStartButton}
                />
              )}
              {needsOvertimeApproval && overtimeStatus && (
                <OvertimeRequestPanel
                  status={overtimeStatus}
                  activityDate={form.activity_date}
                  workOrderId={form.work_order_id}
                  suggestedEndTime={endTimePreview}
                  onSubmitted={() => {
                    loadOvertimeStatus();
                    window.dispatchEvent(new Event('overtime-pending-count-changed'));
                  }}
                />
              )}
              <div className="col-span-2">
                <label className="text-sm font-medium">Aktivitas</label>
                <ActivityTypeSearch
                  types={types}
                  value={form.activity_type_id}
                  onChange={(activity_type_id) => setForm({ ...form, activity_type_id })}
                  wrapperClassName={ic}
                />
              </div>
              <MechanicAutoTimeFields
                startTime={form.start_time}
                endTime={endTimePreview}
                endTimeStopped={endTimeStopped}
                activityDate={form.activity_date}
                afternoonResume={afternoonResume}
                onStop={handleStopWork}
              />
              <div className="col-span-2">
                <label className="text-sm font-medium">Keterangan (opsional)</label>
                <input
                  className={ic}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-center pt-2">
              <button
                type="submit"
                disabled={
                  submitting ||
                  types.length === 0 ||
                  Boolean(blockedUntilAfternoonStart) ||
                  Boolean(blockedByOvertime) ||
                  !endTimeStopped
                }
                className="rounded-lg bg-orange-600 px-8 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
              >
                {submitting ? 'Menyimpan…' : 'Simpan Aktivitas'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="mb-4 space-y-3">
        <h3 className="font-semibold">Daftar Aktivitas</h3>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="mb-3 text-sm text-slate-600">
            Pilih Main WO dan Sub WO untuk melihat aktivitas{' '}
            <span className="font-medium text-slate-800">semua mekanik</span> pada pekerjaan yang
            sama. Tanpa filter Sub WO, yang tampil hanya aktivitas Anda sendiri.
          </p>
          <div className="grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
            <MechanicActivityWoFields
              mainList={mainWoList}
              subList={subWoList}
              mainWoId={listFilter.main_work_order_id}
              subWoId={listFilter.work_order_id}
              inputClassName={ic}
              onMainChange={(mainId, subId) =>
                setListFilter({ main_work_order_id: mainId, work_order_id: subId })
              }
              onSubChange={(subId) =>
                setListFilter((prev) => ({ ...prev, work_order_id: subId }))
              }
            />
          </div>
          {showingTeamActivities && selectedSubWo && (
            <p className="mt-3 text-sm text-blue-800">
              Menampilkan aktivitas tim pada{' '}
              <span className="font-semibold">
                {selectedMainWo?.wo_number ?? 'Main WO'} → {selectedSubWo.wo_number}
              </span>
            </p>
          )}
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3">Tanggal</th>
              <th className="px-4 py-3">Mekanik</th>
              <th className="px-4 py-3">WO</th>
              <th className="px-4 py-3">Aktivitas</th>
              <th className="px-4 py-3">Jam</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {!activities?.data.length ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                  {loadError ? 'Gagal memuat data' : 'Belum ada aktivitas'}
                </td>
              </tr>
            ) : (
              activities.data.map((a) => {
                const canEdit = canEditMechanicActivity(a, user, canUpdate, canEditAny);
                const canDel = canDeleteMechanicActivity(a, user, canDelete, canDeleteAny);
                const canSubmitRow = canSubmitMechanicActivity(
                  a,
                  user,
                  can(Permission.MECHANIC_ACTIVITIES_SUBMIT)
                );
                const canApproveRow = a.status === 'pending_approval' && canApprove;
                const hasActions = canEdit || canDel || canSubmitRow || canApproveRow;
                const activityDate = String(a.activity_date).slice(0, 10);
                const afternoonLabel =
                  a.activity_type?.name !== 'Istirahat'
                    ? formatAfternoonStartLabel(a.start_time?.slice(0, 5) ?? '', activityDate)
                    : null;
                const afternoonDelay =
                  afternoonLabel && a.start_time
                    ? afternoonStartDelayMinutes(a.start_time.slice(0, 5), activityDate)
                    : 0;
                const isOvertimeRow = a.notes?.includes('Lembur (disetujui supervisor)');

                return (
                  <tr key={a.id} className="border-t">
                    <td className="px-4 py-3">{String(a.activity_date).slice(0, 10)}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-800">{a.user?.name ?? '—'}</span>
                      {user && a.user_id === user.id && (
                        <span className="ml-2 rounded bg-orange-100 px-1.5 py-0.5 text-xs font-medium text-orange-700">
                          Anda
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {a.work_order?.wo_number || '—'}
                    </td>
                    <td className="px-4 py-3">{a.activity_type?.name}</td>
                    <td className="px-4 py-3">
                      <div>
                        {a.total_hours}h ({a.start_time?.slice(0, 5)}-{a.end_time?.slice(0, 5)})
                      </div>
                      {afternoonLabel && (
                        <p className="mt-0.5 text-xs text-slate-500">{afternoonLabel}</p>
                      )}
                      {afternoonDelay > 0 && (
                        <span className="mt-0.5 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                          Terlambat +{afternoonDelay} mnt
                        </span>
                      )}
                      {isOvertimeRow && (
                        <span className="mt-0.5 inline-block rounded bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-800">
                          Lembur
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge status={a.status} />
                    </td>
                    <td className="px-4 py-3">
                      {hasActions ? (
                        <div className="flex justify-end gap-1">
                          {canSubmitRow && (
                            <button
                              type="button"
                              onClick={() => requestSubmitApproval(a)}
                              className="rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                            >
                              Ajukan
                            </button>
                          )}
                          {canApproveRow && (
                            <>
                              <button
                                type="button"
                                onClick={() => approveActivity(a.id, 'approve')}
                                className="rounded px-2 py-1 text-xs font-medium text-green-600 hover:bg-green-50"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => approveActivity(a.id, 'reject')}
                                className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => setEditingActivity(a)}
                              className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
                              title="Edit aktivitas"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          {canDel && (
                            <button
                              type="button"
                              onClick={() => removeActivity(a)}
                              className="rounded p-1.5 text-red-500 hover:bg-red-50"
                              title="Hapus aktivitas"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="block text-right text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {editingActivity && (
        <EditMechanicActivityModal
          activity={editingActivity}
          types={types}
          mainWoList={mainWoList}
          subWoList={subWoList}
          onClose={() => setEditingActivity(null)}
          onSaved={load}
        />
      )}

      <ConfirmAlert
        open={submitConfirmActivity !== null}
        title="Ajukan aktivitas ke supervisor?"
        message={
          submitConfirmActivity
            ? `${submitConfirmActivity.activity_type?.name ?? 'Aktivitas'}\n${
                submitConfirmActivity.work_order?.wo_number
                  ? `WO: ${submitConfirmActivity.work_order.wo_number}`
                  : 'Stand by (tanpa WO)'
              }\n${String(submitConfirmActivity.activity_date).slice(0, 10)} · ${submitConfirmActivity.total_hours}h (${submitConfirmActivity.start_time?.slice(0, 5)}–${submitConfirmActivity.end_time?.slice(0, 5)})\n\nStatus akan berubah menjadi menunggu persetujuan supervisor.`
            : ''
        }
        confirmLabel="Ya, Ajukan"
        cancelLabel="Batal"
        variant="question"
        loading={submittingApproval}
        onConfirm={confirmSubmitApproval}
        onCancel={() => !submittingApproval && setSubmitConfirmActivity(null)}
      />
    </div>
  );
}
