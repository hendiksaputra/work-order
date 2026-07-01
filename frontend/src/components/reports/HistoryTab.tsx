'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { FileSpreadsheet, FileText } from 'lucide-react';
import { api, apiDownload } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import type { MechanicActivity, Paginated, WorkOrder } from '@/lib/types';
import { formatDate, formatDecimalHours, STATUS_LABELS } from '@/lib/utils';
import { ReportBlock, ReportEmpty, ReportTable, ReportTd, ReportTh } from './ReportBlock';
import { ReportPagination } from './ReportPagination';
import { UnitComponentHistorySection } from './UnitComponentHistorySection';

const HISTORY_PER_PAGE = 10;

export function HistoryTab() {
  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">
        Riwayat data operasional workshop — Work Order dan aktivitas mekanik untuk analisis historis.
      </p>
      <WorkOrderHistorySection />
      <MechanicActivityHistorySection />
      <UnitComponentHistorySection />
    </div>
  );
}

function WorkOrderHistorySection() {
  const [data, setData] = useState<Paginated<WorkOrder> | null>(null);
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(HISTORY_PER_PAGE);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setLoadError('');
    const params = new URLSearchParams({ page: String(page), per_page: String(perPage) });
    if (status) params.set('status', status);
    if (type) params.set('type', type);
    if (appliedSearch) params.set('search', appliedSearch);
    api<Paginated<WorkOrder>>(`/reports/work-order-history?${params}`)
      .then(setData)
      .catch((err) => {
        setData(null);
        setLoadError(err instanceof Error ? err.message : 'Gagal memuat riwayat Work Order');
      })
      .finally(() => setLoading(false));
  }, [page, perPage, status, type, appliedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  const applyFilters = () => {
    setAppliedSearch(search.trim());
    setPage(1);
  };

  return (
    <ReportBlock
      title="1. Work Order History"
      description="Riwayat semua WO: nomor, tipe pekerjaan, tanggal buka/tutup, dan status."
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          type="search"
          placeholder="Cari no WO, judul, komponen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[200px] flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        />
        <select
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        >
          <option value="">Semua tipe</option>
          <option value="main">Main WO</option>
          <option value="sub">Sub WO</option>
        </select>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        >
          <option value="">Semua status</option>
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={applyFilters}
          className="rounded-lg bg-slate-800 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
        >
          Filter
        </button>
      </div>

      {appliedSearch !== search.trim() && (
        <p className="mb-2 text-xs text-amber-700">Tekan Filter untuk menerapkan kata kunci pencarian.</p>
      )}

      {loadError && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {loadError}
        </p>
      )}

      <ReportTable>
        <thead>
          <tr>
            <ReportTh>No WO</ReportTh>
            <ReportTh>Judul</ReportTh>
            <ReportTh>Tipe</ReportTh>
            <ReportTh>Kategori / Workshop</ReportTh>
            <ReportTh>Tgl Buka</ReportTh>
            <ReportTh>Tgl Tutup</ReportTh>
            <ReportTh>Status</ReportTh>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <ReportEmpty colSpan={7} message="Memuat riwayat Work Order…" />
          ) : loadError ? (
            <ReportEmpty colSpan={7} message="Gagal memuat data." />
          ) : !data?.data.length ? (
            <ReportEmpty colSpan={7} message="Tidak ada data Work Order." />
          ) : (
            data.data.map((wo) => (
              <tr key={wo.id} className="hover:bg-slate-50">
                <ReportTd>
                  <Link href={`/work-orders/${wo.id}`} className="font-medium text-orange-600 hover:underline">
                    {wo.wo_number}
                  </Link>
                </ReportTd>
                <ReportTd>{wo.title}</ReportTd>
                <ReportTd className="capitalize">{wo.type}</ReportTd>
                <ReportTd className="capitalize">
                  {wo.type === 'main' ? wo.main_category || '—' : wo.workshop || '—'}
                </ReportTd>
                <ReportTd>{formatDate(wo.opened_at)}</ReportTd>
                <ReportTd>{formatDate(wo.closed_at)}</ReportTd>
                <ReportTd>
                  <Badge status={wo.status} />
                </ReportTd>
              </tr>
            ))
          )}
        </tbody>
      </ReportTable>

      {data && data.total > 0 && (
        <ReportPagination
          page={data.current_page}
          lastPage={data.last_page}
          total={data.total}
          perPage={data.per_page ?? perPage}
          onPageChange={setPage}
          onPerPageChange={(n) => {
            setPerPage(n);
            setPage(1);
          }}
        />
      )}
    </ReportBlock>
  );
}

const MECHANIC_SEARCH_DEBOUNCE_MS = 300;

