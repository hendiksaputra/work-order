'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DELAY_CAUSE_LABELS } from '@/lib/delay-cause';
import { formatDate } from '@/lib/utils';
import { useClientPagination } from '@/lib/use-client-pagination';
import { ReportBlock, ReportEmpty, ReportTable, ReportTd, ReportTh } from './ReportBlock';
import { ReportPagination } from './ReportPagination';

type DelayByCause = {
  cause: string;
  label: string;
  manual_count: number;
  inferred_count: number;
  total: number;
};

type DelayWoRow = {
  wo_number: string;
  title: string;
  delay_cause: string;
  delay_cause_label: string;
  delay_notes?: string;
  source: 'manual' | 'inferred';
  has_outstanding_parts: boolean;
  variance_hours: number;
  opened_at?: string;
};

type DelayResponse = {
  summary: {
    delayed_work_orders: number;
    manual_total: number;
    inferred_spare_part: number;
    inferred_manpower: number;
  };
  by_cause: DelayByCause[];
  work_orders: DelayWoRow[];
};

type UtilizationRow = {
  name: string;
  employee_id?: string;
  total_hours: number;
  capacity_hours: number;
  utilization_pct: number;
  band: 'idle' | 'normal' | 'overload';
  band_label: string;
};

type UtilizationResponse = {
  summary: {
    from_date: string;
    to_date: string;
    work_days: number;
    standard_hours_per_day: number;
    idle_count: number;
    normal_count: number;
    overload_count: number;
    avg_utilization_pct: number;
  };
  data: UtilizationRow[];
};

