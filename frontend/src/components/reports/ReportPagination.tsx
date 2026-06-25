'use client';

import { Pagination } from '@/components/ui/Pagination';

/** Pagination standar untuk setiap blok/kategori di halaman Reports. */
export function ReportPagination({
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

  return (
    <Pagination
      page={page}
      lastPage={lastPage}
      total={total}
      perPage={perPage}
      onPageChange={onPageChange}
      onPerPageChange={onPerPageChange}
    />
  );
}
