'use client';

import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronDown, ChevronUp, Lock, Plus, Pencil, Send, Trash2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { FlashMessage, workOrderFeedbackMessage } from '@/components/ui/FlashMessage';
import { CreateWorkOrderModal } from '@/components/work-orders/CreateWorkOrderModal';
import { WorkOrderBodyDetails } from '@/components/work-orders/WorkOrderBodyDetails';
import {
  WorkOrderHierarchyToggleButton,
  WorkOrderHierarchyTree,
} from '@/components/work-orders/WorkOrderHierarchyTree';
import { MainWoSubProgressBar } from '@/components/work-orders/MainWoSubProgressBar';
import { WorkOrderOperationalStatusEditor } from '@/components/work-orders/WorkOrderOperationalStatusEditor';
import type { Paginated, User, WorkOrder, WorkOrderApiResult } from '@/lib/types';
import { useAuth } from '@/lib/auth-context';
import { Permission } from '@/lib/permissions';
import {
  canCreateMainWorkOrder,
  canCreateSubWorkOrder,
  canDeleteWorkOrder,
  canEditWorkOrder,
  canRejectWorkOrder,
  canSubmitWorkOrder,
} from '@/lib/work-order-access';
import {
  confirmWorkOrderApprove,
  confirmWorkOrderReject,
} from '@/components/work-orders/WorkOrderWorkflowActions';
import {
  canShowAdvanceOnWorkOrderList,
  getWorkOrderAdvanceAction,
} from '@/lib/work-order-status-flow';
import {
  workOrderApproveSuccessMessage,
  workOrderSubmitSuccessMessage,
} from '@/lib/work-order-messages';
import { consumeWorkOrderFlash } from '@/lib/wo-flash';

export default function WorkOrdersPage() {
  const { user, can } = useAuth();
  const canUpdate = can(Permission.WORK_ORDERS_UPDATE);
  const canSubEdit = can(Permission.WORK_ORDERS_SUB_EDIT);
  const canSubDelete = can(Permission.WORK_ORDERS_SUB_DELETE);
  const canEditAny = can(Permission.WORK_ORDERS_EDIT_ANY_STATUS);
  const canDeleteAny = can(Permission.WORK_ORDERS_DELETE_ANY_STATUS);
  const canCreateMain = canCreateMainWorkOrder(can);
  const canCreateSub = canCreateSubWorkOrder(can);
  const canCreateAny = canCreateMain || canCreateSub;
  const canSubmitPerm = can(Permission.WORK_ORDERS_SUBMIT);
  const canApprovePerm = can(Permission.WORK_ORDERS_APPROVE);
  const [data, setData] = useState<Paginated<WorkOrder> | null>(null);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editingWo, setEditingWo] = useState<WorkOrder | null>(null);
  const [flash, setFlash] = useState<{ variant: 'success' | 'error'; message: string } | null>(
    null
  );

  const load = () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (type) params.set('type', type);
    api<Paginated<WorkOrder>>(`/work-orders?${params}`).then(setData).catch(console.error);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const pending = consumeWorkOrderFlash();
    if (pending) setFlash(pending);
  }, []);

  const remove = async (wo: WorkOrder) => {
    const typeLabel = wo.type === 'sub' ? 'Sub WO' : 'Main WO';
    const warn =
      wo.status !== 'draft' && wo.status !== 'rejected'
        ? `\n\nStatus saat ini: ${wo.status}. WO yang sudah berjalan akan dihapus permanen.`
        : '';
    if (!confirm(`Hapus ${typeLabel} ${wo.wo_number}?${warn}`)) return;
    try {
      const res = await api<{ message?: string }>(`/work-orders/${wo.id}`, { method: 'DELETE' });
      load();
      setFlash({
        variant: 'success',
        message: res.message || `Work Order ${wo.wo_number} berhasil dihapus.`,
      });
    } catch (err) {
      setFlash({
        variant: 'error',
        message: workOrderFeedbackMessage(err, 'Gagal menghapus Work Order'),
      });
    }
  };

  const approve = async (wo: WorkOrder, action: 'approve' | 'reject') => {
    const label = action === 'approve' ? 'menyetujui' : 'menolak';
    const confirmed =
      action === 'approve' ? confirmWorkOrderApprove(wo) : confirmWorkOrderReject(wo);
    if (!confirmed) return;
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
        message: workOrderFeedbackMessage(err, `Gagal ${label} Work Order`),
      });
    }
  };

  const submit = async (wo: WorkOrder) => {
    if (
      !confirm(
        `Ajukan ${wo.wo_number} ke Supervisor?\n\nStatus akan berubah dari draft menjadi menunggu persetujuan.`
      )
    ) {
      return;
    }
    try {
      const updated = await api<WorkOrderApiResult>(`/work-orders/${wo.id}/submit`, {
        method: 'POST',
      });
      load();
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

  return (
    <div className="p-8">
      <PageHeader
        title="Work Order"
        subtitle={
          canApprovePerm
            ? 'Supervisor: atur status operasional WO (Status WO.docx), lanjutkan alur persetujuan, dan tutup WO (ikon gembok).'
            : 'Main WO + Sub WO · Klik ikon panah di kolom Work Details untuk melihat JOB ACTIVITY, Parts, dan Crew'
        }
        action={
          canCreateAny ? (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
            >
              <Plus className="h-4 w-4" />
              Buat WO
            </button>
          ) : undefined
        }
      />

      <CreateWorkOrderModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(wo) => {
          load();
          window.dispatchEvent(new Event('wo-pending-count-changed'));
          setFlash({
            variant: 'success',
            message: `Work Order ${wo.wo_number} berhasil dibuat (draft).`,
          });
        }}
        onCreatedAndApproved={(wo) => {
          load();
          window.dispatchEvent(new Event('wo-pending-count-changed'));
          setFlash({
            variant: 'success',
            message: workOrderApproveSuccessMessage(wo, 'approve', wo.message),
          });
        }}
      />

      <CreateWorkOrderModal
        open={Boolean(editingWo)}
        workOrder={editingWo}
        onClose={() => setEditingWo(null)}
        onUpdated={(wo) => {
          setEditingWo(null);
          load();
          setFlash({
            variant: 'success',
            message: `Work Order ${wo.wo_number} berhasil diperbarui.`,
          });
        }}
      />

      {flash && (
        <FlashMessage
          variant={flash.variant}
          message={flash.message}
          onDismiss={() => setFlash(null)}
        />
      )}

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          placeholder="Cari no WO, judul, komponen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
        >
          <option value="">Semua Tipe</option>
          <option value="main">Main WO</option>
          <option value="sub">Sub WO</option>
        </select>
        <button
          type="button"
          onClick={load}
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white"
        >
          Filter
        </button>
      </div>

      <WoTable
        data={data}
        user={user}
        canUpdate={canUpdate}
        canSubEdit={canSubEdit}
        canSubDelete={canSubDelete}
        canEditAny={canEditAny}
        canDeleteAny={canDeleteAny}
        canSubmitPerm={canSubmitPerm}
        canApprovePerm={canApprovePerm}
        onEdit={setEditingWo}
        onDelete={remove}
        onSubmit={submit}
        onApprove={approve}
        onRefresh={load}
      />
    </div>
  );
}

