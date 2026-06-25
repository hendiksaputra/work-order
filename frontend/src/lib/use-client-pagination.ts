import { useEffect, useMemo, useState } from 'react';

const DEFAULT_PER_PAGE = 10;

export function useClientPagination<T>(items: T[], initialPerPage = DEFAULT_PER_PAGE) {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(initialPerPage);

  const total = items.length;
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, lastPage);

  useEffect(() => {
    if (page > lastPage) {
      setPage(lastPage);
    }
  }, [page, lastPage]);

  const slice = useMemo(() => {
    const start = (safePage - 1) * perPage;
    return items.slice(start, start + perPage);
  }, [items, safePage, perPage]);

  const handlePerPageChange = (next: number) => {
    setPerPage(next);
    setPage(1);
  };

  return {
    page: safePage,
    perPage,
    lastPage,
    total,
    slice,
    setPage,
    setPerPage: handlePerPageChange,
    resetPage: () => setPage(1),
  };
}
