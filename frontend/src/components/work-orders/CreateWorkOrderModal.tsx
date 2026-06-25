'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '@/lib/api';
import { OitmExUnitSearch } from '@/components/work-orders/OitmExUnitSearch';
import type { WorkOrder, WorkOrderApiResult } from '@/lib/types';
import { workOrderFeedbackMessage } from '@/components/ui/FlashMessage';
import { useAuth } from '@/lib/auth-context';
import { Permission } from '@/lib/permissions';
import { canCreateMainWorkOrder, canCreateSubWorkOrder, canEditWorkOrderManpowerFields } from '@/lib/work-order-access';
import { confirmWorkOrderApprove } from '@/components/work-orders/WorkOrderWorkflowActions';

const initialForm = {
  main_category: 'component',
  parent_id: '',
  workshop: 'rebuild',
  title: '',
  description: '',
  component_name: '',
  component_serial: '',
  unit_model: '',
  unit_number: '',
  location: '',
  manpower_count: 1,
  estimated_hours: 0,
  target_hours: 0,
};

type WoForm = typeof initialForm;

function formFromWorkOrder(wo: WorkOrder): WoForm {
  return {
    main_category: wo.main_category || 'component',
    parent_id: wo.parent_id ? String(wo.parent_id) : '',
    workshop: wo.workshop || 'rebuild',
    title: wo.title || '',
    description: wo.description || '',
    component_name: wo.component_name || '',
    component_serial: wo.component_serial || '',
    unit_model: wo.unit_model || '',
    unit_number: wo.unit_number || '',
    location: wo.location || '',
    manpower_count: wo.manpower_count ?? 1,
    estimated_hours: Number(wo.estimated_hours) || 0,
    target_hours: Number(wo.target_hours) || 0,
  };
}

function buildUpdatePayload(
  form: WoForm,
  woType: 'main' | 'sub',
  mainCategory: string,
  includeManpowerFields: boolean
) {
  const payload: Record<string, unknown> = {
    title: form.title,
    description: form.description || null,
    target_hours: form.target_hours || null,
    component_name: null,
    component_serial: null,
    unit_model: null,
    unit_number: null,
    location: null,
  };

  if (includeManpowerFields) {
    payload.manpower_count = form.manpower_count;
    payload.estimated_hours = form.estimated_hours;
  }

  if (woType === 'main') {
    if (mainCategory === 'component') {
      payload.component_name = form.component_name;
      payload.component_serial = form.component_serial || null;
      payload.unit_model = form.unit_model || null;
      payload.unit_number = form.unit_number || null;
    } else if (mainCategory === 'unit') {
      payload.unit_model = form.unit_model || null;
      payload.unit_number = form.unit_number || null;
    } else {
      payload.location = form.location || null;
    }
  }

  return payload;
}


