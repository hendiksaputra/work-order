'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: (notes: string) => void;
  onCancel: () => void;
};

export function RejectReasonDialog({
  open,
  title,
  message,
  confirmLabel = 'Ya, Tolak',
  cancelLabel = 'Batal',
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setNotes('');
      setError('');
    }
  }, [open]);

  if (!open) return null;

  const handleConfirm = () => {
    const trimmed = notes.trim();
    if (trimmed.length < 3) {
      setError('Alasan penolakan wajib diisi (minimal 3 karakter).');
      return;
    }
    onConfirm(trimmed);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="reject-reason-title"
        aria-describedby="reject-reason-message"
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

        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
          <AlertTriangle className="h-7 w-7 text-red-600" aria-hidden />
        </div>

        <h3 id="reject-reason-title" className="mt-4 text-center text-lg font-bold text-slate-900">
          {title}
        </h3>
        <p id="reject-reason-message" className="mt-2 text-center text-sm text-slate-600">
          {message}
        </p>

        <div className="mt-4 text-left">
          <label htmlFor="reject-reason-notes" className="text-sm font-medium text-slate-700">
            Alasan penolakan <span className="text-red-600">*</span>
          </label>
          <textarea
            id="reject-reason-notes"
            rows={3}
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              if (error) setError('');
            }}
            placeholder="Contoh: jam tidak sesuai, WO salah, aktivitas tidak valid…"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
            disabled={loading}
          />
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>

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
            onClick={handleConfirm}
            disabled={loading}
            className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {loading ? 'Memproses…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
