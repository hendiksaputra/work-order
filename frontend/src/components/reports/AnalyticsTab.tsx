'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatPartsCurrency } from '@/lib/parts-item-utils';
import { formatDate } from '@/lib/utils';
import { useClientPagination } from '@/lib/use-client-pagination';
import { ReportBlock, ReportEmpty, ReportTable, ReportTd, ReportTh } from './ReportBlock';
import { ReportPagination } from './ReportPagination';
import { DelayAnalysisSection, UtilizationSection } from './DelayUtilizationSections';

type ProductivityRow = { category: string; total_hours: string; activity_count: number };
type MechanicRow = { name: string; total_hours: string; wo_count: number; employee_id?: string };
type PartRow = { part_name: string; total_qty: string; total_cost: string };
type LeadTimeRow = {
  wo_number: string;
  title: string;
  status: string;
  target_hours: number;
  actual_hours: number;
  variance_hours: number;
  lead_days: number | null;
  opened_at?: string;
  closed_at?: string;
};

export function AnalyticsTab() {
  const [productivity, setProductivity] = useState<ProductivityRow[]>([]);
  const [mechanics, setMechanics] = useState<MechanicRow[]>([]);
  const [parts, setParts] = useState<PartRow[]>([]);
  const [leadTime, setLeadTime] = useState<LeadTimeRow[]>([]);
  const [loading, setLoading] = useState(true);

  const leadTimePage = useClientPagination(leadTime);
  const mechanicsPage = useClientPagination(mechanics);
  const partsPage = useClientPagination(parts);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api<ProductivityRow[]>('/reports/productivity'),
      api<MechanicRow[]>('/reports/mechanic-performance'),
      api<PartRow[]>('/reports/spare-parts'),
      api<LeadTimeRow[]>('/reports/lead-time'),
    ])
      .then(([p, m, sp, lt]) => {
        setProductivity(p);
        setMechanics(m);
        setParts(sp);
        setLeadTime(lt);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="py-12 text-center text-slate-400">Memuat laporan analisis…</p>;
  }

  const productiveHours = productivity
    .filter((p) => p.category === 'productive')
    .reduce((s, p) => s + Number(p.total_hours), 0);
  const nonProductiveHours = productivity
    .filter((p) => p.category === 'non_productive')
    .reduce((s, p) => s + Number(p.total_hours), 0);

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">
        Laporan analisis & KPI workshop — produktivitas, lead time, kinerja mekanik, dan konsumsi spare
        part.
      </p>

      <ReportBlock
        title="1. Productivity Report"
        description="Analisis waktu produktif vs non-produktif (aktivitas disetujui)."
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <SummaryCard label="Jam produktif" value={`${productiveHours.toFixed(1)} jam`} />
          <SummaryCard label="Jam non-produktif" value={`${nonProductiveHours.toFixed(1)} jam`} />
          <SummaryCard
            label="Rasio produktif"
            value={
              productiveHours + nonProductiveHours > 0
                ? `${((productiveHours / (productiveHours + nonProductiveHours)) * 100).toFixed(0)}%`
                : '—'
            }
          />
        </div>
        <ReportTable>
          <thead>
            <tr>
              <ReportTh>Kategori aktivitas</ReportTh>
              <ReportTh>Total jam</ReportTh>
              <ReportTh>Jumlah aktivitas</ReportTh>
            </tr>
          </thead>
          <tbody>
            {productivity.length === 0 ? (
              <ReportEmpty colSpan={3} message="Belum ada aktivitas disetujui." />
            ) : (
              productivity.map((p) => (
                <tr key={p.category}>
                  <ReportTd className="capitalize">{p.category.replace(/_/g, ' ')}</ReportTd>
                  <ReportTd>{Number(p.total_hours).toFixed(1)} jam</ReportTd>
                  <ReportTd>{p.activity_count}</ReportTd>
                </tr>
              ))
            )}
          </tbody>
        </ReportTable>
      </ReportBlock>

      <ReportBlock
        title="2. Lead Time Report"
        description="Durasi WO dibuka hingga ditutup; perbandingan jam aktual vs target/estimasi."
      >
        <ReportTable>
          <thead>
            <tr>
              <ReportTh>WO</ReportTh>
              <ReportTh>Judul</ReportTh>
              <ReportTh>Tgl buka</ReportTh>
              <ReportTh>Tgl tutup</ReportTh>
              <ReportTh>Lead (hari)</ReportTh>
              <ReportTh>Target (jam)</ReportTh>
              <ReportTh>Aktual (jam)</ReportTh>
              <ReportTh>Selisih (jam)</ReportTh>
            </tr>
          </thead>
          <tbody>
            {leadTime.length === 0 ? (
              <ReportEmpty colSpan={8} message="Belum ada Work Order dengan tanggal buka." />
            ) : (
              leadTimePage.slice.map((l) => (
                <tr key={l.wo_number}>
                  <ReportTd className="font-medium">{l.wo_number}</ReportTd>
                  <ReportTd>{l.title}</ReportTd>
                  <ReportTd>{formatDate(l.opened_at)}</ReportTd>
                  <ReportTd>{formatDate(l.closed_at)}</ReportTd>
                  <ReportTd>{l.lead_days ?? '—'}</ReportTd>
                  <ReportTd>{l.target_hours}</ReportTd>
                  <ReportTd>{l.actual_hours}</ReportTd>
                  <ReportTd
                    className={
                      l.variance_hours > 0
                        ? 'font-medium text-red-600'
                        : l.variance_hours < 0
                          ? 'font-medium text-green-600'
                          : ''
                    }
                  >
                    {l.variance_hours > 0 ? '+' : ''}
                    {l.variance_hours}
                  </ReportTd>
                </tr>
              ))
            )}
          </tbody>
        </ReportTable>
        <ReportPagination
          page={leadTimePage.page}
          lastPage={leadTimePage.lastPage}
          total={leadTimePage.total}
          perPage={leadTimePage.perPage}
          onPageChange={leadTimePage.setPage}
          onPerPageChange={leadTimePage.setPerPage}
        />
      </ReportBlock>

      <DelayAnalysisSection />
      <UtilizationSection />

      <ReportBlock
        title="7. Mechanic Performance Report"
        description="Output per mekanik: total jam kerja dan jumlah WO yang disentuh."
      >
        <ReportTable>
          <thead>
            <tr>
              <ReportTh>NIK</ReportTh>
              <ReportTh>Mekanik</ReportTh>
              <ReportTh>Total jam</ReportTh>
              <ReportTh>Jumlah WO</ReportTh>
            </tr>
          </thead>
          <tbody>
            {mechanics.length === 0 ? (
              <ReportEmpty colSpan={4} message="Belum ada data kinerja mekanik." />
            ) : (
              mechanicsPage.slice.map((m, i) => (
                <tr key={`${m.name}-${m.employee_id ?? i}`}>
                  <ReportTd>{m.employee_id || '—'}</ReportTd>
                  <ReportTd>{m.name}</ReportTd>
                  <ReportTd>{Number(m.total_hours).toFixed(1)} jam</ReportTd>
                  <ReportTd>{m.wo_count}</ReportTd>
                </tr>
              ))
            )}
          </tbody>
        </ReportTable>
        <ReportPagination
          page={mechanicsPage.page}
          lastPage={mechanicsPage.lastPage}
          total={mechanicsPage.total}
          perPage={mechanicsPage.perPage}
          onPageChange={mechanicsPage.setPage}
          onPerPageChange={mechanicsPage.setPerPage}
        />
      </ReportBlock>

      <ReportBlock
        title="6. Spare Part Consumption Report"
        description="Part yang paling sering dipakai: qty dan total biaya (request disetujui)."
      >
        <ReportTable>
          <thead>
            <tr>
              <ReportTh>Part</ReportTh>
              <ReportTh>Total qty</ReportTh>
              <ReportTh>Total biaya</ReportTh>
            </tr>
          </thead>
          <tbody>
            {parts.length === 0 ? (
              <ReportEmpty colSpan={3} message="Belum ada konsumsi spare part." />
            ) : (
              partsPage.slice.map((p) => (
                <tr key={p.part_name}>
                  <ReportTd>{p.part_name}</ReportTd>
                  <ReportTd>{Number(p.total_qty).toLocaleString('id-ID')}</ReportTd>
                  <ReportTd>{formatPartsCurrency(Number(p.total_cost))}</ReportTd>
                </tr>
              ))
            )}
          </tbody>
        </ReportTable>
        <ReportPagination
          page={partsPage.page}
          lastPage={partsPage.lastPage}
          total={partsPage.total}
          perPage={partsPage.perPage}
          onPageChange={partsPage.setPage}
          onPerPageChange={partsPage.setPerPage}
        />
      </ReportBlock>

      <p className="text-xs italic text-slate-500">
        Riwayat unit/komponen ada di tab History. Laporan biaya (Material & Labour Cost) ada di tab
        Cost Report.
      </p>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}
