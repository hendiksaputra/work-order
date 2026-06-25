'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Pencil, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { EditPartsRequestModal } from '@/components/parts/EditPartsRequestModal';
import { PartsRequestItemsEditor } from '@/components/parts/PartsRequestItemsEditor';
import type { Paginated, PartsRequest, PartsRequestItem, WorkOrder } from '@/lib/types';
import { useAuth } from '@/lib/auth-context';
import { Permission } from '@/lib/permissions';
import {
  canDeletePartsRequest,
  canEditPartsRequest,
  canSubmitPartsRequest,
  canSupervisorApprovePartsRequest,
} from '@/lib/parts-request-access';

export default function PartsPage() {
  const { user, can } = useAuth();
  const canUpdate = can(Permission.PARTS_UPDATE);
  const canEditAny = can(Permission.PARTS_EDIT_ANY_STATUS);
  const canDelete = can(Permission.PARTS_DELETE);
  const canDeleteAny = can(Permission.PARTS_DELETE_ANY_STATUS);
  const canSupervisor = can(Permission.PARTS_SUPERVISOR);
  const canCreate = can(Permission.PARTS_CREATE);
  const [requests, setRequests] = useState<Paginated<PartsRequest> | null>(null);
  const [woList, setWoList] = useState<WorkOrder[]>([]);
  const [editingRequest, setEditingRequest] = useState<PartsRequest | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [form, setForm] = useState({
    work_order_id: '',
    workshop: 'rebuild',
    notes: '',
    items: [{ part_name: '', part_number: '', qty: 1, unit: 'pcs', in_stock: true, unit_cost: 0 }] as PartsRequestItem[],
  });

  const load = () => api<Paginated<PartsRequest>>('/parts-requests').then(setRequests);

  useEffect(() => {
    load();
    api<WorkOrder[]>('/work-orders/main-list').then(setWoList);
  }, []);

  const openEdit = async (request: PartsRequest) => {
    try {
      const full = await api<PartsRequest>(`/parts-requests/${request.id}`);
      setEditingRequest(full);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal memuat detail request');
    }
  };

  const removeRequest = async (request: PartsRequest) => {
    const warn =
      request.status !== 'draft' && request.status !== 'rejected'
        ? `\n\nStatus: ${request.status}. Request yang sudah disetujui/diproses akan dihapus permanen.`
        : '';
    if (!confirm(`Hapus ${request.request_number}?${warn}`)) return;
    try {
      await api(`/parts-requests/${request.id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal menghapus parts request');
    }
  };

  const addItem = () => {
    setForm({
      ...form,
      items: [...form.items, { part_name: '', part_number: '', qty: 1, unit: 'pcs', in_stock: true, unit_cost: 0 }],
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api('/parts-requests', {
        method: 'POST',
        body: JSON.stringify({
          work_order_id: Number(form.work_order_id),
          workshop: form.workshop,
          notes: form.notes,
          items: form.items,
        }),
      });
      await load();
      alert('Parts request dibuat (status draft). Klik Ajukan untuk kirim ke supervisor.');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal menyimpan parts request');
    }
  };

  const submitRequest = async (request: PartsRequest) => {
    if (!confirm(`Ajukan ${request.request_number} untuk approval supervisor?`)) return;
    setBusyId(request.id);
    try {
      await api(`/parts-requests/${request.id}/submit`, { method: 'POST' });
      await load();
      window.dispatchEvent(new Event('parts-pending-count-changed'));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal mengajukan parts request');
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const logisticProcess = async (id: number, action: 'check' | 'taken') => {
    setBusyId(id);
    try {
      await api(`/parts-requests/${id}/logistic`, { method: 'POST', body: JSON.stringify({ action }) });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal memproses logistic');
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const supervisorAction = async (request: PartsRequest, action: 'approve' | 'reject') => {
    const verb = action === 'approve' ? 'Setujui' : 'Tolak';
    if (!confirm(`${verb} ${request.request_number}?`)) return;
    try {
      await api(`/parts-requests/${request.id}/supervisor`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      await load();
      window.dispatchEvent(new Event('parts-pending-count-changed'));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal memproses parts request');
    }
  };

  const ic = 'w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm';

  return (
    <div className="p-8">
      <PageHeader
        title="Parts & Consumable"
        subtitle={
          canCreate
            ? 'Pilih WO, workshop, isi form lengkap — outstanding jika tidak ada stock'
            : canSupervisor
              ? 'Supervisor: setujui request status menunggu approval (Approve/Reject) atau gunakan menu Inspection'
              : can(Permission.PARTS_LOGISTIC)
                ? 'Logistic: proses request yang sudah disetujui supervisor (Cek / Diambil)'
                : 'Daftar permintaan parts & consumable'
        }
      />

      {canSupervisor && !canCreate && (
        <p className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Request dengan status <strong>Menunggu Approval</strong> dapat disetujui di kolom Aksi di bawah, atau di{' '}
          <Link href="/inspection" className="font-semibold underline">
            Inspection → Parts & Consumable
          </Link>
          .
        </p>
      )}

      {can(Permission.PARTS_CREATE) && (
      <form onSubmit={submit} className="mb-8 space-y-4 rounded-xl border bg-white p-6 shadow-sm">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Work Order</label>
            <select className={ic} value={form.work_order_id} onChange={(e) => setForm({ ...form, work_order_id: e.target.value })} required>
              <option value="">Pilih WO</option>
              {woList.map((w) => (
                <option key={w.id} value={w.id}>{w.wo_number} — {w.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Workshop</label>
            <select className={ic} value={form.workshop} onChange={(e) => setForm({ ...form, workshop: e.target.value })}>
              <option value="rebuild">Rebuild</option>
              <option value="fabrication">Fabrication</option>
              <option value="support">Support</option>
            </select>
          </div>
        </div>

        <h4 className="font-medium">Items</h4>
        <div className="overflow-x-auto">
          <PartsRequestItemsEditor
            items={form.items}
            onChange={(items) => setForm({ ...form, items })}
            onAddItem={addItem}
          />
        </div>
        <button type="submit" className="block rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white">
          Simpan Request
        </button>
      </form>
      )}

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left">No Request</th>
              <th className="px-4 py-3 text-left">Pemohon</th>
              <th className="px-4 py-3 text-left">WO</th>
              <th className="px-4 py-3 text-left">Workshop</th>
              <th className="px-4 py-3 text-left">Items</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {requests?.data.map((r) => {
              const canEdit = canEditPartsRequest(r, user, canUpdate, canEditAny);
              const canDel = canDeletePartsRequest(r, user, canDelete, canDeleteAny);
              const canSubmitRow = canSubmitPartsRequest(r, user, can(Permission.PARTS_SUBMIT));
              const canApproveRow = canSupervisorApprovePartsRequest(r, canSupervisor);
              const canLogisticCheck = can(Permission.PARTS_LOGISTIC) && r.status === 'approved';
              const canLogisticTaken =
                can(Permission.PARTS_LOGISTIC) && ['approved', 'logistic_check'].includes(r.status);
              const hasActions =
                canEdit ||
                canDel ||
                canSubmitRow ||
                canApproveRow ||
                canLogisticCheck ||
                canLogisticTaken;

              return (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-3">{r.request_number}</td>
                  <td className="px-4 py-3">{r.creator?.name ?? '—'}</td>
                  <td className="px-4 py-3">{r.work_order?.wo_number}</td>
                  <td className="px-4 py-3 capitalize">{r.workshop}</td>
                  <td className="px-4 py-3">{r.items?.length} item(s)</td>
                  <td className="px-4 py-3"><Badge status={r.status} /></td>
                  <td className="px-4 py-3">
                    {hasActions ? (
                      <div className="flex flex-wrap justify-end gap-1">
                        {canSubmitRow && (
                          <button
                            type="button"
                            disabled={busyId === r.id}
                            onClick={() => submitRequest(r)}
                            className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                          >
                            {busyId === r.id ? 'Mengajukan…' : 'Ajukan'}
                          </button>
                        )}
                        {canApproveRow && (
                          <>
                            <button
                              type="button"
                              onClick={() => supervisorAction(r, 'approve')}
                              className="rounded px-2 py-1 text-xs font-medium text-green-600 hover:bg-green-50"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => supervisorAction(r, 'reject')}
                              className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {canLogisticCheck && (
                          <button
                            type="button"
                            onClick={() => logisticProcess(r.id, 'check')}
                            className="rounded px-2 py-1 text-xs text-cyan-600 hover:bg-cyan-50"
                          >
                            Cek
                          </button>
                        )}
                        {canLogisticTaken && (
                          <button
                            type="button"
                            onClick={() => logisticProcess(r.id, 'taken')}
                            className="rounded px-2 py-1 text-xs text-green-600 hover:bg-green-50"
                          >
                            Diambil
                          </button>
                        )}
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => openEdit(r)}
                            className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
                            title="Edit parts request"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        {canDel && (
                          <button
                            type="button"
                            onClick={() => removeRequest(r)}
                            className="rounded p-1.5 text-red-500 hover:bg-red-50"
                            title="Hapus parts request"
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
            })}
          </tbody>
        </table>
      </div>

      {editingRequest && (
        <EditPartsRequestModal
          request={editingRequest}
          woList={woList}
          onClose={() => setEditingRequest(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
