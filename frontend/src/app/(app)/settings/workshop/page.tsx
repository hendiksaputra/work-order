'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { FlashMessage } from '@/components/ui/FlashMessage';
import { formatPartsCurrency } from '@/lib/parts-item-utils';
import { partsNumberInputDisplay, partsNumberInputParse } from '@/lib/parts-item-utils';
import { formatDate } from '@/lib/utils';

type WorkshopSettings = {
  labor_hourly_rate: number;
  default_labor_hourly_rate: number;
  standard_hours_per_day: number;
  default_standard_hours_per_day: number;
  source: 'database' | 'default';
  updated_at?: string;
  updated_by_name?: string;
  hours_updated_at?: string;
  hours_updated_by_name?: string;
};

export default function WorkshopSettingsPage() {
  const [settings, setSettings] = useState<WorkshopSettings | null>(null);
  const [rateInput, setRateInput] = useState<number | ''>('');
  const [hoursInput, setHoursInput] = useState<number | ''>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingHours, setSavingHours] = useState(false);
  const [flash, setFlash] = useState<{ variant: 'success' | 'error'; message: string } | null>(
    null
  );

  const load = () => {
    setLoading(true);
    api<WorkshopSettings>('/settings/workshop')
      .then((data) => {
        setSettings(data);
        setRateInput(data.labor_hourly_rate);
        setHoursInput(data.standard_hours_per_day);
      })
      .catch((err) => {
        setSettings(null);
        setFlash({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Gagal memuat pengaturan',
        });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    const rate = typeof rateInput === 'number' ? rateInput : partsNumberInputParse(String(rateInput));
    if (rate <= 0) {
      setFlash({ variant: 'error', message: 'Tarif labour harus lebih dari 0.' });
      return;
    }

    setSaving(true);
    setFlash(null);
    try {
      const res = await api<WorkshopSettings & { message?: string }>('/settings/workshop/labor-rate', {
        method: 'PUT',
        body: JSON.stringify({ labor_hourly_rate: rate }),
      });
      setSettings(res);
      setRateInput(res.labor_hourly_rate);
      setFlash({
        variant: 'success',
        message: res.message || 'Tarif labour berhasil disimpan.',
      });
    } catch (err) {
      setFlash({
        variant: 'error',
        message: err instanceof Error ? err.message : 'Gagal menyimpan tarif labour',
      });
    } finally {
      setSaving(false);
    }
  };

  const resetToDefault = () => {
    if (!settings) return;
    setRateInput(settings.default_labor_hourly_rate);
  };

  const saveStandardHours = async () => {
    const hours = typeof hoursInput === 'number' ? hoursInput : parseFloat(String(hoursInput));
    if (!hours || hours < 1 || hours > 24) {
      setFlash({ variant: 'error', message: 'Jam standar harus antara 1 dan 24.' });
      return;
    }
    setSavingHours(true);
    setFlash(null);
    try {
      const res = await api<WorkshopSettings & { message?: string }>('/settings/workshop/standard-hours', {
        method: 'PUT',
        body: JSON.stringify({ standard_hours_per_day: hours }),
      });
      setSettings(res);
      setHoursInput(res.standard_hours_per_day);
      setFlash({
        variant: 'success',
        message: res.message || 'Jam kerja standar berhasil disimpan.',
      });
    } catch (err) {
      setFlash({
        variant: 'error',
        message: err instanceof Error ? err.message : 'Gagal menyimpan jam standar',
      });
    } finally {
      setSavingHours(false);
    }
  };

  return (
    <div className="p-8">
      <PageHeader
        title="Pengaturan Workshop"
        subtitle="Parameter global untuk laporan dan perhitungan biaya di sistem Work Order APS."
      />

      {flash && (
        <FlashMessage variant={flash.variant} message={flash.message} onDismiss={() => setFlash(null)} />
      )}

      {loading ? (
        <p className="py-12 text-center text-slate-400">Memuat pengaturan…</p>
      ) : (
        <div className="max-w-xl space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Tarif Labour (Cost Report)</h2>
            <p className="mt-1 text-sm text-slate-600">
              Parameter untuk menghitung <strong>Labour Cost</strong> di{' '}
              <Link href="/reports" className="font-medium text-orange-600 hover:underline">
                Cost Report
              </Link>
              .
            </p>
            <p className="mt-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-950">
              <strong>Labour Cost</strong> = jam aktivitas disetujui × tarif labor (Pengaturan
              Workshop)
            </p>

            {settings && (
              <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                Tarif aktif saat ini:{' '}
                <strong>{formatPartsCurrency(settings.labor_hourly_rate)}/jam</strong>
                {settings.source === 'database' && settings.updated_at && (
                  <span className="block text-xs text-slate-500 mt-1">
                    Terakhir diubah {formatDate(settings.updated_at)}
                    {settings.updated_by_name ? ` oleh ${settings.updated_by_name}` : ''}
                  </span>
                )}
              </p>
            )}

            <label className="mt-4 block text-sm font-medium text-slate-700">
              Tarif labour per jam (Rp)
              <input
                type="text"
                inputMode="numeric"
                value={partsNumberInputDisplay(typeof rateInput === 'number' ? rateInput : 0)}
                onChange={(e) => setRateInput(partsNumberInputParse(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm"
                placeholder="150000"
              />
            </label>

            {settings && (
              <p className="mt-2 text-xs text-slate-500">
                Nilai bawaan sistem (fallback .env):{' '}
                {formatPartsCurrency(settings.default_labor_hourly_rate)}/jam — hanya dipakai jika belum
                pernah disimpan di database.
              </p>
            )}

            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
              >
                {saving ? 'Menyimpan…' : 'Simpan Tarif'}
              </button>
              <button
                type="button"
                onClick={resetToDefault}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Isi nilai bawaan
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Jam Kerja Standar (Utilization)</h2>
            <p className="mt-1 text-sm text-slate-600">
              Kapasitas per mekanik = hari kerja dalam periode × jam ini. Dipakai di tab Report →
              Utilization.
            </p>
            {settings && (
              <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                Jam aktif: <strong>{settings.standard_hours_per_day} jam/hari</strong>
                {settings.hours_updated_at && (
                  <span className="mt-1 block text-xs text-slate-500">
                    Terakhir diubah {formatDate(settings.hours_updated_at)}
                    {settings.hours_updated_by_name ? ` oleh ${settings.hours_updated_by_name}` : ''}
                  </span>
                )}
              </p>
            )}
            <label className="mt-4 block text-sm font-medium text-slate-700">
              Jam kerja standar per hari
              <input
                type="number"
                min={1}
                max={24}
                step={0.5}
                value={hoursInput}
                onChange={(e) =>
                  setHoursInput(e.target.value === '' ? '' : parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm"
              />
            </label>
            {settings && (
              <p className="mt-2 text-xs text-slate-500">
                Nilai bawaan: {settings.default_standard_hours_per_day} jam/hari
              </p>
            )}
            <button
              type="button"
              onClick={saveStandardHours}
              disabled={savingHours}
              className="mt-4 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
            >
              {savingHours ? 'Menyimpan…' : 'Simpan Jam Standar'}
            </button>
          </section>

          <section className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            <p className="font-medium text-slate-700">Catatan</p>
            <ul className="mt-1 list-inside list-disc space-y-1">
              <li>Perubahan langsung berlaku untuk Cost Report tanpa restart server.</li>
              <li>Hanya admin dengan izin &quot;Kelola Pengaturan Workshop&quot; yang dapat mengubah.</li>
              <li>File <code className="rounded bg-white px-1">.env</code> (WO_LABOR_HOURLY_RATE) tetap sebagai cadangan jika database kosong.</li>
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
