import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { ACCENT_HUES } from '../lib/staff';
import type { DashboardData } from '../types';

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    api.get<DashboardData>('/dashboard').then((res) => setData(res.data));
  }, []);

  // ── Monthly placements line chart geometry (ported from the design) ──────
  const chart = useMemo(() => {
    const trend = data?.monthlyTrend ?? [];
    const chartW = 560;
    const chartH = 200;
    const pad = 10;
    if (trend.length < 2) return { line: '', area: '' };
    const maxV = Math.max(...trend.map((m) => m.value));
    const minV = Math.min(...trend.map((m) => m.value));
    const stepX = (chartW - pad * 2) / (trend.length - 1);
    const coords = trend.map((m, i) => {
      const x = pad + i * stepX;
      const y = chartH - pad - ((m.value - minV) / (maxV - minV || 1)) * (chartH - pad * 2);
      return [x, y] as const;
    });
    const line = coords.map(([x, y]) => `${x},${y}`).join(' ');
    const area = `${pad},${chartH} ${line} ${chartW - pad},${chartH}`;
    return { line, area };
  }, [data]);

  // ── Donut (staff by department) geometry ─────────────────────────────────
  const donut = useMemo(() => {
    const breakdown = data?.departmentBreakdown ?? [];
    const total = breakdown.reduce((sum, d) => sum + d.value, 0) || 1;
    let acc = 0;
    const parts: string[] = [];
    const legend = breakdown.map((d, i) => {
      const color = `oklch(0.6 0.15 ${ACCENT_HUES[i % ACCENT_HUES.length]})`;
      const pct = Math.round((d.value / total) * 100);
      const from = (acc / total) * 100;
      acc += d.value;
      const to = (acc / total) * 100;
      parts.push(`${color} ${from}% ${to}%`);
      return { label: d.label, pct, color };
    });
    return {
      gradient: `conic-gradient(${parts.join(', ')})`,
      legend,
    };
  }, [data]);

  const countries = useMemo(() => {
    const list = data?.placementsByCountry ?? [];
    const max = Math.max(1, ...list.map((c) => c.value));
    return list.map((c) => ({ ...c, pct: Math.round((c.value / max) * 100) }));
  }, [data]);

  if (!data) {
    return <div style={{ color: 'var(--muted)' }}>Loading…</div>;
  }

  return (
    <div className="fade-in-s">
      <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 2 }}>Dashboard</div>
      <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 28 }}>
        Overview of placements, staff, and activity
      </div>

      {/* KPI cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 18,
          marginBottom: 24,
        }}
      >
        {data.kpis.map((kpi) => (
          <div
            key={kpi.label}
            style={{ background: 'var(--card)', borderRadius: 12, padding: 20, boxShadow: 'var(--card-shadow)' }}
          >
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>{kpi.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700 }}>{kpi.value}</div>
            <div
              style={{
                fontSize: 12,
                marginTop: 6,
                color: kpi.tone === 'up' ? 'oklch(0.5 0.13 150)' : 'oklch(0.5 0.15 30)',
              }}
            >
              {kpi.delta}
            </div>
          </div>
        ))}
      </div>

      {/* Trend + donut */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.3fr 1fr',
          gap: 18,
          marginBottom: 18,
        }}
      >
        <div style={{ background: 'var(--card)', borderRadius: 12, padding: 24, boxShadow: 'var(--card-shadow)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Monthly Placements</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20 }}>
            Applicants successfully placed, last 6 months
          </div>
          <svg width="100%" height={200} viewBox="0 0 560 200" preserveAspectRatio="none">
            <line x1="0" y1="199" x2="560" y2="199" stroke="oklch(0.9 0.005 250)" strokeWidth="1" />
            <polyline
              points={chart.line}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polygon points={chart.area} fill="oklch(0.55 0.18 250 / 0.1)" />
          </svg>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            {data.monthlyTrend.map((m) => (
              <div key={m.month} style={{ fontSize: 11, color: 'var(--muted-2)' }}>
                {m.month}
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: 'var(--card)', borderRadius: 12, padding: 24, boxShadow: 'var(--card-shadow)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Staff by Department</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 18 }}>
            Current headcount distribution
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div
              style={{
                width: 130,
                height: 130,
                borderRadius: 999,
                background: donut.gradient,
                flexShrink: 0,
                position: 'relative',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 22,
                  borderRadius: 999,
                  background: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                }}
              >
                <div style={{ fontSize: 20, fontWeight: 700 }}>{data.totalStaff}</div>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>Total Staff</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, minWidth: 0 }}>
              {donut.legend.map((d) => (
                <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <div style={{ width: 9, height: 9, borderRadius: 999, background: d.color, flexShrink: 0 }} />
                  <span style={{ color: 'var(--label)' }}>{d.label}</span>
                  <span style={{ color: 'var(--muted)', marginLeft: 'auto' }}>{d.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Placements by country */}
      <div style={{ background: 'var(--card)', borderRadius: 12, padding: 24, boxShadow: 'var(--card-shadow)' }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
          Placements by Destination Country
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20 }}>
          Active overseas placements, year to date
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {countries.map((c) => (
            <div key={c.country}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                <span style={{ fontWeight: 500 }}>{c.country}</span>
                <span style={{ color: 'var(--muted)' }}>{c.value}</span>
              </div>
              <div
                style={{
                  height: 9,
                  borderRadius: 999,
                  background: 'var(--track)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    borderRadius: 999,
                    width: `${c.pct}%`,
                    background: 'var(--accent)',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
