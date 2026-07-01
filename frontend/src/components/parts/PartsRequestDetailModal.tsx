'use client';

import { X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import type { PartsRequest } from '@/lib/types';
import {
  formatPartsCurrency,
  partsItemLineTotal,
  partsItemsGrandTotal,
} from '@/lib/parts-item-utils';

function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{value}</dd>
    </div>
  );
}

type Props = {
  request: PartsRequest;
  onClose: () => void;
};

export function PartsRequestDetailModal({ request, onClose }: Props) {
  const wo = request.work_order;
  const grandTotal = partsItemsGrandTotal(request.items ?? []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="parts-detail-title"
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="parts-detail-title" className="text-lg font-bold text-slate-900">
                {request.request_number}
              </h2>
              <Badge status={request.status} />
            </div>
            <p className="mt-0.5 text-sm text-slate-500">Detail permintaan parts & consumable</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Tutup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <DetailField label="Pemohon" value={request.creator?.name ?? '—'} />
            <DetailField
              label="Work Order"
              value={
                wo ? (
                  <span>
                    {wo.wo_number}
                    {wo.title ? (
                      <span className="block text-xs text-slate-500">{wo.title}</span>
                    ) : null}
                  </span>
                ) : (
                  '—'
                )
              }
            />
            <DetailField label="Workshop" value={<span className="capitalize">{request.workshop}</span>} />
            <DetailField label="Dibuat" value={formatDateTime(request.created_at)} />
            <DetailField
              label="Disetujui supervisor"
              value={
                request.approver?.name
                  ? `${request.approver.name}${request.approved_at ? ` · ${formatDateTime(request.approved_at)}` : ''}`
                  : '—'
              }
            />
            <DetailField label="Diproses logistic" value={request.logistic_user?.name ?? '—'} />
          </dl>

          {request.notes && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Catatan pemohon</p>
              <p className="mt-1 whitespace-pre-wrap">{request.notes}</p>
            </div>
          )}

          {request.supervisor_notes && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              <p className="text-xs font-medium uppercase tracking-wide text-amber-700">Catatan supervisor</p>
              <p className="mt-1 whitespace-pre-wrap">{request.supervisor_notes}</p>
            </div>
          )}

          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-800">Items ({request.items?.length ?? 0})</h3>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Nama part</th>
                    <th className="px-3 py-2">Part no</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2">Unit</th>
                    <th className="px-3 py-2 text-center">Stock</th>
                    <th className="px-3 py-2 text-right">Harga</th>
                    <th className="px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(request.items ?? []).map((item, idx) => (
                    <tr key={item.id ?? idx} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-medium text-slate-900">{item.part_name}</td>
                      <td className="px-3 py-2 text-slate-600">{item.part_number || '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{item.qty}</td>
                      <td className="px-3 py-2 text-slate-600">{item.unit}</td>
                      <td className="px-3 py-2 text-center">
                        {item.in_stock ? (
                          <span className="text-green-700">Ya</span>
                        ) : (
                          <span className="font-medium text-amber-700">Outstanding</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                        {formatPartsCurrency(item.unit_cost)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium text-slate-900">
                        {formatPartsCurrency(partsItemLineTotal(item))}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-slate-200 bg-slate-50">
                  <tr>
                    <td colSpan={6} className="px-3 py-2 text-right text-sm font-semibold text-slate-700">
                      Total keseluruhan
                    </td>
                    <td className="px-3 py-2 text-right text-sm font-bold text-orange-700">
                      {formatPartsCurrency(grandTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
