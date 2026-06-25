'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Pagination({
  page,
  lastPage,
  total,
  perPage,
  onPageChange,
  onPerPageChange,
}: {
  page: number;
  lastPage: number;
  total: number;
  perPage: number;
  onPageChange: (page: number) => void;
  onPerPageChange?: (perPage: number) => void;
}) {
  if (total === 0) {
    return null;
  }

  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  const pageNumbers = buildPageNumbers(page, lastPage);

  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-600">
        Menampilkan <span className="font-medium text-slate-900">{from}</span>–
        <span className="font-medium text-slate-900">{to}</span> dari{' '}
        <span className="font-medium text-slate-900">{total}</span> data
      </p>

      <div className="flex flex-wrap items-center gap-3">
        {onPerPageChange && (
          <label className="flex items-center gap-2 text-sm text-slate-600">
            Per halaman
            <select
              value={perPage}
              onChange={(e) => onPerPageChange(Number(e.target.value))}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}

        <nav className="flex items-center gap-1" aria-label="Pagination">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </button>

          {pageNumbers.map((item, idx) =>
            item === '...' ? (
              <span key={`ellipsis-${idx}`} className="px-2 text-slate-400">
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item)}
                className={`min-w-[2.25rem] rounded-lg border px-2 py-1.5 text-sm font-medium ${
                  item === page
                    ? 'border-orange-600 bg-orange-600 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                }`}
              >
                {item}
              </button>
            )
          )}

          <button
            type="button"
            disabled={page >= lastPage}
            onClick={() => onPageChange(page + 1)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </nav>
      </div>
    </div>
  );
}

function buildPageNumbers(current: number, last: number): (number | '...')[] {
  if (last <= 7) {
    return Array.from({ length: last }, (_, i) => i + 1);
  }

  const pages: (number | '...')[] = [1];

  if (current > 3) {
    pages.push('...');
  }

  const start = Math.max(2, current - 1);
  const end = Math.min(last - 1, current + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (current < last - 2) {
    pages.push('...');
  }

  pages.push(last);

  return pages;
}
