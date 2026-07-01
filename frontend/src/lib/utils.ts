import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending_supervisor: 'Menunggu Supervisor',
  approved: 'Disetujui',
  in_execution: 'Eksekusi',
  qc_pending: 'QC Pending',
  qc_approved: 'QC Approved',
  closed: 'Closed',
  rejected: 'Ditolak',
  pending_approval: 'Menunggu Approval',
  logistic_check: 'Cek Logistic',
  taken: 'Diambil',
};

export const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  pending_supervisor: 'bg-amber-100 text-amber-800',
  pending_approval: 'bg-amber-100 text-amber-800',
  approved: 'bg-blue-100 text-blue-800',
  in_execution: 'bg-indigo-100 text-indigo-800',
  qc_pending: 'bg-purple-100 text-purple-800',
  qc_approved: 'bg-teal-100 text-teal-800',
  closed: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  logistic_check: 'bg-cyan-100 text-cyan-800',
  taken: 'bg-green-100 text-green-800',
};

export function formatDate(d?: string | null) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Jam desimal (1.3 = 78 mnt) → tampilan jam.menit, mis. 1.18 h */
export function formatDecimalHours(hours?: number | string | null): string {
  const totalMinutes = Math.round((Number(hours) || 0) * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}.${String(m).padStart(2, '0')} h`;
}
