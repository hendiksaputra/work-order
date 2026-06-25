'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { FlashMessage, workOrderFeedbackMessage } from '@/components/ui/FlashMessage';
import { WorkOrderBodyDetails } from '@/components/work-orders/WorkOrderBodyDetails';
import { formatDate } from '@/lib/utils';
import type { WorkOrder, WorkOrderApiResult } from '@/lib/types';
import { useAuth } from '@/lib/auth-context';
import { Permission } from '@/lib/permissions';
import { canSubmitWorkOrder } from '@/lib/work-order-access';
import {
  workOrderApproveSuccessMessage,
  workOrderSubmitSuccessMessage,
} from '@/lib/work-order-messages';
import {
  WorkOrderWorkflowActions,
  WorkOrderWorkflowBanner,
  confirmWorkOrderApprove,
  confirmWorkOrderReject,
} from '@/components/work-orders/WorkOrderWorkflowActions';
import { WorkOrderOperationalPanel } from '@/components/work-orders/WorkOrderOperationalPanel';
import {
  WorkOrderHierarchyPanel,
  resolveWorkOrderHierarchy,
  shouldShowWorkOrderHierarchy,
} from '@/components/work-orders/WorkOrderHierarchyTree';
import { stashWorkOrderFlash } from '@/lib/wo-flash';

