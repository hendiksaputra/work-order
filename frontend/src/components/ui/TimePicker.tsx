'use client';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

function parseTime(value: string): { hour: string; minute: string } {
  const [hour = '08', minute = '00'] = value.split(':');
  const m = Number(minute);
  const safeMinute = Number.isFinite(m) && m >= 0 && m <= 59 ? String(m).padStart(2, '0') : '00';
  return { hour: hour.padStart(2, '0'), minute: safeMinute };
}

export function TimePicker({
  label,
  value,
  onChange,
  required,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
}) {
  const { hour, minute } = parseTime(value);

  const setHour = (h: string) => onChange(`${h}:${minute}`);
  const setMinute = (m: string) => onChange(`${hour}:${m}`);

  const selectClass =
    className ??
    'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200';

  return (
    <div>
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <div className="mt-1 flex items-center gap-2">
        <select
          value={hour}
          onChange={(e) => setHour(e.target.value)}
          className={`${selectClass} min-w-[4.5rem] flex-1`}
          required={required}
          aria-label={`${label} — jam`}
        >
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <span className="text-lg font-semibold text-slate-400">:</span>
        <select
          value={minute}
          onChange={(e) => setMinute(e.target.value)}
          className={`${selectClass} min-w-[4.5rem] flex-1`}
          required={required}
          aria-label={`${label} — menit`}
        >
          {MINUTES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <p className="mt-1 text-xs text-slate-400">Pilih jam & menit (per 1 menit)</p>
    </div>
  );
}
