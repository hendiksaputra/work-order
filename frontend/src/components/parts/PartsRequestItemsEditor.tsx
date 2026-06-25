'use client';

import type { PartsRequestItem } from '@/lib/types';
import {
  formatPartsCurrency,
  partsItemLineTotal,
  partsItemsGrandTotal,
  partsNumberInputDisplay,
  partsNumberInputParse,
} from '@/lib/parts-item-utils';

const GRID =
  'grid grid-cols-[minmax(120px,2fr)_minmax(80px,1fr)_72px_64px_72px_minmax(90px,1fr)_minmax(100px,1fr)] gap-2';

type Props = {
  items: PartsRequestItem[];
  onChange: (items: PartsRequestItem[]) => void;
  onAddItem: () => void;
  inputClass?: string;
};

export function PartsRequestItemsEditor({ items, onChange, onAddItem, inputClass }: Props) {
  const ic =
    inputClass ||
    'w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200';

  const updateItem = (idx: number, patch: Partial<PartsRequestItem>) => {
    const next = [...items];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  const grandTotal = partsItemsGrandTotal(items);

  return (
    <div className="space-y-2">
      <div className={`${GRID} px-3 text-xs font-semibold text-slate-600`}>
        <span>Nama part</span>
        <span>Part no</span>
        <span>Qty</span>
        <span>Unit</span>
        <span className="text-center">Stock</span>
        <span>Harga</span>
        <span>Total harga</span>
      </div>

      {items.map((item, idx) => {
        const lineTotal = partsItemLineTotal(item);
        return (
          <div key={idx} className={`${GRID} items-center rounded-lg bg-slate-50 p-3`}>
            <input
              placeholder="Nama part"
              className={ic}
              value={item.part_name}
              onChange={(e) => updateItem(idx, { part_name: e.target.value })}
              required
            />
            <input
              placeholder="Part no"
              className={ic}
              value={item.part_number || ''}
              onChange={(e) => updateItem(idx, { part_number: e.target.value })}
            />
            <input
              type="number"
              min={0}
              step="any"
              placeholder="0"
              className={ic}
              value={partsNumberInputDisplay(item.qty)}
              onChange={(e) => updateItem(idx, { qty: partsNumberInputParse(e.target.value) })}
            />
            <input
              placeholder="pcs"
              className={ic}
              value={item.unit}
              onChange={(e) => updateItem(idx, { unit: e.target.value })}
            />
            <label className="flex items-center justify-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={item.in_stock}
                onChange={(e) => updateItem(idx, { in_stock: e.target.checked })}
              />
              <span className="sr-only">In stock</span>
            </label>
            <input
              type="number"
              min={0}
              step="any"
              placeholder="0"
              className={ic}
              value={partsNumberInputDisplay(item.unit_cost)}
              onChange={(e) => updateItem(idx, { unit_cost: partsNumberInputParse(e.target.value) })}
              title="Harga satuan (Rp)"
            />
            <input
              type="text"
              readOnly
              tabIndex={-1}
              className={`${ic} cursor-default bg-slate-100 text-slate-700`}
              value={formatPartsCurrency(lineTotal)}
              title="Qty × Harga"
              aria-label={`Total harga baris ${idx + 1}`}
            />
          </div>
        );
      })}

      <div className="flex flex-wrap items-center justify-between gap-3 px-1 pt-1">
        <button type="button" onClick={onAddItem} className="text-sm font-medium text-orange-600 hover:text-orange-700">
          + Tambah item
        </button>
        <p className="text-sm font-semibold text-slate-800">
          Total keseluruhan:{' '}
          <span className="text-orange-700">{formatPartsCurrency(grandTotal)}</span>
        </p>
      </div>
    </div>
  );
}
