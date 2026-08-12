import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import TrendChart from '../components/TrendChart';
import { ACCENT_HUES } from '../lib/staff';
import { useIsMobile } from '../lib/useMediaQuery';
import type { DashboardData, Demand, DemandStatus } from '../types';

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const isMobile = useIsMobile();

  // Demand-wise status chart
  const [demands, setDemands] = useState<Demand[]>([]);
  const [selectedDemand, setSelectedDemand] = useState<number | ''>('');
  const [demandStatus, setDemandStatus] = useState<DemandStatus | null>(null);

  useEffect(() => {
    api.get<DashboardData>('/dashboard').then((res) => setData(res.data));
  }, []);

  useEffect(() => {
    api.get<Demand[]>('/demands').then((res) => setDemands(res.data)).catch(() => setDemands([]));
  }, []);

  useEffect(() => {
    if (selectedDemand === '') {
      setDemandStatus(null);
      return;
    }
    api
      .get<DemandStatus>(`/dashboard/demand-status?demand_id=${selectedDemand}`)
      .then((res) => setDemandStatus(res.data))
      .catch(() => setDemandStatus(null));
  }, [selectedDemand]);

  // Bar chart geometry (Departed / Pending / Canceled).
  const demandBars = useMemo(() => {
    if (!demandStatus) return [];
    return [
      { label: 'Departed', value: demandStatus.departed, hue: 150 },
      { label: 'Pending', value: demandStatus.pending, hue: 255 },
      { label: 'Canceled', value: demandStatus.canceled, hue: 25 },
    ];
  }, [demandStatus]);
  const demandMax = Math.max(1, ...demandBars.map((b) => b.value));

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

  if (!data) {
    return <div style={{ color: 'var(--muted)' }}>Loading…</div>;
  }

  return (
    <div className="fade-in-s">
      <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 2 }}>Dashboard</div>
      <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 28 }}>
        Overview of placements, staff, and activity
      </div>

      {/* Candidate pipeline stage counts */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
          gap: isMobile ? 12 : 18,
          marginBottom: 24,
        }}
      >
        {(data.stageCounts ?? []).map((stage, i) => {
          const hue = ACCENT_HUES[i % ACCENT_HUES.length];
          const color = `oklch(0.55 0.16 ${hue})`;
          return (
            <div
              key={stage.label}
              style={{
                background: 'var(--card)',
                borderRadius: 12,
                padding: 20,
                boxShadow: 'var(--card-shadow)',
                borderLeft: `3px solid ${color}`,
              }}
            >
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>{stage.label}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color }}>{stage.value}</div>
            </div>
          );
        })}
      </div>

      {/* Registrations + Departures over time, side by side (date / month / year) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: 18,
        }}
      >
        <TrendChart
          endpoint="/dashboard/registrations"
          title="Candidate Registrations"
          noun="registrations"
          totalLabel="Total registered"
          accentHue={255}
        />
        <TrendChart
          endpoint="/dashboard/departures"
          title="Departure"
          noun="departures"
          totalLabel="Total departed"
          accentHue={25}
        />
      </div>

      {/* Donut */}
      <div style={{ marginBottom: 18 }}>
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

      {/* Demand-wise status bar chart */}
      <div style={{ background: 'var(--card)', borderRadius: 12, padding: 24, boxShadow: 'var(--card-shadow)' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'stretch' : 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 4,
          }}
        >
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Demand Status</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Departed, pending and cancelled candidates for a demand
            </div>
          </div>
          <select
            className="sr-input"
            style={{ padding: '10px 12px', borderRadius: 7, fontSize: 14, minWidth: isMobile ? '100%' : 240 }}
            value={selectedDemand}
            onChange={(e) => setSelectedDemand(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">-- Select Demand --</option>
            {demands.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        {selectedDemand === '' ? (
          <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
            Select a demand to see its status breakdown.
          </div>
        ) : !demandStatus ? (
          <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>Loading…</div>
        ) : (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
              {demandStatus.total} candidate{demandStatus.total === 1 ? '' : 's'} assigned to this demand
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: isMobile ? 16 : 40, height: 200, padding: '0 8px' }}>
              {demandBars.map((b) => {
                const color = `oklch(0.6 0.16 ${b.hue})`;
                const heightPct = (b.value / demandMax) * 100;
                return (
                  <div key={b.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
                    <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                      <div
                        style={{
                          width: '100%',
                          maxWidth: 90,
                          height: `${heightPct}%`,
                          minHeight: b.value > 0 ? 4 : 0,
                          background: color,
                          borderRadius: '6px 6px 0 0',
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'center',
                          transition: 'height 0.3s ease',
                        }}
                      >
                        <span style={{ marginTop: -22, fontSize: 15, fontWeight: 700, color }}>{b.value}</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginTop: 10, color: 'var(--label)' }}>{b.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
