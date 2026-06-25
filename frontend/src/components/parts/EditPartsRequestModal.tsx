'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '@/lib/api';
import { PartsRequestItemsEditor } from '@/components/parts/PartsRequestItemsEditor';
import type { PartsRequest, PartsRequestItem, WorkOrder } from '@/lib/types';

const emptyItem = (): PartsRequestItem => ({
  part_name: '',
  part_number: '',
  qty: 1,
  unit: 'pcs',
  in_stock: true,
  unit_cost: 0,
});

type Props = {
  request: PartsRequest;
  woList: WorkOrder[];
  onClose: () => void;
  onSaved: () => void;
};

export function EditPartsRequestModal({ request, woList, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    work_order_id: String(request.work_order_id),
    workshop: request.workshop,
    notes: request.notes || '',
    items: request.items?.length ? [...request.items] : [emptyItem()],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setForm({
      work_order_id: String(request.work_order_id),
      workshop: request.workshop,
      notes: request.notes || '',
      items: request.items?.length ? request.items.map((i) => ({ ...i })) : [emptyItem()],
    });
    setError('');
  }, [request]);

  const ic =
    'w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200';

  const addItem = () => {
    setForm({ ...form, items: [...form.items, emptyItem()] });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api(`/parts-requests/${request.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          work_order_id: Number(form.work_order_id),
          workshop: form.workshop,
          notes: form.notes || null,
          items: form.items,
        }),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan perubahan');
    } finally {
      setSaving(false);
    }
  };

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
        aria-labelledby="edit-parts-title"
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 id="edit-parts-title" className="text-lg font-bold text-slate-900">
              Edit Parts Request
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {request.request_number} · status {request.status}
              {['approved', 'logistic_check', 'taken'].includes(request.status) &&
                ' · perubahan item memperbarui ringkasan WO'}
            </p>
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

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Work Order</label>
                <select
                  className={ic}
                  value={form.work_order_id}
                  onChange={(e) => setForm({ ...form, work_order_id: e.target.value })}
                  required
                >
                  <option value="">Pilih WO</option>
                  {woList.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.wo_number} — {w.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Workshop</label>
                <select
                  className={ic}
                  value={form.workshop}
                  onChange={(e) => setForm({ ...form, workshop: e.target.value })}
                >
                  <option value="rebuild">Rebuild</option>
                  <option value="fabrication">Fabrication</option>
                  <option value="support">Support</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium text-slate-700">Catatan (opsional)</label>
                <input
                  className={ic}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>

            <h4 className="font-medium text-slate-800">Items</h4>
            <div className="overflow-x-auto">
              <PartsRequestItemsEditor
                items={form.items}
                onChange={(items) => setForm({ ...form, items })}
                onAddItem={addItem}
                inputClass={ic}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-orange-600 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
            >
              {saving ? 'Menyimpan…' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
