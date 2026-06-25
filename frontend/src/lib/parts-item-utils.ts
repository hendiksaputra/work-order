import type { PartsRequestItem } from './types';

/** Tampilkan kosong di input number agar user bisa menghapus angka lalu mengetik ulang. */
export function partsNumberInputDisplay(value: number): number | '' {
  return value === 0 ? '' : value;
}

export function partsNumberInputParse(raw: string): number {
  if (raw === '') return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function partsItemLineTotal(item: PartsRequestItem): number {
  const qty = Number(item.qty) || 0;
  const price = Number(item.unit_cost) || 0;

  return qty * price;
}

export function partsItemsGrandTotal(items: PartsRequestItem[]): number {
  return items.reduce((sum, item) => sum + partsItemLineTotal(item), 0);
}

export function formatPartsCurrency(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
