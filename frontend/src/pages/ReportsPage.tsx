import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { DatePicker } from '../components/DatePicker';
import { toastError } from '../lib/alerts';
import solidrowLogo from '../assets/solidrow-foreign-employment.png';
import type { Candidate, JobCategory } from '../types';

const SKILL_LABEL: Record<string, string> = {
  skill: 'Skill',
  unskill: 'Unskill',
  training: 'Training',
};

/** Local `yyyy-mm-dd` for a Date without timezone drift. */
function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

/** Friendly display: '13 Jul 2026'. */
function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** The `registration_date` truncated to its `yyyy-mm-dd` day part. */
function regDay(c: Candidate): string | null {
  if (!c.registration_date) return null;
  return c.registration_date.slice(0, 10);
}

export default function ReportsPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [jobCategories, setJobCategories] = useState<JobCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Default range: first day of the current month → today.
  const today = new Date();
  const [from, setFrom] = useState(toISO(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [to, setTo] = useState(toISO(today));

  useEffect(() => {
    Promise.all([
      api.get<Candidate[]>('/candidates'),
      api.get<JobCategory[]>('/job-categories').catch(() => ({ data: [] as JobCategory[] })),
    ])
      .then(([cRes, jRes]) => {
        setCandidates(cRes.data);
        setJobCategories(jRes.data);
      })
      .catch(() => toastError('Could not load candidates.'))
      .finally(() => setLoading(false));
  }, []);

  const jobCatName = (id: number | null) =>
    jobCategories.find((j) => j.id === id)?.name ?? '—';

  // Candidates whose registration day falls within [from, to] (inclusive).
  const inRange = useMemo(() => {
    const rows = candidates.filter((c) => {
      const day = regDay(c);
      if (!day) return false;
      if (from && day < from) return false;
      if (to && day > to) return false;
      return true;
    });
    return rows.sort((a, b) => (regDay(a)! < regDay(b)! ? -1 : 1));
  }, [candidates, from, to]);

  // Aggregate summary for the range.
  const summary = useMemo(() => {
    const byCountry: Record<string, number> = {};
    const bySkill: Record<string, number> = {};
    let completed = 0;
    for (const c of inRange) {
      const country = c.country || 'Unspecified';
      byCountry[country] = (byCountry[country] ?? 0) + 1;
      const skill = c.candidate_skill ? SKILL_LABEL[c.candidate_skill] : 'Unspecified';
      bySkill[skill] = (bySkill[skill] ?? 0) + 1;
      if (c.is_completed) completed += 1;
    }
    return {
      total: inRange.length,
      completed,
      byCountry: Object.entries(byCountry).sort((a, b) => b[1] - a[1]),
      bySkill: Object.entries(bySkill).sort((a, b) => b[1] - a[1]),
    };
  }, [inRange]);

  const rangeInvalid = !!from && !!to && from > to;

  function handlePrint() {
    if (rangeInvalid) {
      toastError('“From” date is after the “To” date.');
      return;
    }
    const w = window.open('', '_blank', 'width=900,height=1200');
    if (!w) return;
    const esc = (s: unknown) =>
      String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const summaryRows = (entries: [string, number][]) =>
      entries.length
        ? entries.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="num">${v}</td></tr>`).join('')
        : '<tr><td colspan="2" class="empty">No data</td></tr>';

    const detailRows = inRange.length
      ? inRange
          .map(
            (c, i) => `
          <tr>
            <td class="num">${i + 1}</td>
            <td>${esc(fmtDate(c.registration_date))}</td>
            <td>${esc(c.registration_no)}</td>
            <td>${esc(c.candidate_reg_no || '—')}</td>
            <td>${esc(c.full_name)}</td>
            <td>${esc(c.country || '—')}</td>
            <td>${esc(c.candidate_skill ? SKILL_LABEL[c.candidate_skill] : '—')}</td>
            <td>${esc(jobCatName(c.job_category_id))}</td>
          </tr>`,
          )
          .join('')
      : '<tr><td colspan="8" class="empty">No registrations in this date range.</td></tr>';

    w.document.write(`
      <html><head><title>Registration Summary — ${esc(from)} to ${esc(to)}</title>
      <style>
        @page { size: A4 portrait; margin: 14mm 14mm; }
        * { box-sizing: border-box; }
        body { margin: 0; font-family: "Segoe UI", system-ui, sans-serif; color: #111; font-size: 12px; }
        .hdr { display: flex; align-items: center; gap: 14px; border-bottom: 2px solid #14486f; padding-bottom: 8px; margin-bottom: 4px; }
        .hdr img { height: 56px; width: auto; }
        .hdr .co { font-size: 16px; font-weight: 800; color: #14486f; }
        .hdr .meta { margin-left: auto; text-align: right; font-size: 11px; color: #333; }
        h1 { text-align: center; font-size: 16px; margin: 10px 0 2px; color: #14486f; }
        .sub { text-align: center; font-size: 12px; color: #444; margin-bottom: 14px; }
        .cards { display: flex; gap: 12px; margin-bottom: 16px; }
        .card { flex: 1; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; }
        .card .lbl { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: .04em; }
        .card .val { font-size: 22px; font-weight: 800; color: #14486f; }
        .split { display: flex; gap: 16px; margin-bottom: 16px; }
        .split > div { flex: 1; }
        h3 { font-size: 12px; margin: 0 0 6px; color: #14486f; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #cbd5e1; padding: 5px 7px; text-align: left; vertical-align: top; }
        th { background: #eef2f7; font-size: 10px; text-transform: uppercase; letter-spacing: .03em; color: #334155; }
        td.num, th.num { text-align: right; }
        .empty { text-align: center; color: #94a3b8; font-style: italic; }
        .foot { margin-top: 18px; font-size: 10px; color: #94a3b8; text-align: right; }
      </style></head>
      <body onload="window.print(); setTimeout(function(){ window.close(); }, 400);">
        <div class="hdr">
          <img src="${window.location.origin}${solidrowLogo}" alt="Solidrow" />
          <div class="co">Solidrow FESTI (PVT) LTD</div>
          <div class="meta">Overseas Careers<br/>Registration Report</div>
        </div>
        <h1>Candidate Registration Summary</h1>
        <div class="sub">Period: <b>${esc(fmtDate(from))}</b> to <b>${esc(fmtDate(to))}</b></div>

        <div class="cards">
          <div class="card"><div class="lbl">Total Registrations</div><div class="val">${summary.total}</div></div>
          <div class="card"><div class="lbl">Completed</div><div class="val">${summary.completed}</div></div>
          <div class="card"><div class="lbl">In Progress</div><div class="val">${summary.total - summary.completed}</div></div>
        </div>

        <div class="split">
          <div>
            <h3>By Country</h3>
            <table><thead><tr><th>Country</th><th class="num">Count</th></tr></thead>
            <tbody>${summaryRows(summary.byCountry)}</tbody></table>
          </div>
          <div>
            <h3>By Skill Type</h3>
            <table><thead><tr><th>Skill</th><th class="num">Count</th></tr></thead>
            <tbody>${summaryRows(summary.bySkill)}</tbody></table>
          </div>
        </div>

        <h3>Registrations (${summary.total})</h3>
        <table>
          <thead><tr>
            <th class="num">#</th><th>Reg Date</th><th>Registration No</th><th>Candidate Reg No</th>
            <th>Name</th><th>Country</th><th>Skill</th><th>Job Category</th>
          </tr></thead>
          <tbody>${detailRows}</tbody>
        </table>

        <div class="foot">Generated ${esc(fmtDate(toISO(today)))}</div>
      </body></html>`);
    w.document.close();
  }

  const cardStyle: React.CSSProperties = {
    background: 'var(--card)',
    borderRadius: 12,
    padding: 20,
    boxShadow: 'var(--card-shadow)',
  };

  return (
    <div className="fade-in-s">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 2 }}>Reports</div>
          <div style={{ fontSize: 14, color: 'var(--muted)' }}>
            Registration summary for a selected date range
          </div>
        </div>
        <button
          className="sr-btn-primary"
          onClick={handlePrint}
          disabled={loading || rangeInvalid}
          style={{
            padding: '11px 18px',
            borderRadius: 8,
            fontSize: 14,
            opacity: loading || rangeInvalid ? 0.5 : 1,
            cursor: loading || rangeInvalid ? 'not-allowed' : 'pointer',
          }}
        >
          Print Report
        </button>
      </div>

      {/* Date range selectors */}
      <div style={{ ...cardStyle, marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'flex-end' }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>
            From
          </label>
          <DatePicker value={from} onChange={setFrom} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>
            To
          </label>
          <DatePicker value={to} onChange={setTo} />
        </div>
        {rangeInvalid && (
          <div style={{ fontSize: 13, color: 'oklch(0.55 0.18 25)', fontWeight: 500 }}>
            “From” date must be on or before “To” date.
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div style={{ ...cardStyle, borderLeft: '3px solid oklch(0.55 0.16 250)' }}>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>Total Registrations</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'oklch(0.55 0.16 250)' }}>{summary.total}</div>
        </div>
        <div style={{ ...cardStyle, borderLeft: '3px solid oklch(0.55 0.16 150)' }}>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>Completed</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'oklch(0.5 0.14 150)' }}>{summary.completed}</div>
        </div>
        <div style={{ ...cardStyle, borderLeft: '3px solid oklch(0.6 0.16 60)' }}>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>In Progress</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'oklch(0.55 0.15 60)' }}>
            {summary.total - summary.completed}
          </div>
        </div>
      </div>

      {/* Breakdown tables */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 20 }}>
        <BreakdownCard title="By Country" entries={summary.byCountry} cardStyle={cardStyle} />
        <BreakdownCard title="By Skill Type" entries={summary.bySkill} cardStyle={cardStyle} />
      </div>

      {/* Detail list */}
      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', fontSize: 15, fontWeight: 700, borderBottom: '1px solid var(--border-soft)' }}>
          Registrations in range ({summary.total})
        </div>
        <div className="sr-table-scroll">
          <div style={{ minWidth: 780 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '48px 1fr 1fr 1.4fr 0.9fr 0.9fr 1.2fr',
                columnGap: 14,
                padding: '12px 20px',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--muted)',
                borderBottom: '1px solid var(--border-soft)',
              }}
            >
              <div>#</div>
              <div>Reg Date</div>
              <div>Registration No</div>
              <div>Name</div>
              <div>Country</div>
              <div>Skill</div>
              <div>Job Category</div>
            </div>

            {loading && <div style={{ padding: 20, fontSize: 13, color: 'var(--muted)' }}>Loading…</div>}

            {!loading && inRange.length === 0 && (
              <div style={{ padding: 20, fontSize: 13, color: 'var(--muted)' }}>
                No registrations in this date range.
              </div>
            )}

            {!loading &&
              inRange.map((c, i) => (
                <div
                  key={c.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '48px 1fr 1fr 1.4fr 0.9fr 0.9fr 1.2fr',
                    columnGap: 14,
                    padding: '12px 20px',
                    fontSize: 13,
                    alignItems: 'center',
                    borderBottom: '1px solid var(--row-border)',
                  }}
                >
                  <div style={{ color: 'var(--muted)' }}>{i + 1}</div>
                  <div style={{ whiteSpace: 'nowrap' }}>{fmtDate(c.registration_date)}</div>
                  <div style={{ color: 'var(--label-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.registration_no}
                  </div>
                  <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.full_name}>
                    {c.full_name}
                  </div>
                  <div style={{ color: 'var(--label-2)' }}>{c.country || '—'}</div>
                  <div style={{ color: 'var(--label-2)' }}>
                    {c.candidate_skill ? SKILL_LABEL[c.candidate_skill] : '—'}
                  </div>
                  <div style={{ color: 'var(--label-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {jobCatName(c.job_category_id)}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function BreakdownCard({
  title,
  entries,
  cardStyle,
}: {
  title: string;
  entries: [string, number][];
  cardStyle: React.CSSProperties;
}) {
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>{title}</div>
      {entries.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>No data</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {entries.map(([label, count]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--label)' }}>{label}</span>
              <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
