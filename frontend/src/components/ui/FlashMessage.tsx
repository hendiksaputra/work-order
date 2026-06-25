'use client';

import { useEffect } from 'react';
import { CheckCircle2, X, XCircle } from 'lucide-react';

export type FlashVariant = 'success' | 'error';

export function FlashMessage({
  variant,
  message,
  onDismiss,
  autoHideMs = 5000,
}: {
  variant: FlashVariant;
  message: string;
  onDismiss: () => void;
  autoHideMs?: number;
}) {
  useEffect(() => {
    if (autoHideMs <= 0) return;
    const timer = window.setTimeout(onDismiss, autoHideMs);
    return () => window.clearTimeout(timer);
  }, [message, autoHideMs, onDismiss]);

  const styles =
    variant === 'success'
      ? 'border-green-200 bg-green-50 text-green-800'
      : 'border-red-200 bg-red-50 text-red-800';

  const Icon = variant === 'success' ? CheckCircle2 : XCircle;

  return (
    <div
      role="alert"
      className={`mb-4 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${styles}`}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <p className="flex-1 font-medium">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded p-1 opacity-70 hover:opacity-100"
        aria-label="Tutup pesan"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function workOrderFeedbackMessage(err: unknown, fallback: string): string {
  const msg = err instanceof Error ? err.message : fallback;
  const lower = msg.toLowerCase();
  if (
    lower.includes('not found') ||
    lower.includes('no query results') ||
    lower.includes('tidak ditemukan')
  ) {
    return 'Work Order sudah dihapus atau tidak ditemukan.';
  }
  return msg;
}