export default function WorkOrderDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user, can } = useAuth();
  const [wo, setWo] = useState<WorkOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [flash, setFlash] = useState<{ variant: 'success' | 'error'; message: string } | null>(
    null
  );

  const load = () => {
    setLoading(true);
    setLoadError('');
    return api<WorkOrder>(`/work-orders/${id}`)
      .then((data) => {
        setWo(data);
        setLoadError('');
      })
      .catch((err) => {
        setWo(null);
        setLoadError(workOrderFeedbackMessage(err, 'Gagal memuat Work Order'));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [id]);

  const submitWo = async () => {
    if (!wo || !confirm(`Ajukan ${wo.wo_number} ke Supervisor?`)) return;
    try {
      const updated = await api<WorkOrderApiResult>(`/work-orders/${id}/submit`, {
        method: 'POST',
      });
      setWo(updated);
      window.dispatchEvent(new Event('wo-pending-count-changed'));
      setFlash({
        variant: 'success',
        message: workOrderSubmitSuccessMessage(updated, updated.message),
      });
    } catch (err) {
      setFlash({
        variant: 'error',
        message: workOrderFeedbackMessage(err, 'Gagal mengajukan Work Order'),
      });
    }
  };

  const approve = async (action: 'approve' | 'reject') => {
    if (!wo) return;
    const confirmed =
      action === 'approve' ? confirmWorkOrderApprove(wo) : confirmWorkOrderReject(wo);
    if (!confirmed) return;
    try {
      const updated = await api<WorkOrderApiResult>(`/work-orders/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      window.dispatchEvent(new Event('wo-pending-count-changed'));
      if (action === 'approve') {
        stashWorkOrderFlash({
          variant: 'success',
          message: workOrderApproveSuccessMessage(updated, action, updated.message),
        });
        router.push('/work-orders');
        return;
      }
      setWo(updated);
      setFlash({
        variant: 'success',
        message: workOrderApproveSuccessMessage(updated, action, updated.message),
      });
    } catch (err) {
      setFlash({
        variant: 'error',
        message: workOrderFeedbackMessage(err, `Gagal ${action === 'approve' ? 'menyetujui' : 'menolak'} Work Order`),
      });
    }
  };

  if (loading) {
    return <div className="p-8 text-slate-400">Memuat...</div>;
  }

  if (loadError || !wo) {
    return (
      <div className="p-8">
        <FlashMessage variant="error" message={loadError || 'Work Order tidak ditemukan.'} onDismiss={() => {}} autoHideMs={0} />
        <p className="mt-4 text-sm text-slate-600">
          Data mungkin sudah dihapus dari daftar Work Order.
        </p>
        <WorkOrderBackButton className="mt-4" />
      </div>
    );
  }

  const canSubmit = canSubmitWorkOrder(wo, user, can(Permission.WORK_ORDERS_SUBMIT));
  const canApprove = can(Permission.WORK_ORDERS_APPROVE);
  const canOperational =
    canApprove || can(Permission.WORK_ORDERS_EDIT_ANY_STATUS) || can(Permission.WORK_ORDERS_UPDATE);

  return (
    <div className="p-8">
      <WorkOrderBackButton className="mb-4" />
      <PageHeader title={wo.wo_number} subtitle={wo.title} />
      {flash && (
        <FlashMessage
          variant={flash.variant}
          message={flash.message}
          onDismiss={() => setFlash(null)}
        />
      )}
      <div className="mb-6 flex flex-wrap gap-2">
        <Badge status={wo.status} />
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs capitalize">{wo.type} WO</span>
        {wo.workshop && (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs capitalize">{wo.workshop}</span>
        )}
      </div>
      <WoDetailGrid wo={wo} />
      <WorkOrderOperationalPanel
        wo={wo}
        canEdit={canOperational}
        onSaved={(updated) => setWo(updated)}
      />
      {canApprove && <WorkOrderWorkflowBanner wo={wo} />}
      <div className="mt-6">
        <WorkOrderBodyDetails wo={wo} />
      </div>
      <WoActions canSubmit={canSubmit} canApprove={canApprove} wo={wo} submitWo={submitWo} approve={approve} />
    </div>
  );
}

function WoDetailGrid({ wo }: { wo: WorkOrder }) {
  const hierarchy = shouldShowWorkOrderHierarchy(wo) ? resolveWorkOrderHierarchy(wo) : null;

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Header WO">
          <dl className="space-y-2 text-sm">
            <Row label="Kategori" value={wo.main_category || wo.workshop || '-'} />
            <Row label="Man Power" value={String(wo.manpower_count)} />
            <Row label="Estimasi Jam" value={`${wo.estimated_hours} jam`} />
            <Row label="Aktual Jam" value={`${wo.actual_hours} jam`} />
            <Row label="Material Cost" value={`Rp ${Number(wo.material_cost).toLocaleString('id-ID')}`} />
            <Row label="Dibuka" value={formatDate(wo.opened_at)} />
            <Row label="Ditutup" value={formatDate(wo.closed_at)} />
          </dl>
        </Panel>
        <Panel title="Unit / Komponen">
          <dl className="space-y-2 text-sm">
            <Row label="Komponen" value={wo.component_name || '—'} />
            <Row label="Serial" value={wo.component_serial || '—'} />
            <Row label="Tgl pasang" value={formatDate(wo.component_installed_at ?? undefined)} />
            <Row label="Model Unit" value={wo.unit_model || '—'} />
            <Row label="No Unit" value={wo.unit_number || '—'} />
            <Row label="Lokasi" value={wo.location || '—'} />
          </dl>
        </Panel>
      </div>
      {hierarchy && (
        <WorkOrderHierarchyPanel
          main={hierarchy.main}
          subs={hierarchy.subs}
          highlightId={wo.id}
          defaultOpen
          className="mt-6"
        />
      )}
    </>
  );
}

function WoActions({
  canSubmit,
  canApprove,
  wo,
  submitWo,
  approve,
}: {
  canSubmit: boolean;
  canApprove: boolean;
  wo: WorkOrder;
  submitWo: () => void;
  approve: (a: 'approve' | 'reject') => void;
}) {
  return (
    <div className="mt-6 flex flex-wrap gap-3">
      {canSubmit && (
        <button
          type="button"
          onClick={submitWo}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Ajukan ke Supervisor
        </button>
      )}
      {canApprove && (
        <WorkOrderWorkflowActions wo={wo} canApprovePerm={canApprove} onApprove={approve} />
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <DetailRow label={label} value={value} />
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium capitalize">{value}</dd>
    </div>
  );
}

function Panel({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <h3 className="font-semibold">{title}</h3>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function WorkOrderBackButton({ className = '' }: { className?: string }) {
  return (
    <Link
      href="/work-orders"
      className={`inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700 ${className}`}
    >
      <ArrowLeft className="h-4 w-4 shrink-0" />
      Back
    </Link>
  );
}
