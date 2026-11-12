import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { EditIcon, EyeIcon, PlusIcon, TrashIcon } from '../components/icons';
import { confirmDelete, toastError, toastSuccess } from '../lib/alerts';
import { useAuth } from '../auth/AuthContext';
import { can } from '../lib/permissions';
import { journeyMeta } from '../lib/journeyStatus';
import type { Candidate } from '../types';

const GRID = '52px 1.4fr 1fr 1fr 1.4fr 0.9fr 0.9fr 84px 100px 120px';

const SKILL_LABEL: Record<string, string> = {
  skill: 'Skill',
  unskill: 'Unskill',
  training: 'Training',
};

/** Progress-status chip styles. `active` is the default and shows no chip. */
const STATUS_CHIP: Record<string, { label: string; bg: string; color: string }> = {
  on_hold: { label: 'On Hold', bg: 'oklch(0.94 0.06 90)', color: 'oklch(0.45 0.12 75)' },
  dropped: { label: 'Dropped', bg: 'oklch(0.93 0.05 25)', color: 'oklch(0.45 0.16 25)' },
  completed: { label: 'Completed', bg: 'oklch(0.92 0.06 150)', color: 'oklch(0.4 0.12 150)' },
};

const PAGE_SIZES = [10, 25, 50, 100];

type SortKey = 'registration_no' | 'candidate_reg_no' | 'registration_date' | 'full_name' | 'country' | 'candidate_skill';
type SortDir = 'asc' | 'desc';

type PagedCandidates = {
  data: Candidate[];
  total: number;
  last_page: number;
  all_total: number;
};

