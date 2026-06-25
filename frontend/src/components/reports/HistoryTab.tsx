'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import type { MechanicActivity, Paginated, WorkOrder } from '@/lib/types';
import { formatDate, STATUS_LABELS } from '@/lib/utils';
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

function MechanicActivityHistorySection() {
  const [data, setData] = useState<Paginated<MechanicActivity> | null>(null);
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(HISTORY_PER_PAGE);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setLoadError('');
    const params = new URLSearchParams({ page: String(page), per_page: String(perPage) });
    if (status) params.set('status', status);
    if (category) params.set('category', category);
    api<Paginated<MechanicActivity>>(`/reports/mechanic-activity-history?${params}`)
      .then(setData)
      .catch((err) => {
        setData(null);
        setLoadError(err instanceof Error ? err.message : 'Gagal memuat riwayat aktivitas');
      })
      .finally(() => setLoading(false));
  }, [page, perPage, status, category]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ReportBlock
      title="3. Mechanic Activity History"
      description="Riwayat aktivitas mekanik: pekerjaan per WO, jam kerja, dan kategori produktif vs non-produktif."
    >
      <div className="mb-4 flex flex-wrap gap-2">
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
          onClick={() => load()}
          className="rounded-lg bg-slate-800 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
        >
          Refresh
        </button>
      </div>

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
            <ReportTh>Jam</ReportTh>
            <ReportTh>Status</ReportTh>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <ReportEmpty colSpan={7} message="Memuat riwayat aktivitas…" />
          ) : loadError ? (
            <ReportEmpty colSpan={7} message="Gagal memuat data." />
          ) : !data?.data.length ? (
            <ReportEmpty colSpan={7} message="Tidak ada data aktivitas." />
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
                <ReportTd>
                  {a.total_hours}h ({String(a.start_time).slice(0, 5)}–{String(a.end_time).slice(0, 5)})
                </ReportTd>
                <ReportTd>
                  <Badge status={a.status} />
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