function hasWorkOrderListRowActions(
  wo: WorkOrder,
  user: User | null,
  canUpdate: boolean,
  canSubEdit: boolean,
  canSubDelete: boolean,
  canEditAny: boolean,
  canDeleteAny: boolean,
  canSubmitPerm: boolean,
  canApprovePerm: boolean
): boolean {
  return (
    canEditWorkOrder(wo, user, canUpdate, canEditAny, canSubEdit) ||
    canDeleteWorkOrder(wo, user, canUpdate, canDeleteAny, canSubDelete, canSubEdit) ||
    canSubmitWorkOrder(wo, user, canSubmitPerm) ||
    canShowAdvanceOnWorkOrderList(wo, canApprovePerm) ||
    canRejectWorkOrder(wo, canApprovePerm)
  );
}

function WoTable({
  data,
  user,
  canUpdate,
  canSubEdit,
  canSubDelete,
  canEditAny,
  canDeleteAny,
  canSubmitPerm,
  canApprovePerm,
  onEdit,
  onDelete,
  onSubmit,
  onApprove,
  onRefresh,
}: {
  data: Paginated<WorkOrder> | null;
  user: User | null;
  canUpdate: boolean;
  canSubEdit: boolean;
  canSubDelete: boolean;
  canEditAny: boolean;
  canDeleteAny: boolean;
  canSubmitPerm: boolean;
  canApprovePerm: boolean;
  onEdit: (wo: WorkOrder) => void;
  onDelete: (wo: WorkOrder) => void;
  onSubmit: (wo: WorkOrder) => void;
  onApprove: (wo: WorkOrder, action: 'approve' | 'reject') => void;
  onRefresh: () => void;
}) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedWo, setExpandedWo] = useState<WorkOrder | null>(null);
  const [loadingDetailId, setLoadingDetailId] = useState<number | null>(null);
  const [hierarchyExpandedIds, setHierarchyExpandedIds] = useState<Set<number>>(new Set());

  const toggleHierarchy = (woId: number) => {
    setHierarchyExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(woId)) {
        next.delete(woId);
      } else {
        next.add(woId);
      }
      return next;
    });
  };

  const toggleWorkDetails = async (wo: WorkOrder) => {
    if (expandedId === wo.id) {
      setExpandedId(null);
      setExpandedWo(null);
      return;
    }
    setExpandedId(wo.id);
    setExpandedWo(null);
    setLoadingDetailId(wo.id);
    try {
      const full = await api<WorkOrder>(`/work-orders/${wo.id}`);
      setExpandedWo(full);
    } catch {
      setExpandedId(null);
      alert('Gagal memuat detail Work Order');
    } finally {
      setLoadingDetailId(null);
    }
  };

  if (!data) {
    return <div className="py-12 text-center text-slate-400">Memuat...</div>;
  }

  const showActionsColumn = data.data.some((wo) =>
    hasWorkOrderListRowActions(
      wo,
      user,
      canUpdate,
      canSubEdit,
      canSubDelete,
      canEditAny,
      canDeleteAny,
      canSubmitPerm,
      canApprovePerm
    )
  );

  const mainIdsOnPage = new Set(
    data.data.filter((wo) => wo.type === 'main').map((wo) => wo.id)
  );
  const visibleRows = data.data.filter(
    (wo) => wo.type === 'main' || !wo.parent_id || !mainIdsOnPage.has(wo.parent_id)
  );
  const perPage = 15;
  const rowOffset = (data.current_page - 1) * perPage;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-600">
          <tr>
            <th className="w-14 px-4 py-3 text-center">No</th>
            <th className="px-4 py-3">No WO</th>
            <th className="px-4 py-3">Judul</th>
            <th className="px-4 py-3">Tipe</th>
            <th className="px-4 py-3">Kategori/Workshop</th>
            <th className="px-4 py-3">Man Power</th>
            <th className="px-4 py-3">Est. Jam</th>
            <th className="px-4 py-3">Alur WO</th>
            <th className="px-4 py-3">Status Operasional</th>
            <th className="px-4 py-3 text-center">Main/Sub WO</th>
            <th className="px-4 py-3 text-center">Work Details</th>
            {showActionsColumn && <th className="px-4 py-3 text-right">Action</th>}
          </tr>
        </thead>
        <tbody>
          {visibleRows.length === 0 ? (
            <tr>
              <td
                colSpan={showActionsColumn ? 12 : 11}
                className="px-4 py-12 text-center text-slate-400"
              >
                Tidak ada data
              </td>
            </tr>
          ) : (
            visibleRows.map((wo, index) => {
              const canEdit = canEditWorkOrder(wo, user, canUpdate, canEditAny, canSubEdit);
              const canDel = canDeleteWorkOrder(
                wo,
                user,
                canUpdate,
                canDeleteAny,
                canSubDelete,
                canSubEdit
              );
              const canSubmit = canSubmitWorkOrder(wo, user, canSubmitPerm);
              const canShowAdvance = canShowAdvanceOnWorkOrderList(wo, canApprovePerm);
              const canReject = canRejectWorkOrder(wo, canApprovePerm);
              const advanceAction = canShowAdvance ? getWorkOrderAdvanceAction(wo) : null;
              const hasActions = hasWorkOrderListRowActions(
                wo,
                user,
                canUpdate,
                canSubEdit,
                canSubDelete,
                canEditAny,
                canDeleteAny,
                canSubmitPerm,
                canApprovePerm
              );
              const subWorkOrders = wo.sub_work_orders ?? [];
              const showHierarchy =
                wo.type === 'main' && subWorkOrders.length > 0;
              const mainBlockedBySubs = showHierarchy && subWorkOrders.length > 0;

              const colSpan = showActionsColumn ? 12 : 11;
              const isExpanded = expandedId === wo.id;
              const isHierarchyExpanded = hierarchyExpandedIds.has(wo.id);

              return (
                <Fragment key={wo.id}>
                  <tr className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-center text-slate-500">
                      {rowOffset + index + 1}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/work-orders/${wo.id}`} className="font-medium text-orange-600">
                        {wo.wo_number}
                      </Link>
                      {showHierarchy && (
                        <MainWoSubProgressBar subs={subWorkOrders} compact className="mt-2 max-w-[10rem]" />
                      )}
                    </td>
                    <td className="px-4 py-3">{wo.title}</td>
                    <td className="px-4 py-3 capitalize">{wo.type}</td>
                    <td className="px-4 py-3 capitalize">
                      {wo.type === 'main' ? wo.main_category : wo.workshop}
                    </td>
                    <td className="px-4 py-3">{wo.manpower_count}</td>
                    <td className="px-4 py-3">{wo.estimated_hours}h</td>
                    <td className="px-4 py-3">
                      <Badge status={wo.status} />
                    </td>
                    <td className="px-4 py-3">
                      <WorkOrderOperationalStatusEditor
                        wo={wo}
                        canEdit={canApprovePerm}
                        compact
                        onSaved={() => onRefresh()}
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      {showHierarchy ? (
                        <WorkOrderHierarchyToggleButton
                          open={isHierarchyExpanded}
                          subCount={subWorkOrders.length}
                          onClick={() => toggleHierarchy(wo.id)}
                        />
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => toggleWorkDetails(wo)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                        title={isExpanded ? 'Tutup work details' : 'Lihat work details'}
                        aria-expanded={isExpanded}
                      >
                        {loadingDetailId === wo.id ? (
                          '…'
                        ) : isExpanded ? (
                          <>
                            <ChevronUp className="h-4 w-4" />
                            Tutup
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-4 w-4" />
                            Detail
                          </>
                        )}
                      </button>
                    </td>
                    {showActionsColumn && (
                      <td className="px-4 py-3">
                        {hasActions ? (
                          <div className="flex justify-end gap-1">
                            {canShowAdvance && advanceAction && (
                              <button
                                type="button"
                                onClick={() => onApprove(wo, 'approve')}
                                className={
                                  advanceAction.isClose
                                    ? 'rounded p-1.5 text-slate-700 hover:bg-slate-100'
                                    : 'rounded p-1.5 text-green-600 hover:bg-green-50'
                                }
                                title={advanceAction.listTitle}
                              >
                                {advanceAction.isClose ? (
                                  <Lock className="h-4 w-4" />
                                ) : (
                                  <Check className="h-4 w-4" />
                                )}
                              </button>
                            )}
                            {canReject && (
                              <button
                                type="button"
                                onClick={() => onApprove(wo, 'reject')}
                                className="rounded p-1.5 text-red-600 hover:bg-red-50"
                                title="Tolak WO"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
                            {canSubmit && (
                              <button
                                type="button"
                                onClick={() => onSubmit(wo)}
                                className="rounded p-1.5 text-blue-600 hover:bg-blue-50"
                                title="Ajukan ke Supervisor"
                              >
                                <Send className="h-4 w-4" />
                              </button>
                            )}
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => onEdit(wo)}
                                className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
                                title="Edit WO"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                            )}
                            {canDel && !mainBlockedBySubs && (
                              <button
                                type="button"
                                onClick={() => onDelete(wo)}
                                className="rounded p-1.5 text-red-500 hover:bg-red-50"
                                title="Hapus WO"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                            {canDel && mainBlockedBySubs && (
                              <button
                                type="button"
                                disabled
                                className="cursor-not-allowed rounded p-1.5 text-slate-300"
                                title="Hapus semua Sub WO terlebih dahulu (buka panel Main/Sub WO)"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="block text-right text-slate-300">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                  {showHierarchy && isHierarchyExpanded && (
                    <tr key={`${wo.id}-hierarchy`} className="border-t border-slate-100 bg-white">
                      <td colSpan={colSpan} className="px-4 py-4">
                        <WorkOrderHierarchyTree
                          main={wo}
                          subs={subWorkOrders}
                          canDeleteSub={(sub) =>
                            canDeleteWorkOrder(
                              sub,
                              user,
                              canUpdate,
                              canDeleteAny,
                              canSubDelete,
                              canSubEdit
                            )
                          }
                          onDeleteSub={onDelete}
                          canEditSub={(sub) =>
                            canEditWorkOrder(sub, user, canUpdate, canEditAny, canSubEdit)
                          }
                          onEditSub={onEdit}
                        />
                      </td>
                    </tr>
                  )}
                  {isExpanded && (
                    <tr key={`${wo.id}-details`} className="border-t bg-slate-50/80">
                      <td colSpan={colSpan} className="px-4 py-4">
                        {loadingDetailId === wo.id ? (
                          <p className="text-center text-sm text-slate-500">Memuat work details…</p>
                        ) : expandedWo ? (
                          <WorkOrderBodyDetails wo={expandedWo} showHeader={false} />
                        ) : null}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
