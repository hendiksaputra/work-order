'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AfternoonStartPanel } from '@/components/activities/AfternoonStartPanel';
import { MechanicAutoTimeFields } from '@/components/activities/MechanicAutoTimeFields';
import { OvertimeRequestPanel } from '@/components/activities/OvertimeRequestPanel';
import Link from 'next/link';
import { Pencil, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Pagination } from '@/components/ui/Pagination';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { ConfirmAlert } from '@/components/ui/ConfirmAlert';
import { RejectReasonDialog } from '@/components/ui/RejectReasonDialog';
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
  STANDARD_WORK_START,
} from '@/lib/activity-hours';
import {
  afterActivitySaved,
  ensureEndAfterStart,
  formatLocalTime,
  getAfternoonResumeState,
  hasAfternoonSessionStarted,
  inferNeedsAfternoonStart,
  isAfternoonSessionLive,
  resolveActivityStartTime,
  syncAfternoonResumeFromActivities,
  todayDateString,
} from '@/lib/mechanic-day-session';
import { EditMechanicActivityModal } from '@/components/activities/EditMechanicActivityModal';
import { ActivityTypeSearch } from '@/components/activities/ActivityTypeSearch';
import { MechanicActivityWoFields, filterSubWorkOrdersByMain } from '@/components/activities/MechanicActivityWoFields';
import { MechanicActivitySubmissionTable } from '@/components/activities/MechanicActivitySubmissionTable';
import { SubWoHourBudgetWarning } from '@/components/activities/SubWoHourBudgetWarning';
import type {
  ActivityType,
  MechanicActivity,
  MechanicActivitySubmission,
  OvertimeRequestStatus,
  Paginated,
  WorkOrder,
} from '@/lib/types';
import { useAuth } from '@/lib/auth-context';
import { Permission } from '@/lib/permissions';
import {
  canDeleteMechanicActivity,
  canEditMechanicActivity,
} from '@/lib/mechanic-activity-access';
import { formatDecimalHours } from '@/lib/utils';
import {
  buildSubWoHourBudget,
  computeNewActivityWorkHours,
} from '@/lib/sub-wo-hour-budget';

type ActivityListFilter = {
  main_work_order_id: string;
  work_order_id: string;
  user_id: string;
  mechanic_search: string;
  date_from: string;
  date_to: string;
};

type MechanicFilterOption = {
  id: number;
  name: string;
  employee_id?: string;
  department?: string;
};

const emptySupervisorFilters = {
  user_id: '',
  mechanic_search: '',
  date_from: '',
  date_to: '',
};