export default function CandidatesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canAdd = can(user, 'candidates.add');
  const canEdit = can(user, 'candidates.edit');
  const canDelete = can(user, 'candidates.delete');

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('full_name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [allTotal, setAllTotal] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

  // Wait until the user stops typing before hitting the server.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // Only the current page is fetched; search, sort and paging run in the database.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get<PagedCandidates>('/candidates', {
        params: { page, per_page: pageSize, q: debouncedSearch || undefined, sort: sortKey, dir: sortDir },
      })
      .then((res) => {
        if (cancelled) return;
        setCandidates(res.data.data);
        setTotal(res.data.total);
        setAllTotal(res.data.all_total);
        if (res.data.last_page < page) setPage(Math.max(1, res.data.last_page));
      })
      .catch(() => {
        if (!cancelled) toastError('Could not load candidates.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, debouncedSearch, sortKey, sortDir, reloadKey]);

  async function handleDelete(c: Candidate) {
    const ok = await confirmDelete(`Remove ${c.full_name} from candidates?`);
    if (!ok) return;
    try {
      await api.delete(`/candidates/${c.id}`);
      setReloadKey((k) => k + 1);
      toastSuccess('Candidate deleted');
    } catch {
      toastError('Could not delete candidate.');
    }
  }

  const submittedCount = (c: Candidate) =>
    c.submitted_sections_count ?? (c.sections ?? []).filter((s) => s.status === 'submitted').length;

  const q = debouncedSearch;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const pageRows = candidates;

  function toggleSort(key: SortKey) {
    setPage(1);
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const sortArrow = (key: SortKey) =>
    sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

  const fmtDate = (d: string | null) => {
    if (!d) return '—';
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return '—';
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const initials = (name: string) =>
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('');

  return (
    <div className="fade-in-s">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
        }}
      >
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 2 }}>Candidate Registration</div>
          <div style={{ fontSize: 14, color: 'var(--muted)' }}>
            {q ? `${total} of ${allTotal}` : allTotal} candidates
          </div>
        </div>
        {canAdd && (
          <button
            className="sr-btn-primary"
            onClick={() => navigate('/candidates/new')}
            style={{
              padding: '11px 18px',
              borderRadius: 8,
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <PlusIcon />
            New Registration
          </button>
        )}
      </div>

      <div style={{ marginBottom: 16, position: 'relative', maxWidth: 380 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, passport, mobile or NIC…"
          style={{
            width: '100%',
            padding: '10px 34px 10px 14px',
            borderRadius: 8,
            border: '1px solid var(--border-soft)',
            background: 'var(--card)',
            fontSize: 14,
            outline: 'none',
          }}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            aria-label="Clear search"
            style={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
              color: 'var(--muted)',
            }}
          >
            ×
          </button>
        )}
      </div>

      <div
        style={{
          background: 'var(--card)',
          borderRadius: 12,
          boxShadow: 'var(--card-shadow)',
          overflow: 'hidden',
        }}
      >
        <div className="sr-table-scroll">
        <div style={{ minWidth: 900 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: GRID,
            columnGap: 16,
            padding: '14px 20px',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--muted)',
            borderBottom: '1px solid var(--border-soft)',
          }}
        >
          <div />
          <div
            onClick={() => toggleSort('registration_no')}
            style={{ cursor: 'pointer', userSelect: 'none' }}
          >
            Registration No{sortArrow('registration_no')}
          </div>
          <div
            onClick={() => toggleSort('candidate_reg_no')}
            style={{ cursor: 'pointer', userSelect: 'none' }}
          >
            Candidate Reg No{sortArrow('candidate_reg_no')}
          </div>
          <div
            onClick={() => toggleSort('registration_date')}
            style={{ cursor: 'pointer', userSelect: 'none' }}
          >
            Reg Date{sortArrow('registration_date')}
          </div>
          <div
            onClick={() => toggleSort('full_name')}
            style={{ cursor: 'pointer', userSelect: 'none', minWidth: 0 }}
          >
            Name{sortArrow('full_name')}
          </div>
          <div onClick={() => toggleSort('country')} style={{ cursor: 'pointer', userSelect: 'none' }}>
            Country{sortArrow('country')}
          </div>
          <div
            onClick={() => toggleSort('candidate_skill')}
            style={{ cursor: 'pointer', userSelect: 'none' }}
          >
            Skill{sortArrow('candidate_skill')}
          </div>
          <div>Progress</div>
          <div>Status</div>
          <div />
        </div>

        {loading && candidates.length === 0 && (
          <div style={{ padding: '20px', fontSize: 13, color: 'var(--muted)' }}>Loading…</div>
        )}

        {!loading && allTotal === 0 && (
          <div style={{ padding: '20px', fontSize: 13, color: 'var(--muted)' }}>
            No candidates yet. Click “New Registration” to add one.
          </div>
        )}

        {!loading && allTotal > 0 && total === 0 && (
          <div style={{ padding: '20px', fontSize: 13, color: 'var(--muted)' }}>
            No candidates match “{search}”.
          </div>
        )}

        {pageRows.map((c) => {
          const journey = journeyMeta(c.journey_status);
          return (
          <div
            key={c.id}
            style={{
              display: 'grid',
              gridTemplateColumns: GRID,
              columnGap: 16,
              padding: '14px 20px',
              fontSize: 13,
              alignItems: 'center',
              borderBottom: '1px solid var(--row-border)',
              background: journey?.tint,
              boxShadow: journey ? `inset 4px 0 0 ${journey.color}` : undefined,
            }}
          >
            {c.passport_image_url ? (
              <img
                src={c.passport_image_url}
                alt={c.full_name}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '1px solid var(--border-soft)',
                }}
              />
            ) : (
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'oklch(0.45 0.05 250)',
                  background: 'oklch(0.93 0.03 250)',
                }}
              >
                {initials(c.full_name)}
              </div>
            )}
            <div style={{ fontWeight: 500, fontSize: 12, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.registration_no}</div>
            <div style={{ color: 'var(--label-2)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.candidate_reg_no || '—'}</div>
            <div style={{ color: 'var(--label-2)', whiteSpace: 'nowrap' }}>{fmtDate(c.registration_date)}</div>
            <div style={{ fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.full_name}>{c.full_name}</div>
            <div style={{ color: 'var(--label-2)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.country || '—'}</div>
            <div style={{ color: 'var(--label-2)' }}>
              {c.candidate_skill ? SKILL_LABEL[c.candidate_skill] : '—'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '3px 9px',
                  borderRadius: 999,
                  background: c.is_completed ? 'oklch(0.92 0.06 150)' : 'oklch(0.93 0.03 250)',
                  color: c.is_completed ? 'oklch(0.4 0.12 150)' : 'oklch(0.45 0.05 250)',
                }}
              >
                {submittedCount(c)}/6
              </span>
              {STATUS_CHIP[c.progress_status] && (
                <span
                  title={c.latest_remark?.reason ?? undefined}
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: STATUS_CHIP[c.progress_status].bg,
                    color: STATUS_CHIP[c.progress_status].color,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {STATUS_CHIP[c.progress_status].label}
                </span>
              )}
            </div>
            <div>
              {journey ? (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '3px 9px',
                    borderRadius: 999,
                    background: journey.bg,
                    color: journey.color,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {journey.label}
                </span>
              ) : (
                <span style={{ color: 'var(--muted)' }}>—</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="sr-icon-btn"
                onClick={() => navigate(`/candidates/${c.id}/view`)}
                aria-label="View"
                title="View details"
              >
                <EyeIcon />
              </button>
              {canEdit && (
                <button
                  className="sr-icon-btn"
                  onClick={() => navigate(`/candidates/${c.id}`)}
                  aria-label="Open"
                >
                  <EditIcon />
                </button>
              )}
              {canDelete && (
                <button className="sr-icon-btn" onClick={() => handleDelete(c)} aria-label="Delete">
                  <TrashIcon />
                </button>
              )}
            </div>
          </div>
          );
        })}
        </div>
        </div>

        {total > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
              padding: '12px 20px',
              borderTop: '1px solid var(--border-soft)',
              fontSize: 13,
              color: 'var(--muted)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>Rows per page</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                style={{
                  padding: '5px 8px',
                  borderRadius: 6,
                  border: '1px solid var(--border-soft)',
                  background: 'var(--card)',
                  fontSize: 13,
                }}
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span>
                {start + 1}–{Math.min(start + pageSize, total)} of {total}
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="sr-icon-btn"
                  onClick={() => setPage(currentPage - 1)}
                  disabled={currentPage <= 1}
                  aria-label="Previous page"
                  style={{ opacity: currentPage <= 1 ? 0.4 : 1 }}
                >
                  ‹
                </button>
                <span style={{ minWidth: 90, textAlign: 'center' }}>
                  Page {currentPage} / {totalPages}
                </span>
                <button
                  className="sr-icon-btn"
                  onClick={() => setPage(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  aria-label="Next page"
                  style={{ opacity: currentPage >= totalPages ? 0.4 : 1 }}
                >
                  ›
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
