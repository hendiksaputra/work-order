'use client';

import { AlertTriangle, HelpCircle, Info, X } from 'lucide-react';

type ConfirmVariant = 'info' | 'warning' | 'question';

const variantStyles: Record<
  ConfirmVariant,
  { icon: typeof HelpCircle; iconBg: string; iconColor: string; confirmBtn: string }
> = {
  question: {
    icon: HelpCircle,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    confirmBtn: 'bg-blue-600 hover:bg-blue-700',
  },
  info: {
    icon: Info,
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-600',
    confirmBtn: 'bg-slate-800 hover:bg-slate-900',
  },
  warning: {
    icon: AlertTriangle,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    confirmBtn: 'bg-amber-600 hover:bg-amber-700',
  },
};

export function ConfirmAlert({
  open,
  title,
  message,
  confirmLabel = 'Ya, lanjutkan',
  cancelLabel = 'Batal',
  variant = 'question',
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  const styles = variantStyles[variant];
  const Icon = styles.icon;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-alert-title"
        aria-describedby="confirm-alert-message"
      >
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
          aria-label="Tutup"
        >
          <X className="h-5 w-5" />
        </button>

        <div
          className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${styles.iconBg}`}
        >
          <Icon className={`h-7 w-7 ${styles.iconColor}`} aria-hidden />
        </div>

        <h3 id="confirm-alert-title" className="mt-4 text-lg font-bold text-slate-900">
          {title}
        </h3>
        <p id="confirm-alert-message" className="mt-2 whitespace-pre-line text-sm text-slate-600">
          {message}
        </p>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60 ${styles.confirmBtn}`}
          >
            {loading ? 'Memproses…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
