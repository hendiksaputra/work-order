'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Permission } from '@/lib/permissions';
import { formatPartsCurrency } from '@/lib/parts-item-utils';
import { Badge } from '@/components/ui/Badge';
import { ReportBlock, ReportEmpty, ReportTable, ReportTd, ReportTh } from './ReportBlock';
import { ReportPagination } from './ReportPagination';

type CostRow = {
  id: number;
  wo_number: string;
  title: string;
  status: string;
  type: string;
  workshop?: string | null;
  main_category?: string | null;
  material_cost: number;
  labor_hours: number;
  labor_cost: number;
  total_cost: number;
  opened_at?: string;
  closed_at?: string;
};

type CostReportResponse = {
  labor_hourly_rate: number;
  summary: {
    work_order_count: number;
    total_material_cost: number;
    total_labor_hours: number;
    total_labor_cost: number;
    total_cost: number;
  };
  data: CostRow[];
  current_page: number;
  last_page: number;
  total: number;
  per_page: number;
};

export function CostReportTab() {
  const { can } = useAuth();
  const canManageSettings = can(Permission.SETTINGS_MANAGE);
  const [report, setReport] = useState<CostReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [applied, setApplied] = useState({
    search: '',
    status: '',
    type: '',
    fromDate: '',
    toDate: '',
  });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError('');
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
    });
    if (applied.search) params.set('search', applied.search);
    if (applied.status) params.set('status', applied.status);
    if (applied.type) params.set('type', applied.type);
    if (applied.fromDate) params.set('from_date', applied.fromDate);
    if (applied.toDate) params.set('to_date', applied.toDate);

    api<CostReportResponse>(`/reports/cost?${params}`)
      .then(setReport)
      .catch((err) => {
        setReport(null);
        setLoadError(err instanceof Error ? err.message : 'Gagal memuat laporan biaya');
      })
      .finally(() => setLoading(false));
  }, [page, perPage, applied]);

  useEffect(() => {
    load();
  }, [load]);

  const applyFilters = () => {
    setApplied({
      search: search.trim(),
      status,
      type,
      fromDate,
      toDate,
    });
    setPage(1);
  };

  const laborRate = report?.labor_hourly_rate ?? 0;
  const summary = report?.summary;

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">
        Sesuai dokumen WO APS: <strong>Cost Report</strong> — biaya per WO (
        <strong>Labour Cost</strong> &amp; <strong>Material Cost</strong>).
      </p>

      <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-950">
        <p className="font-medium">Rumus (selaras dokumen)</p>
        <ul className="mt-2 space-y-1 text-orange-900">
          <li>
            <strong>Labour Cost</strong> = jam aktivitas disetujui × tarif labor
            {canManageSettings ? (
              <>
                {' '}
                (
                <Link href="/settings/workshop" className="font-medium underline hover:text-orange-700">
                  Pengaturan Workshop
                </Link>
                )
              </>
            ) : (
              ' (Pengaturan Workshop)'
            )}
          </li>
          <li>
            <strong>Material Cost</strong> = Σ (qty × harga) parts request yang disetujui / logistic /
            taken
          </li>
        </ul>
        <p className="mt-2 text-xs text-orange-800">
          Tarif labor saat ini: <strong>{formatPartsCurrency(laborRate)}/jam</strong>
          {!canManageSettings && ' — hubungi admin untuk mengubah tarif.'}
        </p>
      </div>

      <ReportBlock
        title="Cost Report (Laporan Biaya)"
        description="Biaya per Work Order: Labour Cost + Material Cost (urutan total tertinggi di atas)."
      >
        <div className="mb-4 flex flex-wrap gap-2">
          <input
            type="search"
            placeholder="Cari no WO, judul, komponen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
            className="min-w-[200px] flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="">Semua tipe</option>
            <option value="main">Main WO</option>
            <option value="sub">Sub WO</option>
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="">Semua status</option>
            <option value="draft">Draft</option>
            <option value="pending_supervisor">Menunggu Supervisor</option>
            <option value="approved">Disetujui</option>
            <option value="in_execution">Eksekusi</option>
            <option value="qc_pending">QC Pending</option>
            <option value="qc_approved">QC Approved</option>
            <option value="closed">Closed</option>
            <option value="rejected">Ditolak</option>
          </select>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            title="Tgl buka dari"
          />
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            title="Tgl buka sampai"
          />
          <button
            type="button"
            onClick={applyFilters}
            className="rounded-lg bg-slate-800 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-900"
          >
            Terapkan
          </button>
        </div>

        {summary && !loading && (
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <SummaryCard label="Jumlah WO" value={String(summary.work_order_count)} />
            <SummaryCard
              label="Total Material Cost"
              value={formatPartsCurrency(summary.total_material_cost)}
            />
            <SummaryCard
              label="Jam aktivitas (disetujui)"
              value={`${summary.total_labor_hours.toFixed(1)} jam`}
            />
            <SummaryCard
              label="Total Labour Cost"
              value={formatPartsCurrency(summary.total_labor_cost)}
            />
            <SummaryCard
              label="Total biaya WO"
              value={formatPartsCurrency(summary.total_cost)}
              highlight
            />
          </div>
        )}

        {loadError && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {loadError}
          </p>
        )}

        {loading ? (
          <p className="py-10 text-center text-slate-400">Memuat laporan biaya…</p>
        ) : (
          <>
            <ReportTable>
              <thead>
                <tr>
                  <ReportTh>No WO</ReportTh>
                  <ReportTh>Judul</ReportTh>
                  <ReportTh>Status</ReportTh>
                  <ReportTh className="text-right">Material Cost</ReportTh>
                  <ReportTh className="text-right">Jam (disetujui)</ReportTh>
                  <ReportTh className="text-right">Labour Cost</ReportTh>
                  <ReportTh className="text-right">Total biaya WO</ReportTh>
                </tr>
              </thead>
              <tbody>
                {!report?.data.length ? (
                  <ReportEmpty
                    colSpan={7}
                    message={
                      loadError
                        ? '—'
                        : 'Tidak ada Work Order untuk filter ini, atau belum ada parts/aktivitas disetujui.'
                    }
                  />
                ) : (
                  report.data.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <ReportTd>
                        <Link
                          href={`/work-orders/${row.id}`}
                          className="font-medium text-orange-600 hover:underline"
                        >
                          {row.wo_number}
                        </Link>
                      </ReportTd>
                      <ReportTd>{row.title}</ReportTd>
                      <ReportTd>
                        <Badge status={row.status} />
                      </ReportTd>
                      <ReportTd className="text-right tabular-nums">
                        {formatPartsCurrency(row.material_cost)}
                      </ReportTd>
                      <ReportTd className="text-right tabular-nums">{row.labor_hours.toFixed(1)}</ReportTd>
                      <ReportTd className="text-right tabular-nums">
                        {formatPartsCurrency(row.labor_cost)}
                      </ReportTd>
                      <ReportTd className="text-right font-semibold tabular-nums text-slate-900">
                        {formatPartsCurrency(row.total_cost)}
                      </ReportTd>
                    </tr>
                  ))
                )}
              </tbody>
            </ReportTable>

            {report && report.total > 0 && (
              <ReportPagination
                page={report.current_page}
                lastPage={report.last_page}
                total={report.total}
                perPage={report.per_page}
                onPageChange={setPage}
                onPerPageChange={(n) => {
                  setPerPage(n);
                  setPage(1);
                }}
              />
            )}
          </>
        )}
      </ReportBlock>

      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-xs text-slate-600">
        <p className="font-medium text-slate-700">Sumber data (WORK ORDER APS)</p>
        <ul className="mt-1 list-inside list-disc space-y-1">
          <li>
            <strong>Material Cost</strong> — parts request status disetujui / logistic / taken (Σ
            qty × harga).
          </li>
          <li>
            <strong>Labour Cost</strong> — jam aktivitas disetujui × tarif labor (Pengaturan
            Workshop).
          </li>
          <li>Urutan tabel: total biaya WO tertinggi di atas (filter yang sama di semua halaman).</li>
        </ul>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        highlight
          ? 'rounded-lg border border-orange-200 bg-orange-50 px-4 py-3'
          : 'rounded-lg border border-slate-200 bg-slate-50 px-4 py-3'
      }
    >
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      <p
        className={`mt-1 text-base font-semibold ${highlight ? 'text-orange-800' : 'text-slate-900'}`}
      >
        {value}
      </p>
    </div>
  );
}