function defaultFromDate() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function DelayAnalysisSection() {
  const [data, setData] = useState<DelayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const woPage = useClientPagination(data?.work_orders ?? []);

  useEffect(() => {
    setLoading(true);
    api<DelayResponse>('/reports/delay-analysis')
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <ReportBlock
      title="3. Delay Analysis"
      description={
        <>
          Analisis penyebab keterlambatan WO: input manual (supervisor) atau inferensi spare part
          outstanding / jam aktual melebihi target. Klasifikasi sesuai PPT: spare part, manpower,
          tools.
        </>
      }
    >
      {loading ? (
        <p className="py-6 text-center text-slate-400">Memuat…</p>
      ) : (
        <>
          {data?.summary && (
            <div className="mb-4 grid gap-3 sm:grid-cols-4">
              <Card label="WO terlambat" value={String(data.summary.delayed_work_orders)} />
              <Card label="Input manual" value={String(data.summary.manual_total)} />
              <Card label="Inferensi spare part" value={String(data.summary.inferred_spare_part)} />
              <Card label="Inferensi manpower" value={String(data.summary.inferred_manpower)} />
            </div>
          )}
          <ReportTable>
            <thead>
              <tr>
                <ReportTh>Penyebab</ReportTh>
                <ReportTh>Manual</ReportTh>
                <ReportTh>Inferensi</ReportTh>
                <ReportTh>Total</ReportTh>
              </tr>
            </thead>
            <tbody>
              {!data?.by_cause?.length ? (
                <ReportEmpty colSpan={4} message="Belum ada data keterlambatan." />
              ) : (
                data.by_cause.map((c) => (
                  <tr key={c.cause}>
                    <ReportTd>{c.label}</ReportTd>
                    <ReportTd>{c.manual_count}</ReportTd>
                    <ReportTd>{c.inferred_count}</ReportTd>
                    <ReportTd className="font-medium">{c.total}</ReportTd>
                  </tr>
                ))
              )}
            </tbody>
          </ReportTable>
          <h4 className="mt-6 text-sm font-semibold text-slate-800">Detail Work Order</h4>
          <div className="mt-2">
          <ReportTable>
            <thead>
              <tr>
                <ReportTh>WO</ReportTh>
                <ReportTh>Penyebab</ReportTh>
                <ReportTh>Sumber</ReportTh>
                <ReportTh>Selisih jam</ReportTh>
                <ReportTh>Tgl buka</ReportTh>
              </tr>
            </thead>
            <tbody>
              {!data?.work_orders?.length ? (
                <ReportEmpty colSpan={5} message="Tidak ada WO dengan keterlambatan terdeteksi." />
              ) : (
                woPage.slice.map((w) => (
                  <tr key={w.wo_number}>
                    <ReportTd className="font-medium">{w.wo_number}</ReportTd>
                    <ReportTd>
                      {w.delay_cause_label}
                      {w.delay_notes && (
                        <span className="block text-xs text-slate-500">{w.delay_notes}</span>
                      )}
                    </ReportTd>
                    <ReportTd className="capitalize">{w.source}</ReportTd>
                    <ReportTd
                      className={
                        w.variance_hours > 0 ? 'font-medium text-red-600' : ''
                      }
                    >
                      {w.variance_hours > 0 ? '+' : ''}
                      {w.variance_hours}
                    </ReportTd>
                    <ReportTd>{formatDate(w.opened_at)}</ReportTd>
                  </tr>
                ))
              )}
            </tbody>
          </ReportTable>
          <ReportPagination
            page={woPage.page}
            lastPage={woPage.lastPage}
            total={woPage.total}
            perPage={woPage.perPage}
            onPageChange={woPage.setPage}
            onPerPageChange={woPage.setPerPage}
          />
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Catat penyebab delay di{' '}
            <Link href="/work-orders" className="text-orange-600 hover:underline">
              detail Work Order
            </Link>
            : {Object.values(DELAY_CAUSE_LABELS).join(', ')}.
          </p>
        </>
      )}
    </ReportBlock>
  );
}

export function UtilizationSection() {
  const [fromDate, setFromDate] = useState(defaultFromDate);
  const [toDate, setToDate] = useState(todayIso);
  const [applied, setApplied] = useState({ from: defaultFromDate(), to: todayIso() });
  const [data, setData] = useState<UtilizationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const utilPage = useClientPagination(data?.data ?? []);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      from_date: applied.from,
      to_date: applied.to,
    });
    api<UtilizationResponse>(`/reports/utilization?${params}`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [applied]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ReportBlock
      title="4. Utilization Report"
      description={
        <>
          Pemakaian jam mekanik vs kapasitas (hari kerja × jam standar/hari dari{' '}
          <Link href="/settings/workshop" className="font-medium text-orange-600 hover:underline">
            Pengaturan Workshop
          </Link>
          ). Idle &lt;60%, normal 60–100%, overload &gt;100%.
        </>
      }
    >
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <label className="text-sm text-slate-600">
          Dari
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="mt-1 block rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          />
        </label>
        <label className="text-sm text-slate-600">
          Sampai
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="mt-1 block rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={() => setApplied({ from: fromDate, to: toDate })}
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900"
        >
          Terapkan
        </button>
      </div>

      {loading ? (
        <p className="py-6 text-center text-slate-400">Memuat…</p>
      ) : (
        <>
          {data?.summary && (
            <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Card
                label="Periode"
                value={`${data.summary.from_date} → ${data.summary.to_date}`}
              />
              <Card label="Hari kerja" value={String(data.summary.work_days)} />
              <Card label="Jam standar/hari" value={String(data.summary.standard_hours_per_day)} />
              <Card label="Rata-rata utilisasi" value={`${data.summary.avg_utilization_pct}%`} />
              <Card
                label="Idle / Normal / Over"
                value={`${data.summary.idle_count} / ${data.summary.normal_count} / ${data.summary.overload_count}`}
              />
            </div>
          )}
          <ReportTable>
            <thead>
              <tr>
                <ReportTh>NIK</ReportTh>
                <ReportTh>Mekanik</ReportTh>
                <ReportTh>Jam aktual</ReportTh>
                <ReportTh>Kapasitas</ReportTh>
                <ReportTh>Utilisasi</ReportTh>
                <ReportTh>Status</ReportTh>
              </tr>
            </thead>
            <tbody>
              {!data?.data?.length ? (
                <ReportEmpty colSpan={6} message="Belum ada aktivitas disetujui pada periode ini." />
              ) : (
                utilPage.slice.map((m) => (
                  <tr key={m.name + (m.employee_id ?? '')}>
                    <ReportTd>{m.employee_id || '—'}</ReportTd>
                    <ReportTd>{m.name}</ReportTd>
                    <ReportTd>{m.total_hours.toFixed(1)} jam</ReportTd>
                    <ReportTd>{m.capacity_hours.toFixed(1)} jam</ReportTd>
                    <ReportTd className="font-medium">{m.utilization_pct}%</ReportTd>
                    <ReportTd>
                      <BandBadge band={m.band} label={m.band_label} />
                    </ReportTd>
                  </tr>
                ))
              )}
            </tbody>
          </ReportTable>
          <ReportPagination
            page={utilPage.page}
            lastPage={utilPage.lastPage}
            total={utilPage.total}
            perPage={utilPage.perPage}
            onPageChange={utilPage.setPage}
            onPerPageChange={utilPage.setPerPage}
          />
        </>
      )}
    </ReportBlock>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function BandBadge({ band, label }: { band: string; label: string }) {
  const cls =
    band === 'idle'
      ? 'bg-amber-100 text-amber-900'
      : band === 'overload'
        ? 'bg-red-100 text-red-900'
        : 'bg-green-100 text-green-900';
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}
