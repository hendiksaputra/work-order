'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { FlashMessage, workOrderFeedbackMessage } from '@/components/ui/FlashMessage';
import { RejectReasonDialog } from '@/components/ui/RejectReasonDialog';
import type { MechanicActivity, MechanicActivitySubmission, OvertimeRequest, Paginated, PartsRequest, WorkOrder, WorkOrderApiResult } from '@/lib/types';
import { workOrderApproveSuccessMessage } from '@/lib/work-order-messages';
import { formatDecimalHours } from '@/lib/utils';
import {
  ActivityDetailSubWoHourWarnings,
  SubWoExceededInlineBadge,
} from '@/components/activities/ActivityDetailSubWoHourWarnings';
import { buildSubWoHourBudget, resolveSubWoForActivity } from '@/lib/sub-wo-hour-budget';
import { useAuth } from '@/lib/auth-context';
import { Permission } from '@/lib/permissions';
import { canSupervisorApprovePartsRequest } from '@/lib/parts-request-access';

type RejectTarget =
  | { type: 'submission'; id: number }
  | { type: 'activity'; activity: MechanicActivity };

export default function InspectionPage() {
  const { user, can } = useAuth();
  const canApproveParts = can(Permission.PARTS_SUPERVISOR);
  const [woPending, setWoPending] = useState<Paginated<WorkOrder> | null>(null);
  const [actPending, setActPending] = useState<Paginated<MechanicActivitySubmission> | null>(null);
  const [partsPending, setPartsPending] = useState<Paginated<PartsRequest> | null>(null);
  const [otPending, setOtPending] = useState<Paginated<OvertimeRequest> | null>(null);
  const [flash, setFlash] = useState<{ variant: 'success' | 'error'; message: string } | null>(
    null
  );
  const [rejectDialog, setRejectDialog] = useState<{
    target: RejectTarget;
    title: string;
    message: string;
  } | null>(null);
  const [rejecting, setRejecting] = useState(false);

  const load = () => {
    api<Paginated<WorkOrder>>('/work-orders?status=pending_supervisor').then(setWoPending);
    api<Paginated<MechanicActivitySubmission>>('/mechanic-activity-submissions?status=pending_approval&per_page=50').then(setActPending);
    api<Paginated<PartsRequest>>('/parts-requests?status=pending_approval').then(setPartsPending);
    api<Paginated<OvertimeRequest>>('/overtime-requests?status=pending_approval').then(setOtPending);
  };

  useEffect(() => { load(); }, []);

  const approveWo = async (wo: WorkOrder, action: 'approve' | 'reject') => {
    const verb = action === 'approve' ? 'Setujui' : 'Tolak';
    if (!confirm(`${verb} Work Order ${wo.wo_number}?`)) return;
    try {
      const updated = await api<WorkOrderApiResult>(`/work-orders/${wo.id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      load();
      window.dispatchEvent(new Event('wo-pending-count-changed'));
      setFlash({
        variant: 'success',
        message: workOrderApproveSuccessMessage(updated, action, updated.message),
      });
    } catch (err) {
      setFlash({
        variant: 'error',
        message: workOrderFeedbackMessage(err, `Gagal ${verb.toLowerCase()} Work Order`),
      });
    }
  };

  const approveSubmission = async (id: number, action: 'approve' | 'reject') => {
    if (action === 'reject') {
      setRejectDialog({
        target: { type: 'submission', id },
        title: 'Tolak laporan harian?',
        message: 'Semua aktivitas pending pada hari tersebut akan ditolak. Mekanik dapat memperbaiki dan mengajukan ulang.',
      });
      return;
    }
    if (!confirm('Setujui laporan harian ini? Semua aktivitas pending pada hari tersebut ikut disetujui.')) return;
    await api(`/mechanic-activity-submissions/${id}/approve`, { method: 'POST', body: JSON.stringify({ action }) });
    load();
    window.dispatchEvent(new Event('activities-pending-count-changed'));
  };

  const approveActivity = async (activity: MechanicActivity, action: 'approve' | 'reject') => {
    const label = activity.activity_type?.name ?? 'aktivitas';
    if (action === 'reject') {
      setRejectDialog({
        target: { type: 'activity', activity },
        title: 'Tolak aktivitas?',
        message: `Aktivitas "${label}" akan ditolak. Mekanik dapat memperbaiki dan mengajukan ulang.`,
      });
      return;
    }
    if (!confirm(`Setujui aktivitas "${label}"?`)) return;
    await api(`/mechanic-activities/${activity.id}/approve`, { method: 'POST', body: JSON.stringify({ action }) });
    load();
    window.dispatchEvent(new Event('activities-pending-count-changed'));
  };

  const confirmReject = async (notes: string) => {
    if (!rejectDialog) return;
    setRejecting(true);
    try {
      if (rejectDialog.target.type === 'submission') {
        await api(`/mechanic-activity-submissions/${rejectDialog.target.id}/approve`, {
          method: 'POST',
          body: JSON.stringify({ action: 'reject', notes }),
        });
      } else {
        await api(`/mechanic-activities/${rejectDialog.target.activity.id}/approve`, {
          method: 'POST',
          body: JSON.stringify({ action: 'reject', notes }),
        });
      }
      setRejectDialog(null);
      load();
      window.dispatchEvent(new Event('activities-pending-count-changed'));
    } catch (err) {
      setFlash({
        variant: 'error',
        message: err instanceof Error ? err.message : 'Gagal menolak',
      });
    } finally {
      setRejecting(false);
    }
  };

  const approveParts = async (id: number, action: 'approve' | 'reject') => {
    await api(`/parts-requests/${id}/supervisor`, { method: 'POST', body: JSON.stringify({ action }) });
    load();
    window.dispatchEvent(new Event('parts-pending-count-changed'));
  };

  const approveOvertime = async (id: number, action: 'approve' | 'reject') => {
    await api(`/overtime-requests/${id}/approve`, { method: 'POST', body: JSON.stringify({ action }) });
    load();
    window.dispatchEvent(new Event('overtime-pending-count-changed'));
  };

  return (
    <div className="p-8">
      <PageHeader
        title="Inspection (Supervisor)"
        subtitle="Pusat persetujuan Supervisor — Work Order, aktivitas mekanik, dan permintaan parts yang menunggu validasi"
      />

      {flash && (
        <FlashMessage
          variant={flash.variant}
          message={flash.message}
          onDismiss={() => setFlash(null)}
        />
      )}

      <Section title="Work Order — Scope Approval">
        {woPending?.data.map((wo) => (
          <ApprovalCard key={wo.id} title={wo.wo_number} subtitle={wo.title} meta={`MP: ${wo.manpower_count} | Est: ${wo.estimated_hours}h`}>
            <Badge status={wo.status} />
            <div className="mt-2 flex gap-2">
              <Btn onClick={() => approveWo(wo, 'approve')} color="green">Approve</Btn>
              <Btn onClick={() => approveWo(wo, 'reject')} color="red">Reject</Btn>
            </div>
          </ApprovalCard>
        ))}
        {!woPending?.data.length && <Empty />}
      </Section>

      <Section title="Laporan Harian Mekanik">
        {actPending?.data.map((submission) => (
          <MechanicSubmissionCard
            key={submission.id}
            submission={submission}
            onApprove={(action) => approveSubmission(submission.id, action)}
            onApproveActivity={approveActivity}
          />
        ))}
        {!actPending?.data.length && <Empty />}
      </Section>

      <Section title="Pengajuan Lembur">
        {otPending?.data.map((ot) => (
          <ApprovalCard
            key={ot.id}
            title={ot.user?.name || 'Mekanik'}
            subtitle={ot.work_order?.wo_number || 'Tanpa WO'}
            meta={`${String(ot.activity_date).slice(0, 10)} · ${ot.overtime_start?.slice(0, 5)}–${ot.overtime_end?.slice(0, 5)}`}
          >
            <p className="mt-2 text-sm text-slate-600">{ot.reason}</p>
            <div className="mt-2 flex gap-2">
              <Btn onClick={() => approveOvertime(ot.id, 'approve')} color="green">
                Setujui Lembur
              </Btn>
              <Btn onClick={() => approveOvertime(ot.id, 'reject')} color="red">
                Tolak
              </Btn>
            </div>
          </ApprovalCard>
        ))}
        {!otPending?.data.length && <Empty />}
      </Section>

      <Section title="Parts & Consumable">
        {partsPending?.data.map((p) => {
          const canApprove = canSupervisorApprovePartsRequest(p, user, canApproveParts);
          return (
          <ApprovalCard key={p.id} title={p.request_number} subtitle={p.work_order?.wo_number || ''} meta={`${p.items?.length} items — ${p.workshop}`}>
            <ItemsList items={p.items} />
            {canApprove ? (
              <div className="mt-2 flex gap-2">
                <Btn onClick={() => approveParts(p.id, 'approve')} color="green">Approve</Btn>
                <Btn onClick={() => approveParts(p.id, 'reject')} color="red">Reject</Btn>
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-500">
                Menunggu supervisor lokasi/workshop WO ({p.workshop || p.work_order?.workshop || '—'}).
              </p>
            )}
          </ApprovalCard>
          );
        })}
        {!partsPending?.data.length && <Empty />}
      </Section>

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

function MechanicSubmissionCard({
  submission,
  onApprove,
  onApproveActivity,
}: {
  submission: MechanicActivitySubmission;
  onApprove: (action: 'approve' | 'reject') => void;
  onApproveActivity: (activity: MechanicActivity, action: 'approve' | 'reject') => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const activities = submission.activities ?? [];
  const tanggal = String(submission.activity_date).slice(0, 10);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{submission.user?.name || 'Mekanik'}</p>
          <p className="text-sm text-slate-600">
            {tanggal} · {submission.activities_count} aktivitas · {formatDecimalHours(submission.total_hours)} total
          </p>
        </div>
        <Badge status={submission.status} />
      </div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-3 text-xs font-medium text-slate-600 underline"
      >
        {expanded ? 'Sembunyikan detail' : `Lihat ${activities.length} aktivitas`}
      </button>
      {expanded && (
        <div className="mt-2 overflow-x-auto rounded-lg border border-slate-100 bg-slate-50">
          {activities.length === 0 ? (
            <p className="p-3 text-xs text-slate-500">Tidak ada detail aktivitas.</p>
          ) : (
            <>
              <div className="p-3 pb-0">
                <ActivityDetailSubWoHourWarnings activities={activities} />
              </div>
            <table className="w-full text-xs text-slate-600">
              <thead className="bg-slate-100 text-left">
                <tr>
                  <th className="px-3 py-2">WO</th>
                  <th className="px-3 py-2">Aktivitas</th>
                  <th className="px-3 py-2">Jam</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((a) => {
                  const woBudget = buildSubWoHourBudget(resolveSubWoForActivity(a), 0);
                  return (
                  <tr key={a.id} className="border-t border-slate-200">
                    <td className="px-3 py-2">
                      <div>{a.work_order?.wo_number || '—'}</div>
                      <SubWoExceededInlineBadge exceeded={Boolean(woBudget?.exceeded)} />
                    </td>
                    <td className="px-3 py-2">{a.activity_type?.name}</td>
                    <td className="px-3 py-2">
                      {formatDecimalHours(a.total_hours)} ({a.start_time?.slice(0, 5)}-{a.end_time?.slice(0, 5)})
                    </td>
                    <td className="px-3 py-2">
                      <Badge status={a.status} />
                      {a.status === 'rejected' && a.supervisor_notes && (
                        <p className="mt-1 text-red-700">Alasan: {a.supervisor_notes}</p>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {a.status === 'pending_approval' ? (
                        <div className="flex justify-end gap-1">
                          <Btn onClick={() => onApproveActivity(a, 'approve')} color="green">
                            Setujui
                          </Btn>
                          <Btn onClick={() => onApproveActivity(a, 'reject')} color="red">
                            Tolak
                          </Btn>
                        </div>
                      ) : (
                        <span className="block text-right text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
            </>
          )}
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <Btn onClick={() => onApprove('approve')} color="green">
          Setujui Hari
        </Btn>
        <Btn onClick={() => onApprove('reject')} color="red">
          Tolak Hari
        </Btn>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h3 className="mb-4 text-lg font-semibold text-slate-800">{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function ApprovalCard({ title, subtitle, meta, children }: { title: string; subtitle: string; meta: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-slate-600">{subtitle}</p>
      <p className="mt-1 text-xs text-slate-400">{meta}</p>
      {children}
    </div>
  );
}

function Btn({ onClick, color, children }: { onClick: () => void; color: string; children: React.ReactNode }) {
  const cls = color === 'green' ? 'bg-green-600' : 'bg-red-600';
  return <button onClick={onClick} className={`rounded px-3 py-1 text-xs text-white ${cls}`}>{children}</button>;
}

function Empty() {
  return <p className="text-sm text-slate-400">Tidak ada pending approval.</p>;
}

function ItemsList({ items }: { items?: { part_name: string; qty: number; in_stock: boolean }[] }) {
  if (!items?.length) return null;
  return (
    <ul className="mt-2 text-xs text-slate-500">
      {items.map((i, idx) => (
        <li key={idx}>{i.part_name} x{i.qty} {!i.in_stock && '(outstanding)'}</li>
      ))}
    </ul>
  );
}