export function CreateWorkOrderModal({
  open,
  onClose,
  onCreated,
  onCreatedAndApproved,
  workOrder,
  onUpdated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (wo: WorkOrder) => void;
  onCreatedAndApproved?: (wo: WorkOrderApiResult) => void;
  workOrder?: WorkOrder | null;
  onUpdated?: (wo: WorkOrder) => void;
}) {
  const { user, can } = useAuth();
  const canApprove = can(Permission.WORK_ORDERS_APPROVE);
  const canCreateMain = canCreateMainWorkOrder(can);
  const canCreateSub = canCreateSubWorkOrder(can);
  const canEditManpowerFields = canEditWorkOrderManpowerFields(
    user,
    can(Permission.WORK_ORDERS_APPROVE)
  );
  const isEdit = Boolean(workOrder);
  const [woType, setWoType] = useState<'main' | 'sub'>('main');
  const [mainList, setMainList] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(initialForm);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!open) return;
    if (workOrder) {
      setWoType(workOrder.type);
      setForm(formFromWorkOrder(workOrder));
    } else {
      setWoType(canCreateMain ? 'main' : 'sub');
      setForm(initialForm);
    }
  }, [open, workOrder, canCreateMain]);

  useEffect(() => {
    if (open && (woType === 'sub' || workOrder?.type === 'sub')) {
      api<WorkOrder[]>('/work-orders/main-list').then(setMainList);
    }
  }, [open, woType, workOrder?.type]);

  if (!open) return null;

  const buildCreatePayload = (): Record<string, unknown> => {
    const payload: Record<string, unknown> = {
      type: woType,
      title: form.title,
      description: form.description,
      target_hours: form.target_hours || null,
    };
    if (canEditManpowerFields) {
      payload.manpower_count = form.manpower_count;
      payload.estimated_hours = form.estimated_hours;
    }
    if (woType === 'main') {
      payload.main_category = form.main_category;
      if (form.main_category === 'component') {
        payload.component_name = form.component_name;
        payload.component_serial = form.component_serial;
        payload.unit_model = form.unit_model;
        payload.unit_number = form.unit_number;
      } else if (form.main_category === 'unit') {
        payload.unit_model = form.unit_model;
        payload.unit_number = form.unit_number;
      } else {
        payload.location = form.location;
      }
    } else {
      payload.parent_id = Number(form.parent_id);
      payload.workshop = form.workshop;
    }
    return payload;
  };

  const createWorkOrder = async (): Promise<WorkOrder> => {
    return api<WorkOrder>('/work-orders', {
      method: 'POST',
      body: JSON.stringify(buildCreatePayload()),
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit && workOrder) {
        const wo = await api<WorkOrder>(`/work-orders/${workOrder.id}`, {
          method: 'PUT',
          body: JSON.stringify(
            buildUpdatePayload(
              form,
              workOrder.type,
              workOrder.main_category || form.main_category,
              canEditManpowerFields
            )
          ),
        });
        onUpdated?.(wo);
        onClose();
        return;
      }

      const wo = await createWorkOrder();
      onCreated?.(wo);
      onClose();
    } catch (err) {
      alert(
        workOrderFeedbackMessage(
          err,
          isEdit ? 'Gagal menyimpan Work Order' : 'Gagal membuat Work Order'
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const createAndApprove = async () => {
    if (!formRef.current?.reportValidity()) return;
    setLoading(true);
    try {
      const wo = await createWorkOrder();
      if (!confirmWorkOrderApprove(wo)) {
        onCreated?.(wo);
        onClose();
        return;
      }
      const updated = await api<WorkOrderApiResult>(`/work-orders/${wo.id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ action: 'approve' }),
      });
      onCreatedAndApproved?.(updated);
      onClose();
    } catch (err) {
      alert(workOrderFeedbackMessage(err, 'Gagal membuat atau menyetujui Work Order'));
    } finally {
      setLoading(false);
    }
  };

  const lockedCategory = isEdit ? workOrder?.main_category || form.main_category : form.main_category;
  const parentMain = mainList.find((m) => String(m.id) === form.parent_id);

  const inputClass =
    'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-wo-title"
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 id="create-wo-title" className="text-lg font-bold text-slate-900">
              {isEdit ? 'Edit Work Order' : 'Create Work Order'}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {isEdit
                ? `${workOrder?.wo_number} · hanya WO draft/ditolak yang dapat diubah`
                : 'Main WO atau Sub WO terhubung ke Main WO'}
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

        <form ref={formRef} onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {isEdit ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <p>
                <span className="font-medium">Tipe:</span>{' '}
                {woType === 'main' ? 'Main WO' : 'Sub WO'}
                {woType === 'main' && lockedCategory && (
                  <>
                    {' '}
                    · <span className="font-medium">Kategori:</span> {lockedCategory}
                  </>
                )}
                {woType === 'sub' && (
                  <>
                    {' '}
                    · <span className="font-medium">Workshop:</span> {form.workshop}
                    {parentMain && (
                      <>
                        {' '}
                        · <span className="font-medium">Main WO:</span> {parentMain.wo_number}
                      </>
                    )}
                  </>
                )}
              </p>
            </div>
          ) : (
            <>
              <div>
                <label className="text-sm font-medium text-slate-700">Work Order Type</label>
                <div className="mt-2 flex gap-4">
                  {canCreateMain && (
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="radio"
                        checked={woType === 'main'}
                        onChange={() => setWoType('main')}
                      />
                      Main WO
                    </label>
                  )}
                  {canCreateSub && (
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="radio"
                        checked={woType === 'sub'}
                        onChange={() => setWoType('sub')}
                      />
                      Sub WO
                    </label>
                  )}
                </div>
              </div>

              {woType === 'main' ? (
                <>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Kategori Main WO</label>
                    <select
                      value={form.main_category}
                      onChange={(e) => setForm({ ...form, main_category: e.target.value })}
                      className={inputClass}
                    >
                      <option value="component">Component</option>
                      <option value="unit">Unit</option>
                      <option value="other">Other (standalone, tanpa sub WO)</option>
                    </select>
                  </div>
                  {form.main_category === 'component' && (
                    <ComponentFieldsTable form={form} setForm={setForm} />
                  )}
                  {form.main_category === 'unit' && (
                    <UnitFieldsTable form={form} setForm={setForm} />
                  )}
                  {form.main_category === 'other' && (
                    <FormField
                      label="Lokasi / Keterangan"
                      value={form.location}
                      onChange={(v) => setForm({ ...form, location: v })}
                      className={inputClass}
                    />
                  )}
                </>
              ) : (
                <>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Pilih Main WO</label>
                    <select
                      value={form.parent_id}
                      onChange={(e) => setForm({ ...form, parent_id: e.target.value })}
                      className={inputClass}
                      required
                    >
                      <option value="">-- Pilih Main WO --</option>
                      {mainList.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.wo_number} — {m.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Workshop</label>
                    <select
                      value={form.workshop}
                      onChange={(e) => setForm({ ...form, workshop: e.target.value })}
                      className={inputClass}
                    >
                      <option value="rebuild">Rebuild</option>
                      <option value="fabrication">Fabrication</option>
                      <option value="support">Support</option>
                    </select>
                  </div>
                </>
              )}
            </>
          )}

          {isEdit && woType === 'main' && lockedCategory === 'component' && (
            <ComponentFieldsTable form={form} setForm={setForm} />
          )}
          {isEdit && woType === 'main' && lockedCategory === 'unit' && (
            <UnitFieldsTable form={form} setForm={setForm} />
          )}
          {isEdit && woType === 'main' && lockedCategory === 'other' && (
            <FormField
              label="Lokasi / Keterangan"
              value={form.location}
              onChange={(v) => setForm({ ...form, location: v })}
              className={inputClass}
            />
          )}

          {!(woType === 'main' && (lockedCategory === 'component' || lockedCategory === 'unit')) && (
            <FormField
              label="Judul Pekerjaan"
              value={form.title}
              onChange={(v) => setForm({ ...form, title: v })}
              className={inputClass}
              required
            />
          )}
          <div>
            <label className="text-sm font-medium text-slate-700">Deskripsi</label>
            <textarea
              className={inputClass}
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="Jumlah Man Power"
              type="number"
              value={String(form.manpower_count)}
              onChange={(v) => setForm({ ...form, manpower_count: Number(v) })}
              className={
                canEditManpowerFields
                  ? inputClass
                  : `${inputClass} cursor-not-allowed bg-slate-50 text-slate-600`
              }
              readOnly={!canEditManpowerFields}
              hint={
                !canEditManpowerFields
                  ? 'Diisi oleh Supervisor Workshop'
                  : undefined
              }
            />
            <FormField
              label="Estimasi Jam Kerja"
              type="number"
              value={String(form.estimated_hours)}
              onChange={(v) => setForm({ ...form, estimated_hours: Number(v) })}
              className={
                canEditManpowerFields
                  ? inputClass
                  : `${inputClass} cursor-not-allowed bg-slate-50 text-slate-600`
              }
              readOnly={!canEditManpowerFields}
              hint={
                !canEditManpowerFields
                  ? 'Diisi oleh Supervisor Workshop'
                  : undefined
              }
            />
          </div>
          </div>

          <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-slate-200 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Batal
            </button>
            {!isEdit && canApprove && (
              <button
                type="button"
                disabled={loading}
                onClick={createAndApprove}
                className="rounded-lg bg-green-600 px-6 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
              >
                {loading ? 'Memproses...' : 'Setujui WO'}
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-orange-600 px-6 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
            >
              {loading ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Simpan Draft WO'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type ComponentForm = typeof initialForm;

type CategoryRow = {
  label: string;
  key: keyof ComponentForm;
  required?: boolean;
  inputType?: 'text' | 'ex-unit-search';
  readonly?: boolean;
  readonlyPlaceholder?: string;
};

const COMPONENT_ROWS: CategoryRow[] = [
  { label: 'Ex Unit', key: 'unit_number', inputType: 'ex-unit-search' },
  { label: 'Unit Model', key: 'unit_model', readonlyPlaceholder: 'Otomatis saat pilih Ex Unit, atau ketik manual' },
  { label: 'Description Comp', key: 'component_name', required: true },
  { label: 'Serial No APS', key: 'component_serial' },
  { label: 'Job Description', key: 'title', required: true },
];

const UNIT_ROWS: CategoryRow[] = [
  { label: 'Unit', key: 'unit_number', inputType: 'ex-unit-search', required: true },
  { label: 'Unit Model', key: 'unit_model', readonlyPlaceholder: 'Otomatis saat pilih Unit, atau ketik manual' },
  { label: 'Job Description', key: 'title', required: true },
];

function CategoryFieldsTable({
  sectionTitle,
  rows,
  form,
  setForm,
  onExUnitSelect,
  onExUnitManual,
  onExUnitClear,
}: {
  sectionTitle: string;
  rows: CategoryRow[];
  form: ComponentForm;
  setForm: React.Dispatch<React.SetStateAction<ComponentForm>>;
  onExUnitSelect?: (unitNo: string, unitModel: string) => void;
  onExUnitManual?: (unitNo: string) => void;
  onExUnitClear?: () => void;
}) {
  const cellInput =
    'min-w-0 flex-1 border-0 bg-transparent px-1 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0';
  const cellReadonly =
    'min-w-0 flex-1 cursor-default border-0 bg-slate-50 px-1 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-0';
  return (
    <div>
      <p className="mb-2 text-sm font-bold text-slate-900">{sectionTitle}</p>
      <table className="w-full border-collapse border border-slate-900 text-sm">
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td className="w-[38%] border border-slate-900 bg-white px-3 py-1.5 align-middle font-medium text-slate-800">
                {row.label}
              </td>
              <td className="border border-slate-900 bg-white align-middle">
                <div className="flex items-center gap-0">
                  <span className="shrink-0 pl-2 font-medium text-slate-700">:</span>
                  {row.inputType === 'ex-unit-search' &&
                  onExUnitSelect &&
                  onExUnitManual &&
                  onExUnitClear ? (
                    <OitmExUnitSearch
                      unitNo={form.unit_number}
                      onSelect={onExUnitSelect}
                      onManualInput={onExUnitManual}
                      onClear={onExUnitClear}
                      required={row.required}
                      className={cellInput}
                    />
                  ) : (
                    <input
                      type="text"
                      className={row.readonly ? cellReadonly : cellInput}
                      value={String(form[row.key])}
                      onChange={(e) => setForm({ ...form, [row.key]: e.target.value })}
                      required={row.required}
                      readOnly={row.readonly}
                      placeholder={row.readonlyPlaceholder}
                    />
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ComponentFieldsTable({
  form,
  setForm,
}: {
  form: ComponentForm;
  setForm: React.Dispatch<React.SetStateAction<ComponentForm>>;
}) {
  const handleExUnitSelect = useCallback(
    (unitNo: string, unitModel: string) => {
      setForm((prev) => ({ ...prev, unit_number: unitNo, unit_model: unitModel }));
    },
    [setForm]
  );

  const handleExUnitManual = useCallback(
    (unitNo: string) => {
      setForm((prev) => ({ ...prev, unit_number: unitNo }));
    },
    [setForm]
  );

  const handleExUnitClear = useCallback(() => {
    setForm((prev) => ({ ...prev, unit_number: '', unit_model: '' }));
  }, [setForm]);

  return (
    <CategoryFieldsTable
      sectionTitle="Component"
      rows={COMPONENT_ROWS}
      form={form}
      setForm={setForm}
      onExUnitSelect={handleExUnitSelect}
      onExUnitManual={handleExUnitManual}
      onExUnitClear={handleExUnitClear}
    />
  );
}

function UnitFieldsTable({
  form,
  setForm,
}: {
  form: ComponentForm;
  setForm: React.Dispatch<React.SetStateAction<ComponentForm>>;
}) {
  const handleUnitSelect = useCallback(
    (unitNo: string, unitModel: string) => {
      setForm((prev) => ({ ...prev, unit_number: unitNo, unit_model: unitModel }));
    },
    [setForm]
  );

  const handleUnitManual = useCallback(
    (unitNo: string) => {
      setForm((prev) => ({ ...prev, unit_number: unitNo }));
    },
    [setForm]
  );

  const handleUnitClear = useCallback(() => {
    setForm((prev) => ({ ...prev, unit_number: '', unit_model: '' }));
  }, [setForm]);

  return (
    <CategoryFieldsTable
      sectionTitle="Unit"
      rows={UNIT_ROWS}
      form={form}
      setForm={setForm}
      onExUnitSelect={handleUnitSelect}
      onExUnitManual={handleUnitManual}
      onExUnitClear={handleUnitClear}
    />
  );
}

function FormField({
  label,
  value,
  onChange,
  className,
  type = 'text',
  required,
  readOnly,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className: string;
  type?: string;
  required?: boolean;
  readOnly?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <input
        type={type}
        className={className}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        readOnly={readOnly}
        tabIndex={readOnly ? -1 : undefined}
      />
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
