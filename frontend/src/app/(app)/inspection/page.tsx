'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { FlashMessage, workOrderFeedbackMessage } from '@/components/ui/FlashMessage';
import type { MechanicActivity, OvertimeRequest, Paginated, PartsRequest, WorkOrder, WorkOrderApiResult } from '@/lib/types';
import { workOrderApproveSuccessMessage } from '@/lib/work-order-messages';

export default function InspectionPage() {
  const [woPending, setWoPending] = useState<Paginated<WorkOrder> | null>(null);
  const [actPending, setActPending] = useState<Paginated<MechanicActivity> | null>(null);
  const [partsPending, setPartsPending] = useState<Paginated<PartsRequest> | null>(null);
  const [otPending, setOtPending] = useState<Paginated<OvertimeRequest> | null>(null);
  const [flash, setFlash] = useState<{ variant: 'success' | 'error'; message: string } | null>(
    null
  );

  const load = () => {
    api<Paginated<WorkOrder>>('/work-orders?status=pending_supervisor').then(setWoPending);
    api<Paginated<MechanicActivity>>('/mechanic-activities?status=pending_approval').then(setActPending);
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

  const approveAct = async (id: number, action: 'approve' | 'reject') => {
    await api(`/mechanic-activities/${id}/approve`, { method: 'POST', body: JSON.stringify({ action }) });
    load();
    window.dispatchEvent(new Event('activities-pending-count-changed'));
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

      <Section title="Mechanic Activity">
        {actPending?.data.map((a) => (
          <ApprovalCard key={a.id} title={a.user?.name || ''} subtitle={a.activity_type?.name || ''} meta={`${a.total_hours}h — ${a.activity_date}`}>
            <div className="mt-2 flex gap-2">
              <Btn onClick={() => approveAct(a.id, 'approve')} color="green">Approve</Btn>
              <Btn onClick={() => approveAct(a.id, 'reject')} color="red">Reject</Btn>
            </div>
          </ApprovalCard>
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
        {partsPending?.data.map((p) => (
          <ApprovalCard key={p.id} title={p.request_number} subtitle={p.work_order?.wo_number || ''} meta={`${p.items?.length} items — ${p.workshop}`}>
            <ItemsList items={p.items} />
            <div className="mt-2 flex gap-2">
              <Btn onClick={() => approveParts(p.id, 'approve')} color="green">Approve</Btn>
              <Btn onClick={() => approveParts(p.id, 'reject')} color="red">Reject</Btn>
            </div>
          </ApprovalCard>
        ))}
        {!partsPending?.data.length && <Empty />}
      </Section>
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
