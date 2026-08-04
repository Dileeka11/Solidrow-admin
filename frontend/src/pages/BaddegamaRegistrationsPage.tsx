import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { EditIcon, EyeIcon, TrashIcon } from '../components/icons';
import { confirmDelete, toastError, toastSuccess } from '../lib/alerts';
import { useAuth } from '../auth/AuthContext';
import { can } from '../lib/permissions';

type Row = {
  id: number;
  registration_code: string | null;
  full_name: string;
  nic: string | null;
  mobile_number: string | null;
  passport_number: string | null;
  result: string | null;
  created_at: string | null;
  type: number | null;
  location_name: string | null;
  agent_name: string | null;
};

type Location = { id: number; name: string; agent: string | null };

const GRID = '48px 1.5fr 1.1fr 1.1fr 1fr 1fr 1fr 0.9fr 0.9fr 1fr 108px';

const RESULT_COLOR: Record<string, { bg: string; fg: string }> = {
  Pass: { bg: 'oklch(0.92 0.06 150)', fg: 'oklch(0.4 0.12 150)' },
  'Pass + Training': { bg: 'oklch(0.93 0.06 250)', fg: 'oklch(0.42 0.12 250)' },
  Fail: { bg: 'oklch(0.92 0.06 25)', fg: 'oklch(0.45 0.15 25)' },
};

export default function BaddegamaRegistrationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canEdit = can(user, 'baddegama.edit');
  const canDelete = can(user, 'baddegama.delete');

  const [rows, setRows] = useState<Row[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState<string>('');

  async function load() {
    const res = await api.get<Row[]>('/baddegama-registrations');
    setRows(res.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    api.get<Location[]>('/baddegama-registrations/locations').then((r) => setLocations(r.data)).catch(() => {});
  }, []);

  async function handleDelete(r: Row) {
    const ok = await confirmDelete(`Remove ${r.full_name} from registrations?`);
    if (!ok) return;
    try {
      await api.delete(`/baddegama-registrations/${r.id}`);
      setRows((prev) => prev.filter((x) => x.id !== r.id));
      toastSuccess('Registration deleted');
    } catch {
      toastError('Could not delete registration.');
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (locationFilter && String(r.type ?? '') !== locationFilter) return false;
      if (!q) return true;
      return [r.full_name, r.registration_code, r.nic, r.mobile_number, r.passport_number]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [rows, search, locationFilter]);

  const fmtDate = (d: string | null) => {
    if (!d) return '—';
    const dt = new Date(d.replace(' ', 'T'));
    if (Number.isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  function exportExcel() {
    const headers = ['#', 'Full Name', 'Reg No', 'NIC', 'Mobile Number', 'Location', 'Foreign Agent', 'Passport No', 'Result', 'Created At'];
    const body = filtered
      .map((r, i) => {
        const cells = [
          i + 1, r.full_name, r.registration_code, r.nic, r.mobile_number,
          r.location_name ?? '', r.agent_name || 'Direct', r.passport_number ?? '', r.result ?? '', r.created_at ?? '',
        ];
        return `<tr>${cells.map((c) => `<td>${escapeHtml(String(c ?? ''))}</td>`).join('')}</tr>`;
      })
      .join('');
    const table = `<table border="1"><thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>`;
    const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>${table}</body></html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `baddegama-registrations-${new Date().toISOString().slice(0, 10)}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fade-in-s">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 2 }}>Manage All Registrations</div>
          <div style={{ fontSize: 14, color: 'var(--muted)' }}>{filtered.length} of {rows.length} registrations</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button className="sr-btn-secondary" onClick={() => navigate('/baddegama/locations')} style={{ padding: '11px 16px', borderRadius: 8, fontSize: 14, whiteSpace: 'nowrap' }}>
            Manage Locations
          </button>
          <button className="sr-btn-primary" onClick={exportExcel} style={{ padding: '11px 18px', borderRadius: 8, fontSize: 14, whiteSpace: 'nowrap' }}>
            Export Excel
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ position: 'relative', flex: '1 1 320px', maxWidth: 380 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, reg no, NIC, mobile or passport…"
            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-soft)', background: 'var(--card)', fontSize: 14, outline: 'none' }}
          />
        </div>
        <select
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value)}
          style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-soft)', background: 'var(--card)', fontSize: 14 }}
        >
          <option value="">Filter by Location — All</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>

      <div style={{ background: 'var(--card)', borderRadius: 12, boxShadow: 'var(--card-shadow)', overflow: 'hidden' }}>
        <div className="sr-table-scroll">
          <div style={{ minWidth: 1080 }}>
            <div style={{ display: 'grid', gridTemplateColumns: GRID, columnGap: 12, padding: '14px 20px', fontSize: 12, fontWeight: 600, color: 'var(--muted)', borderBottom: '1px solid var(--border-soft)' }}>
              <div>#</div><div>Full Name</div><div>Reg No</div><div>NIC</div><div>Mobile</div><div>Location</div><div>Foreign Agent</div><div>Passport No</div><div>Result</div><div>Created At</div><div>Action</div>
            </div>

            {loading && <div style={{ padding: 20, fontSize: 13, color: 'var(--muted)' }}>Loading…</div>}
            {!loading && filtered.length === 0 && <div style={{ padding: 20, fontSize: 13, color: 'var(--muted)' }}>No registrations found.</div>}

            {filtered.map((r, i) => {
              const rc = r.result ? RESULT_COLOR[r.result] : null;
              return (
                <div key={r.id} style={{ display: 'grid', gridTemplateColumns: GRID, columnGap: 12, padding: '13px 20px', fontSize: 13, alignItems: 'center', borderBottom: '1px solid var(--row-border)' }}>
                  <div style={{ color: 'var(--muted)' }}>{i + 1}</div>
                  <div style={{ fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.full_name}>{r.full_name}</div>
                  <div style={{ color: 'var(--label-2)', fontSize: 12 }}>{r.registration_code || '—'}</div>
                  <div style={{ color: 'var(--label-2)' }}>{r.nic || '—'}</div>
                  <div style={{ color: 'var(--label-2)' }}>{r.mobile_number || '—'}</div>
                  <div style={{ color: 'var(--label-2)' }}>{r.location_name || '—'}</div>
                  <div style={{ color: 'var(--label-2)' }}>{r.agent_name || 'Direct'}</div>
                  <div style={{ color: 'var(--label-2)' }}>{r.passport_number || '—'}</div>
                  <div>
                    {rc ? (
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 999, background: rc.bg, color: rc.fg }}>{r.result}</span>
                    ) : '—'}
                  </div>
                  <div style={{ color: 'var(--label-2)', whiteSpace: 'nowrap' }}>{fmtDate(r.created_at)}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="sr-icon-btn" onClick={() => navigate(`/baddegama/${r.id}/view`)} aria-label="View" title="View"><EyeIcon /></button>
                    {canEdit && <button className="sr-icon-btn" onClick={() => navigate(`/baddegama/${r.id}`)} aria-label="Edit" title="Edit"><EditIcon /></button>}
                    {canDelete && <button className="sr-icon-btn" onClick={() => handleDelete(r)} aria-label="Delete" title="Delete"><TrashIcon /></button>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
