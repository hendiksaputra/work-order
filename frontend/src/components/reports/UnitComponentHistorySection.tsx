'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { ReportBlock, ReportEmpty, ReportTable, ReportTd, ReportTh } from './ReportBlock';
import { ReportPagination } from './ReportPagination';

type UnitComponentRow = {
  key: string;
  label: string;
  repair_count: number;
  closed_count: number;
  open_count: number;
  failure_frequency: number;
  last_wo_number: string | null;
  last_opened_at: string | null;
  last_status: string | null;
  component_installed_at: string | null;
  component_age_days: number | null;
};

type UnitComponentResponse = {
  group_by: 'unit' | 'component';
  summary: { group_count: number; total_repairs: number };
  data: UnitComponentRow[];
  current_page: number;
  last_page: number;
  total: number;
};

export function UnitComponentHistorySection() {
  const [groupBy, setGroupBy] = useState<'unit' | 'component'>('unit');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [data, setData] = useState<UnitComponentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({
      group_by: groupBy,
      page: String(page),
      per_page: String(perPage),
    });
    if (appliedSearch) params.set('search', appliedSearch);
    api<UnitComponentResponse>(`/reports/unit-component-history?${params}`)
      .then(setData)
      .catch((err) => {
        setData(null);
        setError(err instanceof Error ? err.message : 'Gagal memuat riwayat unit/komponen');
      })
      .finally(() => setLoading(false));
  }, [groupBy, page, perPage, appliedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  const applyFilters = () => {
    setAppliedSearch(search.trim());
    setPage(1);
  };

  return (
    <ReportBlock
      title="3. Unit / Component History"
      description="Riwayat perbaikan per unit atau komponen: frekuensi kerusakan, status terakhir, dan umur komponen (jika tercatat di WO)."
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={groupBy}
          onChange={(e) => {
            setGroupBy(e.target.value as 'unit' | 'component');
            setPage(1);
          }}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        >
          <option value="unit">Kelompokkan per Unit</option>
          <option value="component">Kelompokkan per Komponen</option>
        </select>
        <input
          type="search"
          placeholder="Cari unit, komponen, no WO..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[200px] flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={applyFilters}
          className="rounded-lg bg-slate-800 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-900"
        >
          Terapkan
        </button>
      </div>

      {data?.summary && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <SummaryMini label="Grup unit/komponen" value={String(data.summary.group_count)} />
          <SummaryMini label="Total perbaikan (WO)" value={String(data.summary.total_repairs)} />
        </div>
      )}

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      {loading ? (
        <p className="py-6 text-center text-slate-400">Memuat…</p>
      ) : (
        <>
          <ReportTable>
            <thead>
              <tr>
                <ReportTh>{groupBy === 'unit' ? 'Unit' : 'Komponen'}</ReportTh>
                <ReportTh>Frekuensi</ReportTh>
                <ReportTh>Tutup / Buka</ReportTh>
                <ReportTh>WO terakhir</ReportTh>
                <ReportTh>Tgl buka terakhir</ReportTh>
                {groupBy === 'component' && <ReportTh>Umur komponen</ReportTh>}
              </tr>
            </thead>
            <tbody>
              {!data?.data?.length ? (
                <ReportEmpty
                  colSpan={groupBy === 'component' ? 6 : 5}
                  message="Belum ada data dengan unit/komponen terisi."
                />
              ) : (
                data.data.map((row) => (
                  <tr key={row.key}>
                    <ReportTd className="font-medium">{row.label}</ReportTd>
                    <ReportTd>{row.failure_frequency}</ReportTd>
                    <ReportTd>
                      {row.closed_count} / {row.open_count}
                    </ReportTd>
                    <ReportTd>
                      {row.last_wo_number ? (
                        <span className="text-orange-600">{row.last_wo_number}</span>
                      ) : (
                        '—'
                      )}
                    </ReportTd>
                    <ReportTd>{formatDate(row.last_opened_at)}</ReportTd>
                    {groupBy === 'component' && (
                      <ReportTd>
                        {row.component_age_days != null
                          ? `${row.component_age_days} hari`
                          : '—'}
                      </ReportTd>
                    )}
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
              perPage={perPage}
              onPageChange={setPage}
              onPerPageChange={(n) => {
                setPerPage(n);
                setPage(1);
              }}
            />
          )}
        </>
      )}
      <p className="mt-3 text-xs text-slate-500">
        Umur komponen dihitung dari tanggal pasang di WO (
        <Link href="/work-orders" className="text-orange-600 hover:underline">
          isi di detail WO
        </Link>
        ).
      </p>
    </ReportBlock>
  );
}

function SummaryMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}
