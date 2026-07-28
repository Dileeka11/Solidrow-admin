import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import type { RegistrationsTrend } from '../types';

type Group = 'day' | 'month' | 'year';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface TrendChartProps {
  /** API endpoint returning a RegistrationsTrend payload. */
  endpoint: string;
  /** Card heading, e.g. "Candidate Registrations" or "Departure". */
  title: string;
  /** Lowercase noun used in subtitles, e.g. "registrations". */
  noun: string;
  /** Label above the total count, e.g. "Total registered". */
  totalLabel: string;
  /** OKLCH hue used for this chart's accent colour. */
  accentHue?: number;
}

/**
 * Generic time-series bar chart. Defaults to a date-wise (per-day) view of the
 * current month, with toggles for month-wise / year-wise, and dropdowns to
 * change the year/month being inspected. Designed to sit in a half-width
 * dashboard column.
 */
export default function TrendChart({ endpoint, title, noun, totalLabel, accentHue = 255 }: TrendChartProps) {
  const now = new Date();
  const [group, setGroup] = useState<Group>('day');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-based
  const [data, setData] = useState<RegistrationsTrend | null>(null);

  const accent = `oklch(0.62 0.17 ${accentHue})`;
  const accentSoft = `oklch(0.62 0.17 ${accentHue} / 0.14)`;
  const barTop = `oklch(0.66 0.18 ${accentHue})`;
  const barBottom = `oklch(0.72 0.15 ${accentHue} / 0.55)`;

  const selectStyle: React.CSSProperties = {
    padding: '5px 8px',
    borderRadius: 8,
    border: '1px solid oklch(0.9 0.01 250)',
    background: 'var(--card)',
    fontSize: 12,
    color: 'var(--label)',
    cursor: 'pointer',
  };

  useEffect(() => {
    const params: Record<string, string | number> = { group, year };
    if (group === 'day') params.month = month;
    api.get<RegistrationsTrend>(endpoint, { params }).then((res) => setData(res.data));
  }, [endpoint, group, year, month]);

  const years = data?.years ?? [year];
  const points = useMemo(() => data?.points ?? [], [data]);
  const maxV = useMemo(() => Math.max(1, ...points.map((p) => p.value)), [points]);

  const subtitle =
    group === 'day'
      ? `Daily ${noun}, ${MONTHS[month - 1]} ${year}`
      : group === 'month'
        ? `Monthly ${noun}, ${year}`
        : `Yearly ${noun}`;

  const dense = points.length > 16;

  return (
    <div
      style={{
        background: 'var(--card)',
        borderRadius: 14,
        padding: 22,
        boxShadow: 'var(--card-shadow)',
        marginBottom: 18,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <span style={{ width: 10, height: 10, borderRadius: 3, background: accent, flexShrink: 0 }} />
        <div style={{ fontSize: 15, fontWeight: 700 }}>{title}</div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>{subtitle}</div>

      {/* Total + controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{totalLabel}</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: accent, lineHeight: 1.1 }}>{data?.total ?? 0}</div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          {/* Group toggle */}
          <div style={{ display: 'flex', background: 'oklch(0.96 0.005 250)', borderRadius: 9, padding: 3, gap: 2 }}>
            {(['day', 'month', 'year'] as Group[]).map((g) => (
              <button
                key={g}
                onClick={() => setGroup(g)}
                style={{
                  padding: '5px 11px',
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                  background: group === g ? accent : 'transparent',
                  color: group === g ? 'white' : 'var(--muted)',
                  boxShadow: group === g ? '0 1px 2px oklch(0 0 0 / 0.15)' : 'none',
                }}
              >
                {g === 'day' ? 'Date' : g === 'month' ? 'Month' : 'Year'}
              </button>
            ))}
          </div>

          {group === 'day' && (
            <select style={selectStyle} value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          )}

          {group !== 'year' && (
            <select style={selectStyle} value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Bar chart */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'flex-end',
          gap: dense ? 3 : 7,
          height: 190,
          paddingTop: 22,
          overflowX: 'auto',
          borderBottom: '1px solid oklch(0.92 0.005 250)',
        }}
      >
        {points.length === 0 && (
          <div style={{ color: 'var(--muted-2)', fontSize: 13, margin: 'auto' }}>No data</div>
        )}
        {points.map((p) => {
          const h = (p.value / maxV) * 150;
          return (
            <div
              key={p.label}
              title={`${p.label}: ${p.value}`}
              style={{ flex: '1 0 auto', minWidth: dense ? 9 : 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
            >
              <div style={{ fontSize: 10, fontWeight: 700, color: accent, height: 13 }}>
                {p.value > 0 && !dense ? p.value : ''}
              </div>
              <div
                style={{
                  width: '100%',
                  maxWidth: 34,
                  height: Math.max(h, p.value > 0 ? 5 : 0),
                  minHeight: p.value > 0 ? 5 : 0,
                  borderRadius: '5px 5px 2px 2px',
                  background: p.value > 0 ? `linear-gradient(${barTop}, ${barBottom})` : 'oklch(0.95 0.005 250)',
                }}
              />
              <div style={{ fontSize: 9, color: 'var(--muted-2)', whiteSpace: 'nowrap' }}>{p.label}</div>
            </div>
          );
        })}
      </div>

      {/* subtle base fill accent (visual only) */}
      <div style={{ height: 3, borderRadius: 2, background: accentSoft, marginTop: 8 }} />
    </div>
  );
}
