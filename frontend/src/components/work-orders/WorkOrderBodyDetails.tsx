'use client';

import type { WorkOrder } from '@/lib/types';
import { formatPartsCurrency } from '@/lib/parts-item-utils';
import {
  buildCrewRows,
  buildJobActivityRows,
  buildPartConsumableRows,
  hasUnapprovedActivities,
  hasWorkOrderBodyData,
} from '@/lib/work-order-body-utils';

type Props = {
  wo: WorkOrder;
  showHeader?: boolean;
};

const TH =
  'border border-slate-400 bg-sky-100 px-2 py-1.5 text-center text-xs font-bold uppercase text-slate-900';
const TD = 'border border-slate-400 px-2 py-1 text-xs text-slate-800';
const SECTION = 'border border-slate-400 bg-sky-100 px-2 py-1.5 text-center text-sm font-bold text-slate-900';

export function WorkOrderBodyDetails({ wo, showHeader = true }: Props) {
  const jobRows = buildJobActivityRows(wo);
  const partRows = buildPartConsumableRows(wo);
  const crewRows = buildCrewRows(wo);
  const hasData = hasWorkOrderBodyData(wo);
  const showApprovalHint = hasUnapprovedActivities(wo);

  return (
    <div className="overflow-hidden rounded-lg border border-slate-300 bg-slate-50/80">
      {showHeader && (
        <div className="flex items-stretch border-b border-slate-300">
          <div className="flex flex-col justify-center bg-amber-500 px-4 py-3">
            <p className="text-lg font-black leading-none text-white">APS</p>
            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-950">
              Workshop
            </p>
          </div>
          <div className="flex flex-1 items-center justify-end bg-orange-600 px-6 py-3">
            <p className="font-serif text-2xl font-bold tracking-wide text-white md:text-3xl">
              WORK ORDER
            </p>
          </div>
        </div>
      )}

      <div className="space-y-4 p-4">
        <p className="text-sm font-medium text-slate-700">
          Body / Work Details — <span className="font-semibold text-orange-700">{wo.wo_number}</span>
          {wo.title ? `: ${wo.title}` : ''}
        </p>

        {!hasData ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
            Belum ada aktivitas mekanik atau parts untuk Work Order ini.
          </p>
        ) : (
          <div className="space-y-5">
            {showApprovalHint && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Beberapa aktivitas masih <strong>Draft</strong> atau <strong>Menunggu Approval</strong>.
                Ajukan dan setujui di menu Mechanic Activity agar masuk ringkasan resmi WO (
                <code className="text-[11px]">actual_hours</code>).
              </p>
            )}
            <table className="w-full min-w-[600px] border-collapse bg-white">
              <thead>
                <tr>
                  <th colSpan={6} className={SECTION}>
                    JOB ACTIVITY
                  </th>
                </tr>
                <tr>
                  <th className={TH}>NO</th>
                  <th className={TH}>WORK DESCRIPTION</th>
                  <th className={TH}>START DATE</th>
                  <th className={TH}>FINISH DATE</th>
                  <th className={TH}>TOTAL MAN HOURS</th>
                  <th className={TH}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {jobRows.length === 0 ? (
                  <EmptyRow colSpan={6} message="Belum ada aktivitas mekanik." />
                ) : (
                  jobRows.map((row, idx) => (
                    <tr key={idx} className={row.status !== 'approved' ? 'bg-amber-50/60' : undefined}>
                      <td className={`${TD} text-center`}>{idx + 1}</td>
                      <td className={TD}>{row.workDescription}</td>
                      <td className={`${TD} text-center`}>{row.startDate}</td>
                      <td className={`${TD} text-center`}>{row.finishDate}</td>
                      <td className={`${TD} text-center font-medium`}>{row.totalManHours}</td>
                      <td className={`${TD} text-center text-[11px]`}>{row.statusLabel}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <table className="w-full min-w-[640px] border-collapse bg-white">
              <thead>
                <tr>
                  <th colSpan={6} className={SECTION}>
                    PART &amp; CONSUMABLE
                  </th>
                </tr>
                <tr>
                  <th className={TH}>NO</th>
                  <th className={TH}>PART NUMBER</th>
                  <th className={TH}>DESCRIPTION</th>
                  <th className={TH}>QTY</th>
                  <th className={TH}>PRICE</th>
                  <th className={TH}>TOTAL PRICE</th>
                </tr>
              </thead>
              <tbody>
                {partRows.length === 0 ? (
                  <EmptyRow colSpan={6} message="Belum ada parts yang disetujui." />
                ) : (
                  partRows.map((row, idx) => (
                    <tr key={idx}>
                      <td className={`${TD} text-center`}>{idx + 1}</td>
                      <td className={TD}>{row.partNumber}</td>
                      <td className={TD}>{row.description}</td>
                      <td className={`${TD} text-center`}>{row.qty}</td>
                      <td className={`${TD} text-right`}>{formatPartsCurrency(row.price)}</td>
                      <td className={`${TD} text-right font-medium`}>
                        {formatPartsCurrency(row.totalPrice)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <table className="w-full min-w-[480px] border-collapse bg-white">
              <thead>
                <tr>
                  <th colSpan={4} className={SECTION}>
                    LIST CREW/TEAM
                  </th>
                </tr>
                <tr>
                  <th className={TH}>NO</th>
                  <th className={TH}>NIK</th>
                  <th className={TH}>Mechanic</th>
                  <th className={TH}>Total Man Hours</th>
                </tr>
              </thead>
              <tbody>
                {crewRows.length === 0 ? (
                  <EmptyRow colSpan={4} message="Belum ada data crew." />
                ) : (
                  crewRows.map((row, idx) => (
                    <tr key={idx}>
                      <td className={`${TD} text-center`}>{idx + 1}</td>
                      <td className={`${TD} text-center`}>{row.nik}</td>
                      <td className={TD}>
                        {row.mechanic}
                        {row.statusNote ? (
                          <span className="mt-0.5 block text-[10px] text-amber-700">{row.statusNote}</span>
                        ) : null}
                      </td>
                      <td className={`${TD} text-center font-medium`}>{row.totalManHours}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-sm italic text-blue-700">
          Note: Work Details resmi (jam aktual WO) dihitung dari aktivitas <strong>Disetujui</strong>{' '}
          dan parts yang sudah disetujui supervisor. Baris draft/menunggu ditampilkan sebagai
          referensi.
        </p>
      </div>
    </div>
  );
}

function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className={`${TD} text-center text-slate-500`}>
        {message}
      </td>
    </tr>
  );
}
