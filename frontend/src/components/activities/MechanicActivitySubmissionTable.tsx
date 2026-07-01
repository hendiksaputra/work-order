'use client';

import { Fragment, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import type { MechanicActivity, MechanicActivitySubmission, Paginated, WorkOrder } from '@/lib/types';
import { formatDecimalHours } from '@/lib/utils';
import {
  ActivityDetailSubWoHourWarnings,
  SubWoExceededInlineBadge,
} from '@/components/activities/ActivityDetailSubWoHourWarnings';
import {
  buildSubWoHourBudget,
  resolveSubWoForActivity,
} from '@/lib/sub-wo-hour-budget';

type Props = {
  data: Paginated<MechanicActivitySubmission> | null;
  loadError: string;
  listPerPage: number;
  canApprove: boolean;
  onApprove: (submission: MechanicActivitySubmission, action: 'approve' | 'reject') => void;
  onApproveActivity: (activity: MechanicActivity, action: 'approve' | 'reject') => void;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
  emptyMessage?: string;
  subWoList?: WorkOrder[];
};

export function MechanicActivitySubmissionTable({
  data,
  loadError,
  listPerPage,
  canApprove,
  onApprove,
  onApproveActivity,
  onPageChange,
  onPerPageChange,
  emptyMessage = 'Belum ada laporan harian',
  subWoList = [],
}: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const toggleExpanded = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-600">
          <tr>
            <th className="w-12 px-4 py-3 text-center">No</th>
            <th className="px-4 py-3">Tanggal</th>
            <th className="px-4 py-3">Mekanik</th>
            <th className="px-4 py-3 text-center">Jumlah Aktivitas</th>
            <th className="px-4 py-3">Total Jam</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-center">Detail</th>
            {canApprove && <th className="px-4 py-3 text-right">Action</th>}
          </tr>
        </thead>
        <tbody>
          {!data?.data.length ? (
            <tr>
              <td
                colSpan={canApprove ? 8 : 7}
                className="px-4 py-12 text-center text-slate-400"
              >
                {loadError ? 'Gagal memuat data' : !data ? 'Memuat...' : emptyMessage}
              </td>
            </tr>
          ) : (
            data.data.map((submission, index) => {
              const rowNumber = (data.current_page - 1) * listPerPage + index + 1;
              const expanded = expandedIds.has(submission.id);
              const activities = submission.activities ?? [];
              const canApproveRow = canApprove && submission.status === 'pending_approval';

              return (
                <Fragment key={submission.id}>
                  <tr className="border-t hover:bg-slate-50">
                    <td className="px-4 py-3 text-center text-slate-500">{rowNumber}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {String(submission.activity_date).slice(0, 10)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-800">
                        {submission.user?.name ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">{submission.activities_count}</td>
                    <td className="px-4 py-3">{formatDecimalHours(submission.total_hours)}</td>
                    <td className="px-4 py-3">
                      <Badge status={submission.status} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => toggleExpanded(submission.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                        aria-expanded={expanded}
                      >
                        {expanded ? (
                          <>
                            <ChevronUp className="h-4 w-4" />
                            Tutup
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-4 w-4" />
                            {activities.length} aktivitas
                          </>
                        )}
                      </button>
                    </td>
                    {canApprove && (
                      <td className="px-4 py-3">
                        {canApproveRow ? (
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => onApprove(submission, 'approve')}
                              className="rounded px-2 py-1 text-xs font-medium text-green-600 hover:bg-green-50"
                            >
                              Setujui Hari
                            </button>
                            <button
                              type="button"
                              onClick={() => onApprove(submission, 'reject')}
                              className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                            >
                              Tolak Hari
                            </button>
                          </div>
                        ) : (
                          <span className="block text-right text-slate-300">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                  {expanded && (
                    <tr className="border-t bg-slate-50/80">
                      <td colSpan={canApprove ? 8 : 7} className="px-4 py-4">
                        <p className="mb-3 text-sm font-semibold text-slate-800">
                          Detail aktivitas — {submission.user?.name} (
                          {String(submission.activity_date).slice(0, 10)})
                        </p>
                        {submission.supervisor_notes && (
                          <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                            Catatan supervisor: {submission.supervisor_notes}
                          </p>
                        )}
                        <ActivityDetailSubWoHourWarnings
                          activities={activities}
                          subWoList={subWoList}
                        />
                        {activities.length === 0 ? (
                          <p className="text-sm text-slate-500">Tidak ada detail aktivitas.</p>
                        ) : (
                          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                            <table className="w-full text-sm">
                              <thead className="bg-slate-50 text-left text-slate-600">
                                <tr>
                                  <th className="px-3 py-2">WO</th>
                                  <th className="px-3 py-2">Aktivitas</th>
                                  <th className="px-3 py-2">Jam</th>
                                  <th className="px-3 py-2">Mode</th>
                                  <th className="px-3 py-2">Status</th>
                                  {canApprove && (
                                    <th className="px-3 py-2 text-right">Action</th>
                                  )}
                                </tr>
                              </thead>
                              <tbody>
                                {activities.map((activity) => {
                                  const canActOnActivity =
                                    canApprove &&
                                    submission.status === 'pending_approval' &&
                                    activity.status === 'pending_approval';
                                  const woBudget = buildSubWoHourBudget(
                                    resolveSubWoForActivity(activity, subWoList),
                                    0
                                  );

                                  return (
                                  <tr key={activity.id} className="border-t border-slate-100">
                                    <td className="px-3 py-2 text-slate-600">
                                      <div>{activity.work_order?.wo_number || '—'}</div>
                                      <SubWoExceededInlineBadge exceeded={Boolean(woBudget?.exceeded)} />
                                    </td>
                                    <td className="px-3 py-2">{activity.activity_type?.name}</td>
                                    <td className="px-3 py-2">
                                      {formatDecimalHours(activity.total_hours)} ({activity.start_time?.slice(0, 5)}-
                                      {activity.end_time?.slice(0, 5)})
                                    </td>
                                    <td className="px-3 py-2 capitalize">{activity.mode}</td>
                                    <td className="px-3 py-2">
                                      <Badge status={activity.status} />
                                      {activity.status === 'rejected' && activity.supervisor_notes && (
                                        <p className="mt-1 text-xs text-red-700">
                                          Alasan: {activity.supervisor_notes}
                                        </p>
                                      )}
                                    </td>
                                    {canApprove && (
                                      <td className="px-3 py-2">
                                        {canActOnActivity ? (
                                          <div className="flex justify-end gap-1">
                                            <button
                                              type="button"
                                              onClick={() => onApproveActivity(activity, 'approve')}
                                              className="rounded px-2 py-1 text-xs font-medium text-green-600 hover:bg-green-50"
                                            >
                                              Setujui
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => onApproveActivity(activity, 'reject')}
                                              className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                                            >
                                              Tolak
                                            </button>
                                          </div>
                                        ) : (
                                          <span className="block text-right text-slate-300">—</span>
                                        )}
                                      </td>
                                    )}
                                  </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })
          )}
        </tbody>
      </table>

      {data && data.total > 0 && (
        <Pagination
          page={data.current_page}
          lastPage={data.last_page}
          total={data.total}
          perPage={listPerPage}
          onPageChange={onPageChange}
          onPerPageChange={(n) => {
            onPerPageChange(n);
            onPageChange(1);
          }}
        />
      )}
    </div>
  );
}