type RejectTarget =
  | { type: 'submission'; submission: MechanicActivitySubmission }
  | { type: 'activity'; activity: MechanicActivity };

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
  const canViewAllActivities = can(Permission.MECHANIC_ACTIVITIES_VIEW_ALL);
  const seesAllDepartments = user?.role === 'admin' || user?.role === 'planner';
  const [activities, setActivities] = useState<Paginated<MechanicActivity> | null>(null);
  const [submissions, setSubmissions] = useState<Paginated<MechanicActivitySubmission> | null>(null);
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
    start_time: STANDARD_WORK_START,
    end_time: '',
    notes: '',
  });
  const [endTimePreview, setEndTimePreview] = useState('');
  const [startTimeStarted, setStartTimeStarted] = useState(false);
  const [endTimeStopped, setEndTimeStopped] = useState(false);
  const [formFlash, setFormFlash] = useState<{ variant: 'success' | 'error'; message: string } | null>(
    null
  );
  const [submitting, setSubmitting] = useState(false);
  const [bulkSubmitConfirmOpen, setBulkSubmitConfirmOpen] = useState(false);
  const [bulkApproveConfirmOpen, setBulkApproveConfirmOpen] = useState(false);
  const [submittingApproval, setSubmittingApproval] = useState(false);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [rejectDialog, setRejectDialog] = useState<{
    target: RejectTarget;
    title: string;
    message: string;
  } | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [sessionTick, setSessionTick] = useState(0);
  const [overtimeStatus, setOvertimeStatus] = useState<OvertimeRequestStatus | null>(null);
  const [draftCount, setDraftCount] = useState(0);
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
  const [mechanicOptions, setMechanicOptions] = useState<MechanicFilterOption[]>([]);
  const [listFilter, setListFilter] = useState<ActivityListFilter>({
    main_work_order_id: '',
    work_order_id: '',
    ...emptySupervisorFilters,
  });
  const [supervisorFilterDraft, setSupervisorFilterDraft] = useState(emptySupervisorFilters);
  const [listPage, setListPage] = useState(1);
  const [listPerPage, setListPerPage] = useState(20);
  const [todayActivities, setTodayActivities] = useState<MechanicActivity[]>([]);
  const listPageRef = useRef(listPage);
  const listFilterRef = useRef(listFilter);
  const loadSeqRef = useRef(0);
  listPageRef.current = listPage;
  listFilterRef.current = listFilter;

  const loadDraftCount = useCallback(() => {
    if (!canSubmit) {
      setDraftCount(0);
      return Promise.resolve();
    }
    return api<{ count: number }>('/mechanic-activities/draft-count')
      .then((res) => setDraftCount(res.count))
      .catch(() => setDraftCount(0));
  }, [canSubmit]);

  const loadPendingApprovalCount = useCallback(() => {
    if (!canApprove) {
      setPendingApprovalCount(0);
      return Promise.resolve();
    }

    const params = new URLSearchParams();
    if (listFilterRef.current.work_order_id) {
      params.set('work_order_id', listFilterRef.current.work_order_id);
    }

    const query = params.toString();
    return api<{ count: number }>(
      `/mechanic-activities/pending-approval-count${query ? `?${query}` : ''}`
    )
      .then((res) => setPendingApprovalCount(res.count))
      .catch(() => setPendingApprovalCount(0));
  }, [canApprove]);

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
    inferNeedsAfternoonStart(todayActivities, user!.id, form.activity_date) &&
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

  const formSubWo = useMemo(
    () => subWoList.find((wo) => String(wo.id) === form.work_order_id),
    [subWoList, form.work_order_id]
  );

  const newActivityWorkHours = useMemo(
    () =>
      computeNewActivityWorkHours(
        form.start_time,
        endTimePreview,
        form.activity_date,
        endTimeStopped
      ),
    [form.start_time, endTimePreview, form.activity_date, endTimeStopped]
  );

  const subWoHourBudget = useMemo(() => {
    if (form.mode !== 'working' || !form.work_order_id) {
      return null;
    }
    return buildSubWoHourBudget(formSubWo, newActivityWorkHours);
  }, [form.mode, form.work_order_id, formSubWo, newActivityWorkHours]);

  const loadSubWoList = useCallback(() => {
    return api<WorkOrder[]>('/work-orders/sub-list?for_activity=1')
      .then(setSubWoList)
      .catch(() => setSubWoList([]));
  }, []);

  const loadTodayActivities = useCallback(() => {
    if (!canCreate || !user) {
      setTodayActivities([]);
      return Promise.resolve();
    }
    const params = new URLSearchParams({
      activity_date: form.activity_date,
      per_page: '100',
    });
    return api<Paginated<MechanicActivity>>(`/mechanic-activities?${params}`)
      .then((res) => {
        setTodayActivities(res.data);
        syncAfternoonResumeFromActivities(res.data, user.id, form.activity_date);
        setSessionTick((t) => t + 1);
      })
      .catch(() => setTodayActivities([]));
  }, [canCreate, user, form.activity_date]);

  const load = useCallback((targetPage: number): Promise<void> => {
    const seq = ++loadSeqRef.current;
    setLoadError('');
    const { main_work_order_id, work_order_id, user_id, mechanic_search, date_from, date_to } =
      listFilterRef.current;

    const emptyActivities = (): Paginated<MechanicActivity> => ({
      data: [],
      current_page: 1,
      last_page: 1,
      total: 0,
      per_page: listPerPage,
    });

    if (canViewAllActivities) {
      const params = new URLSearchParams();
      params.set('page', String(targetPage));
      params.set('per_page', String(listPerPage));
      if (work_order_id) {
        params.set('work_order_id', work_order_id);
      }
      if (user_id) {
        params.set('user_id', user_id);
      } else if (mechanic_search.trim()) {
        params.set('search', mechanic_search.trim());
      }
      if (date_from) {
        params.set('date_from', date_from);
      }
      if (date_to) {
        params.set('date_to', date_to);
      }

      return api<Paginated<MechanicActivitySubmission>>(`/mechanic-activity-submissions?${params}`)
        .then((result) => {
          if (seq !== loadSeqRef.current) return;
          if (result.data.length === 0 && targetPage > 1) {
            setListPage(targetPage - 1);
            return;
          }
          setSubmissions(result);
        })
        .catch((err) => {
          if (seq !== loadSeqRef.current) return;
          setLoadError(err instanceof Error ? err.message : 'Gagal memuat laporan harian');
          setSubmissions(null);
        });
    }

    if (main_work_order_id && !work_order_id) {
      setActivities(emptyActivities());
      return Promise.resolve();
    }

    if (main_work_order_id && work_order_id) {
      const subs = filterSubWorkOrdersByMain(subWoList, main_work_order_id);
      if (!subs.some((w) => String(w.id) === work_order_id)) {
        setActivities(emptyActivities());
        return Promise.resolve();
      }
    }

    const params = new URLSearchParams();
    params.set('page', String(targetPage));
    params.set('per_page', String(listPerPage));
    if (work_order_id) {
      params.set('work_order_id', work_order_id);
    }

    return api<Paginated<MechanicActivity>>(`/mechanic-activities?${params}`)
      .then((result) => {
        if (seq !== loadSeqRef.current) return;
        if (result.data.length === 0 && targetPage > 1) {
          setListPage(targetPage - 1);
          return;
        }
        setActivities(result);
      })
      .catch((err) => {
        if (seq !== loadSeqRef.current) return;
        setLoadError(err instanceof Error ? err.message : 'Gagal memuat aktivitas');
        setActivities(null);
      });
  }, [listPerPage, subWoList, canViewAllActivities]);

  const reloadList = useCallback(() => {
    return load(listPageRef.current);
  }, [load]);

  const refreshActivities = useCallback(() => {
    return Promise.all([
      reloadList(),
      loadTodayActivities(),
      loadDraftCount(),
      loadPendingApprovalCount(),
      loadSubWoList(),
    ]);
  }, [reloadList, loadTodayActivities, loadDraftCount, loadPendingApprovalCount, loadSubWoList]);

  const applyListFilter = (
    next: Partial<Pick<ActivityListFilter, 'main_work_order_id' | 'work_order_id'>>
  ) => {
    setActivities(null);
    setSubmissions(null);
    setListPage(1);
    setListFilter((prev) => ({ ...prev, ...next }));
  };

  const applySupervisorFilters = () => {
    setActivities(null);
    setSubmissions(null);
    setListPage(1);
    setListFilter((prev) => ({ ...prev, ...supervisorFilterDraft }));
  };

  const resetSupervisorFilters = () => {
    setSupervisorFilterDraft(emptySupervisorFilters);
    setActivities(null);
    setSubmissions(null);
    setListPage(1);
    setListFilter((prev) => ({ ...prev, ...emptySupervisorFilters }));
  };

  const hasSupervisorFilters =
    Boolean(listFilter.user_id) ||
    Boolean(listFilter.mechanic_search.trim()) ||
    Boolean(listFilter.date_from) ||
    Boolean(listFilter.date_to);

  useEffect(() => {
    load(listPage);
  }, [
    load,
    listPage,
    listFilter.main_work_order_id,
    listFilter.work_order_id,
    listFilter.user_id,
    listFilter.mechanic_search,
    listFilter.date_from,
    listFilter.date_to,
  ]);

  useEffect(() => {
    loadPendingApprovalCount();
  }, [loadPendingApprovalCount, listFilter.work_order_id]);

  useEffect(() => {
    loadDraftCount();
    api<ActivityType[]>('/activity-types')
      .then(setTypes)
      .catch(console.error);
    Promise.all([
      api<WorkOrder[]>('/work-orders/main-list?for_activity=1'),
      api<WorkOrder[]>('/work-orders/sub-list?for_activity=1'),
      canViewAllActivities
        ? api<MechanicFilterOption[]>('/mechanic-activities/filter-mechanics')
        : Promise.resolve([]),
    ])
      .then(([mains, subs, mechanics]) => {
        setMainWoList(mains);
        setSubWoList(subs);
        setMechanicOptions(mechanics);
      })
      .catch(console.error);
  }, [loadDraftCount, canViewAllActivities]);

  useEffect(() => {
    loadTodayActivities();
  }, [loadTodayActivities]);

  useEffect(() => {
    loadOvertimeStatus();
  }, [loadOvertimeStatus, sessionTick]);

  useEffect(() => {
    if (!canCreate) return;
    const id = window.setInterval(() => setSessionTick((t) => t + 1), 1_000);
    return () => window.clearInterval(id);
  }, [canCreate]);

  useEffect(() => {
    if (!canCreate || !user) return;

    const now = new Date();
    const isToday = form.activity_date === todayDateString();
    const liveAfternoon = isAfternoonSessionLive(user.id, form.activity_date, now);
    const nowTime = formatLocalTime(now);

    if (liveAfternoon && !endTimeStopped && isToday && !startTimeStarted) {
      setForm((prev) => ({ ...prev, start_time: nowTime }));
      setStartTimeStarted(true);
      return;
    }

    if (startTimeStarted) {
      return;
    }

    const resolved = resolveActivityStartTime(user.id, form.activity_date, now);
    const start_time = resolved ?? STANDARD_WORK_START;
    setForm((prev) => (prev.start_time === start_time ? prev : { ...prev, start_time }));
  }, [canCreate, user, form.activity_date, sessionTick, endTimeStopped, startTimeStarted]);

  useEffect(() => {
    setStartTimeStarted(false);
    setEndTimeStopped(false);
    setEndTimePreview('');
  }, [form.activity_date]);

  const resetWorkStopState = () => {
    setEndTimeStopped(false);
    setEndTimePreview('');
  };

  const resetWorkSessionState = () => {
    setStartTimeStarted(false);
    resetWorkStopState();
  };

  const handleStartWork = () => {
    if (!user) return;
    const now = new Date();
    const resolved = resolveActivityStartTime(user.id, form.activity_date, now);
    const start_time = resolved ?? STANDARD_WORK_START;
    setForm((prev) => ({ ...prev, start_time, end_time: '' }));
    setStartTimeStarted(true);
    resetWorkStopState();
  };

  const handleStopWork = () => {
    if (!startTimeStarted) return;
    const stoppedAt = formatLocalTime();
    setEndTimePreview(stoppedAt);
    setEndTimeStopped(true);
    setForm((prev) => ({ ...prev, end_time: stoppedAt }));
  };

  const validateActivityForm = (): string | null => {
    if (blockedUntilAfternoonStart) {
      return `Istirahat belum selesai (hingga ${afternoonResume?.scheduledLunchEnd}). Jam mulai siang akan berjalan otomatis setelah waktu tersebut.`;
    }

    if (!startTimeStarted) {
      return 'Tekan tombol Start terlebih dahulu untuk memulai sesi kerja.';
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
        ? resolveActivityStartTime(user.id, form.activity_date)
        : form.start_time;
      setForm({
        ...form,
        notes: '',
        start_time: nextResolved ?? '',
        end_time: '',
      });
      resetWorkSessionState();
      await refreshActivities();

      let successMessage = 'Aktivitas disimpan. Tekan Ajukan Semua Draft jika sudah siap diajukan ke supervisor.';
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

  const confirmBulkSubmit = async () => {
    setSubmittingApproval(true);
    try {
      const res = await api<{ message: string; submitted_days?: number; submitted_activities?: number }>(
        '/mechanic-activities/bulk-submit',
        {
          method: 'POST',
          body: JSON.stringify({}),
        }
      );
      setBulkSubmitConfirmOpen(false);
      await refreshActivities();
      notifyDraftCountChanged();
      await loadDraftCount();
      window.dispatchEvent(new Event('activities-pending-count-changed'));
      setFormFlash({
        variant: 'success',
        message: res.message,
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

  const confirmBulkApprove = async () => {
    setBulkApproving(true);
    try {
      const body: { action: 'approve'; work_order_id?: number; user_id?: number } = { action: 'approve' };
      if (listFilter.work_order_id) {
        body.work_order_id = Number(listFilter.work_order_id);
      }
      if (listFilter.user_id) {
        body.user_id = Number(listFilter.user_id);
      }

      const res = await api<{ message: string; processed: number }>(
        '/mechanic-activity-submissions/bulk-approve',
        {
          method: 'POST',
          body: JSON.stringify(body),
        }
      );
      setBulkApproveConfirmOpen(false);
      await refreshActivities();
      window.dispatchEvent(new Event('activities-pending-count-changed'));
      setFormFlash({
        variant: 'success',
        message: res.message,
      });
    } catch (err) {
      setFormFlash({
        variant: 'error',
        message: err instanceof Error ? err.message : 'Gagal menyetujui aktivitas.',
      });
    } finally {
      setBulkApproving(false);
    }
  };

  const approveSubmission = async (
    submission: MechanicActivitySubmission,
    action: 'approve' | 'reject'
  ) => {
    const tanggal = String(submission.activity_date).slice(0, 10);
    if (action === 'reject') {
      setRejectDialog({
        target: { type: 'submission', submission },
        title: 'Tolak laporan harian?',
        message: `Semua aktivitas pending ${submission.user?.name ?? 'mekanik'} pada ${tanggal} akan ditolak. Mekanik dapat memperbaiki dan mengajukan ulang.`,
      });
      return;
    }
    if (!confirm(`Setujui semua aktivitas ${submission.user?.name ?? 'mekanik'} pada ${tanggal}?`)) {
      return;
    }
    try {
      await api(`/mechanic-activity-submissions/${submission.id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      await refreshActivities();
      window.dispatchEvent(new Event('activities-pending-count-changed'));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal menyetujui laporan harian');
    }
  };

  const approveActivity = async (
    activity: MechanicActivity,
    action: 'approve' | 'reject'
  ) => {
    const label = activity.activity_type?.name ?? 'aktivitas ini';
    if (action === 'reject') {
      setRejectDialog({
        target: { type: 'activity', activity },
        title: 'Tolak aktivitas?',
        message: `Aktivitas "${label}" akan ditolak. Mekanik dapat memperbaiki dan mengajukan ulang.`,
      });
      return;
    }
    if (!confirm(`Setujui aktivitas "${label}"?`)) {
      return;
    }
    try {
      await api(`/mechanic-activities/${activity.id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      await refreshActivities();
      window.dispatchEvent(new Event('activities-pending-count-changed'));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal memproses aktivitas');
    }
  };

  const confirmReject = async (notes: string) => {
    if (!rejectDialog) return;
    setRejecting(true);
    try {
      if (rejectDialog.target.type === 'submission') {
        const { submission } = rejectDialog.target;
        await api(`/mechanic-activity-submissions/${submission.id}/approve`, {
          method: 'POST',
          body: JSON.stringify({ action: 'reject', notes }),
        });
      } else {
        const { activity } = rejectDialog.target;
        await api(`/mechanic-activities/${activity.id}/approve`, {
          method: 'POST',
          body: JSON.stringify({ action: 'reject', notes }),
        });
      }
      setRejectDialog(null);
      await refreshActivities();
      window.dispatchEvent(new Event('activities-pending-count-changed'));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal menolak');
    } finally {
      setRejecting(false);
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
      await refreshActivities();
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
  const listNeedsSubWo = Boolean(listFilter.main_work_order_id && !listFilter.work_order_id);

  return (
    <div className="p-8">
      <PageHeader
        title="Mechanic Activity"
        subtitle={
          canCreate
            ? `Jam kerja normal hingga ${STANDARD_WORK_END} · lembur wajib diajukan ke supervisor`
            : canApprove
              ? 'Supervisor: setujui aktivitas sekaligus lewat Setujui Semua Pending, atau per baris di tabel.'
              : 'Daftar aktivitas mekanik'
        }
      />

      {canApprove && pendingApprovalCount > 0 && (
        <p className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          Ada{' '}
          <strong>{pendingApprovalCount} laporan harian menunggu persetujuan</strong>
          {listFilter.work_order_id && selectedSubWo ? (
            <>
              {' '}
              pada Sub WO <strong>{selectedSubWo.wo_number}</strong>
            </>
          ) : (
            ' pada lokasi Anda'
          )}
          . Tekan <strong>Setujui Semua Pending</strong> untuk menyetujui semua laporan harian
          sekaligus.
        </p>
      )}

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
          <strong>{draftCount} hari kerja</strong> dengan aktivitas draft yang belum diajukan ke
          supervisor. Tekan <strong>Ajukan Semua Draft</strong> untuk mengirim per hari (1 approval
          per hari).
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
            {!seesAllDepartments && form.mode === 'working' && (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                Sub WO ditampilkan untuk lokasi:{' '}
                <strong>{user?.department?.trim() || 'belum diatur'}</strong>. Admin dan Planner
                melihat semua lokasi.
              </p>
            )}
            {types.length === 0 && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Daftar aktivitas belum dimuat. Refresh halaman atau login ulang.
              </p>
            )}
            {form.mode === 'working' && mainWoList.length === 0 && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Belum ada Main WO / Sub WO yang disetujui supervisor
                {!seesAllDepartments && user?.department?.trim() ? (
                  <>
                    {' '}
                    untuk lokasi <strong>{user.department.trim()}</strong>
                  </>
                ) : null}
                . Pastikan Sub WO pada workshop Anda sudah disetujui supervisor (bukan hanya Main
                WO).
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
                    applyListFilter({ main_work_order_id: mainId, work_order_id: subId });
                  }}
                  onSubChange={(subId) => {
                    setForm({ ...form, work_order_id: subId });
                    applyListFilter({
                      main_work_order_id: form.main_work_order_id,
                      work_order_id: subId,
                    });
                  }}
                />
              )}
              {form.mode === 'working' && form.work_order_id && (
                <div className="col-span-2">
                  <SubWoHourBudgetWarning budget={subWoHourBudget} />
                </div>
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
                plannedStartTime={form.start_time || STANDARD_WORK_START}
                startTimeStarted={startTimeStarted}
                endTime={endTimePreview}
                endTimeStopped={endTimeStopped}
                activityDate={form.activity_date}
                afternoonResume={afternoonResume}
                onStart={handleStartWork}
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
                  !startTimeStarted ||
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold">{canViewAllActivities ? 'Laporan Harian Mekanik' : 'Daftar Aktivitas'}</h3>
          <div className="flex flex-wrap items-center gap-2">
            {canApprove && pendingApprovalCount > 0 && (
              <button
                type="button"
                onClick={() => setBulkApproveConfirmOpen(true)}
                disabled={bulkApproving}
                className="inline-flex items-center rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
              >
                {bulkApproving
                  ? 'Menyetujui…'
                  : `Setujui Semua Pending (${pendingApprovalCount})`}
              </button>
            )}
            {canSubmit && draftCount > 0 && (
              <button
                type="button"
                onClick={() => setBulkSubmitConfirmOpen(true)}
                disabled={submittingApproval}
                className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {submittingApproval ? 'Mengajukan…' : `Ajukan Semua Draft (${draftCount} hari)`}
              </button>
            )}
          </div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="mb-3 text-sm text-slate-600">
            {canViewAllActivities ? (
              <>
                Filter laporan harian per mekanik dan rentang tanggal. Satu baris = 1 mekanik pada 1
                hari. Buka <span className="font-medium text-slate-800">Detail</span> untuk melihat
                aktivitas per jam.
              </>
            ) : (
              <>
                Pilih Main WO dan Sub WO untuk melihat aktivitas{' '}
                <span className="font-medium text-slate-800">semua mekanik</span> pada pekerjaan yang
                sama. Tanpa filter Sub WO, yang tampil hanya aktivitas Anda sendiri.
              </>
            )}
          </p>
          {canViewAllActivities && (
            <div className="mb-4 grid max-w-4xl grid-cols-1 gap-4 border-b border-slate-100 pb-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Mekanik</label>
                <select
                  className={ic}
                  value={supervisorFilterDraft.user_id}
                  onChange={(e) =>
                    setSupervisorFilterDraft((prev) => ({
                      ...prev,
                      user_id: e.target.value,
                      mechanic_search: e.target.value ? '' : prev.mechanic_search,
                    }))
                  }
                >
                  <option value="">Semua Mekanik</option>
                  {mechanicOptions.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                      {m.employee_id ? ` (${m.employee_id})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Cari nama mekanik</label>
                <input
                  type="search"
                  className={ic}
                  placeholder="Nama, username, NIK…"
                  value={supervisorFilterDraft.mechanic_search}
                  disabled={Boolean(supervisorFilterDraft.user_id)}
                  onChange={(e) =>
                    setSupervisorFilterDraft((prev) => ({
                      ...prev,
                      mechanic_search: e.target.value,
                    }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      applySupervisorFilters();
                    }
                  }}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Dari tanggal</label>
                <input
                  type="date"
                  className={ic}
                  value={supervisorFilterDraft.date_from}
                  onChange={(e) =>
                    setSupervisorFilterDraft((prev) => ({ ...prev, date_from: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Sampai tanggal</label>
                <input
                  type="date"
                  className={ic}
                  value={supervisorFilterDraft.date_to}
                  min={supervisorFilterDraft.date_from || undefined}
                  onChange={(e) =>
                    setSupervisorFilterDraft((prev) => ({ ...prev, date_to: e.target.value }))
                  }
                />
              </div>
              <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-4">
                <button
                  type="button"
                  onClick={applySupervisorFilters}
                  className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900"
                >
                  Terapkan Filter
                </button>
                {hasSupervisorFilters && (
                  <button
                    type="button"
                    onClick={resetSupervisorFilters}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          )}
          <div className="grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
            <MechanicActivityWoFields
              mainList={mainWoList}
              subList={subWoList}
              mainWoId={listFilter.main_work_order_id}
              subWoId={listFilter.work_order_id}
              inputClassName={ic}
              onMainChange={(mainId, subId) =>
                applyListFilter({ main_work_order_id: mainId, work_order_id: subId })
              }
              onSubChange={(subId) =>
                applyListFilter({
                  main_work_order_id: listFilter.main_work_order_id,
                  work_order_id: subId,
                })
              }
            />
          </div>
          {listNeedsSubWo && (
            <p className="mt-3 text-sm text-amber-800">
              Main WO <span className="font-semibold">{selectedMainWo?.wo_number ?? '—'}</span>{' '}
              dipilih — pilih Sub WO untuk melihat aktivitas tim pada pekerjaan ini.
            </p>
          )}
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
      {canViewAllActivities ? (
        <MechanicActivitySubmissionTable
          data={submissions}
          loadError={loadError}
          listPerPage={listPerPage}
          canApprove={canApprove}
          onApprove={approveSubmission}
          onApproveActivity={approveActivity}
          onPageChange={setListPage}
          onPerPageChange={setListPerPage}
          subWoList={subWoList}
          emptyMessage={
            hasSupervisorFilters ? 'Tidak ada laporan harian sesuai filter' : 'Belum ada laporan harian'
          }
        />
      ) : (
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
                  {loadError
                    ? 'Gagal memuat data'
                    : !activities
                      ? 'Memuat...'
                      : listNeedsSubWo
                        ? 'Pilih Sub WO untuk melihat aktivitas tim'
                        : hasSupervisorFilters
                          ? 'Tidak ada aktivitas sesuai filter'
                          : 'Belum ada aktivitas'}
                </td>
              </tr>
            ) : (
              activities.data.map((a) => {
                const canEdit = canEditMechanicActivity(a, user, canUpdate, canEditAny);
                const canDel = canDeleteMechanicActivity(a, user, canDelete, canDeleteAny);
                const canApproveRow = a.status === 'pending_approval' && canApprove;
                const hasActions = canEdit || canDel || canApproveRow;
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
                        {formatDecimalHours(a.total_hours)} ({a.start_time?.slice(0, 5)}-{a.end_time?.slice(0, 5)})
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
                      {a.status === 'rejected' && a.supervisor_notes && (
                        <p className="mt-1 max-w-xs text-xs text-red-700">
                          Alasan: {a.supervisor_notes}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {hasActions ? (
                        <div className="flex justify-end gap-1">
                          {canApproveRow && (
                            <>
                              <button
                                type="button"
                                onClick={() => approveActivity(a, 'approve')}
                                className="rounded px-2 py-1 text-xs font-medium text-green-600 hover:bg-green-50"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => approveActivity(a, 'reject')}
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

        {activities && activities.total > 0 && (
          <Pagination
            page={activities.current_page}
            lastPage={activities.last_page}
            total={activities.total}
            perPage={listPerPage}
            onPageChange={setListPage}
            onPerPageChange={(n) => {
              setListPerPage(n);
              setListPage(1);
            }}
          />
        )}
      </div>
      )}

      {editingActivity && (
        <EditMechanicActivityModal
          activity={editingActivity}
          types={types}
          mainWoList={mainWoList}
          subWoList={subWoList}
          onClose={() => setEditingActivity(null)}
          onSaved={refreshActivities}
        />
      )}

      <ConfirmAlert
        open={bulkSubmitConfirmOpen}
        title="Ajukan semua aktivitas draft?"
        message={`Anda akan mengajukan ${draftCount} laporan harian (semua aktivitas per hari) ke supervisor sekaligus.\n\nSupervisor hanya perlu 1 kali approve per hari per mekanik.`}
        confirmLabel="Ya, Ajukan Semua"
        cancelLabel="Batal"
        variant="question"
        loading={submittingApproval}
        onConfirm={confirmBulkSubmit}
        onCancel={() => !submittingApproval && setBulkSubmitConfirmOpen(false)}
      />

      <ConfirmAlert
        open={bulkApproveConfirmOpen}
        title="Setujui semua laporan harian pending?"
        message={
          listFilter.work_order_id && selectedSubWo
            ? `Anda akan menyetujui ${pendingApprovalCount} laporan harian pending pada Sub WO ${selectedSubWo.wo_number} sekaligus.\n\nSetiap laporan berisi detail aktivitas mekanik pada hari tersebut.`
            : `Anda akan menyetujui ${pendingApprovalCount} laporan harian pending sekaligus.\n\nSatu baris = 1 mekanik pada 1 hari. Buka Detail untuk melihat aktivitas per jam.`
        }
        confirmLabel="Ya, Setujui Semua"
        cancelLabel="Batal"
        variant="question"
        loading={bulkApproving}
        onConfirm={confirmBulkApprove}
        onCancel={() => !bulkApproving && setBulkApproveConfirmOpen(false)}
      />

      <RejectReasonDialog
        open={Boolean(rejectDialog)}
        title={rejectDialog?.title ?? 'Tolak?'}
        message={rejectDialog?.message ?? ''}
        loading={rejecting}
        onConfirm={confirmReject}
        onCancel={() => !rejecting && setRejectDialog(null)}
      />
    </div>
  );
}