function MechanicActivityHistorySection() {
  const [data, setData] = useState<Paginated<MechanicActivity> | null>(null);
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [mechanicSearch, setMechanicSearch] = useState('');
  const [debouncedMechanicSearch, setDebouncedMechanicSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [appliedDateFrom, setAppliedDateFrom] = useState('');
  const [appliedDateTo, setAppliedDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(HISTORY_PER_PAGE);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [loadError, setLoadError] = useState('');
  const prevDebouncedSearchRef = useRef(debouncedMechanicSearch);
  const hasLoadedOnceRef = useRef(false);

  const hasActiveFilters = Boolean(
    debouncedMechanicSearch || appliedDateFrom || appliedDateTo || status || category
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedMechanicSearch(mechanicSearch.trim());
    }, MECHANIC_SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [mechanicSearch]);

  useEffect(() => {
    if (prevDebouncedSearchRef.current !== debouncedMechanicSearch) {
      prevDebouncedSearchRef.current = debouncedMechanicSearch;
      setPage(1);
    }
  }, [debouncedMechanicSearch]);

  const load = useCallback(() => {
    if (hasLoadedOnceRef.current) {
      setRefreshing(true);
    } else {
      setInitialLoading(true);
    }
    setLoadError('');
    const params = new URLSearchParams({ page: String(page), per_page: String(perPage) });
    if (status) params.set('status', status);
    if (category) params.set('category', category);
    if (debouncedMechanicSearch) params.set('search', debouncedMechanicSearch);
    if (appliedDateFrom) params.set('date_from', appliedDateFrom);
    if (appliedDateTo) params.set('date_to', appliedDateTo);
    api<Paginated<MechanicActivity>>(`/reports/mechanic-activity-history?${params}`)
      .then((result) => {
        setData(result);
        hasLoadedOnceRef.current = true;
      })
      .catch((err) => {
        setData(null);
        setLoadError(err instanceof Error ? err.message : 'Gagal memuat riwayat aktivitas');
      })
      .finally(() => {
        setInitialLoading(false);
        setRefreshing(false);
      });
  }, [page, perPage, status, category, debouncedMechanicSearch, appliedDateFrom, appliedDateTo]);

  useEffect(() => {
    load();
  }, [load]);

  const applyDateFilters = () => {
    setAppliedDateFrom(dateFrom);
    setAppliedDateTo(dateTo);
    setPage(1);
  };

  const resetFilters = () => {
    setMechanicSearch('');
    setDebouncedMechanicSearch('');
    prevDebouncedSearchRef.current = '';
    hasLoadedOnceRef.current = false;
    setDateFrom('');
    setDateTo('');
    setAppliedDateFrom('');
    setAppliedDateTo('');
    setStatus('');
    setCategory('');
    setPage(1);
  };

  const dateFiltersDirty = dateFrom !== appliedDateFrom || dateTo !== appliedDateTo;
  const mechanicSearchPending =
    mechanicSearch.trim() !== debouncedMechanicSearch;

  const buildExportQuery = () => {
    const params = new URLSearchParams();
    if (debouncedMechanicSearch) params.set('search', debouncedMechanicSearch);
    if (appliedDateFrom) params.set('date_from', appliedDateFrom);
    if (appliedDateTo) params.set('date_to', appliedDateTo);
    if (status) params.set('status', status);
    if (category) params.set('category', category);
    return params.toString();
  };

  const exportStamp = () => new Date().toISOString().slice(0, 10);

  const exportExcel = async () => {
    setExportingExcel(true);
    try {
      const qs = buildExportQuery();
      await apiDownload(
        `/reports/mechanic-activity-history/export/excel${qs ? `?${qs}` : ''}`,
        `mechanic-activity-history-${exportStamp()}.xlsx`
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Export Excel gagal');
    } finally {
      setExportingExcel(false);
    }
  };

  const exportPdf = async () => {
    setExportingPdf(true);
    try {
      const qs = buildExportQuery();
      await apiDownload(
        `/reports/mechanic-activity-history/export/pdf${qs ? `?${qs}` : ''}`,
        `mechanic-activity-history-${exportStamp()}.pdf`
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Export PDF gagal');
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <ReportBlock
      title="3. Mechanic Activity History"
      description="Riwayat aktivitas mekanik: pekerjaan per WO, jam kerja, dan kategori produktif vs non-produktif. Pencarian mekanik langsung; export Excel/PDF mengikuti filter aktif."
    >
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div className="min-w-[220px] flex-1">
          <label htmlFor="mechanic-history-search" className="mb-1 block text-xs font-medium text-slate-600">
            Cari mekanik
          </label>
          <div className="relative">
            <input
              id="mechanic-history-search"
              type="text"
              inputMode="search"
              autoComplete="off"
              spellCheck={false}
              placeholder="Nama, username, atau NIK"
              value={mechanicSearch}
              onChange={(e) => setMechanicSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  setDebouncedMechanicSearch(mechanicSearch.trim());
                }
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 pr-9 text-sm text-slate-900 placeholder:text-slate-400"
            />
            {mechanicSearchPending && (
              <span
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400"
                aria-hidden
              >
                ...
              </span>
            )}
          </div>
        </div>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          aria-label="Dari tanggal"
          title="Dari tanggal"
        />
        <input
          type="date"
          value={dateTo}
          min={dateFrom || undefined}
          onChange={(e) => setDateTo(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          aria-label="Sampai tanggal"
          title="Sampai tanggal"
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        >
          <option value="">Semua status</option>
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        >
          <option value="">Semua kategori jam</option>
          <option value="productive">Produktif</option>
          <option value="non_productive">Non produktif</option>
          <option value="mechanic_skill">Mechanic skill</option>
        </select>
        <button
          type="button"
          onClick={applyDateFilters}
          className="rounded-lg bg-slate-800 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
        >
          Filter Tanggal
        </button>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Reset
          </button>
        )}
        <button
          type="button"
          onClick={exportExcel}
          disabled={exportingExcel || exportingPdf || initialLoading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-4 py-1.5 text-sm font-medium text-green-800 hover:bg-green-100 disabled:opacity-60"
        >
          <FileSpreadsheet className="h-4 w-4" />
          {exportingExcel ? 'Mengekspor…' : 'Export Excel'}
        </button>
        <button
          type="button"
          onClick={exportPdf}
          disabled={exportingExcel || exportingPdf || initialLoading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100 disabled:opacity-60"
        >
          <FileText className="h-4 w-4" />
          {exportingPdf ? 'Mengekspor…' : 'Export PDF'}
        </button>
      </div>

      {dateFiltersDirty && (
        <p className="mb-2 text-xs text-amber-700">
          Tekan Filter Tanggal untuk menerapkan rentang tanggal.
        </p>
      )}

      {refreshing && (
        <p className="mb-2 text-xs text-slate-500">Memperbarui hasil...</p>
      )}

      {loadError && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {loadError}
        </p>
      )}

      <ReportTable>
        <thead>
          <tr>
            <ReportTh>Tanggal</ReportTh>
            <ReportTh>Mekanik</ReportTh>
            <ReportTh>WO</ReportTh>
            <ReportTh>Aktivitas</ReportTh>
            <ReportTh>Kategori</ReportTh>
            <ReportTh>Rentang Waktu</ReportTh>
            <ReportTh className="text-right">Total Jam</ReportTh>
            <ReportTh>Status</ReportTh>
          </tr>
        </thead>
        <tbody>
          {initialLoading ? (
            <ReportEmpty colSpan={8} message="Memuat riwayat aktivitas…" />
          ) : loadError ? (
            <ReportEmpty colSpan={8} message="Gagal memuat data." />
          ) : !data?.data.length ? (
            <ReportEmpty
              colSpan={8}
              message={
                hasActiveFilters
                  ? 'Tidak ada aktivitas sesuai filter.'
                  : 'Tidak ada data aktivitas.'
              }
            />
          ) : (
            data.data.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50">
                <ReportTd>{formatDate(a.activity_date)}</ReportTd>
                <ReportTd>{a.user?.name ?? '—'}</ReportTd>
                <ReportTd>
                  {a.work_order?.wo_number ? (
                    <Link
                      href={`/work-orders/${a.work_order_id}`}
                      className="text-orange-600 hover:underline"
                    >
                      {a.work_order.wo_number}
                    </Link>
                  ) : (
                    <span className="text-slate-400">Stand by</span>
                  )}
                </ReportTd>
                <ReportTd>{a.activity_type?.name ?? '—'}</ReportTd>
                <ReportTd className="capitalize text-xs">
                  {a.activity_type?.category?.replace(/_/g, ' ') ?? '—'}
                </ReportTd>
                <ReportTd className="text-slate-600">
                  {String(a.start_time).slice(0, 5)}–{String(a.end_time).slice(0, 5)}
                </ReportTd>
                <ReportTd className="text-right font-medium text-slate-900">
                  {formatDecimalHours(a.total_hours)}
                </ReportTd>
                <ReportTd>
                  <Badge status={a.status} />
                </ReportTd>
              </tr>
            ))
          )}
        </tbody>
        {data && data.data.length > 0 && data.total_hours_sum != null && (
          <tfoot>
            <tr className="bg-slate-50 font-semibold text-slate-800">
              <td colSpan={6} className="border-t border-slate-200 px-3 py-2.5 text-right text-sm">
                Total jam (filter aktif, tidak termasuk ditolak)
              </td>
              <td className="border-t border-slate-200 px-3 py-2.5 text-right text-sm text-orange-700">
                {formatDecimalHours(data.total_hours_sum)}
              </td>
              <td className="border-t border-slate-200 px-3 py-2.5" />
            </tr>
          </tfoot>
        )}
      </ReportTable>

      {data && data.total > 0 && (
        <ReportPagination
          page={data.current_page}
          lastPage={data.last_page}
          total={data.total}
          perPage={data.per_page ?? perPage}
          onPageChange={setPage}
          onPerPageChange={(n) => {
            setPerPage(n);
            setPage(1);
          }}
        />
      )}
    </ReportBlock>
  );
}
