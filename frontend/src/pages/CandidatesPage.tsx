import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { EditIcon, EyeIcon, PlusIcon, TrashIcon } from '../components/icons';
import { confirmDelete, toastError, toastSuccess } from '../lib/alerts';
import { useAuth } from '../auth/AuthContext';
import { can } from '../lib/permissions';
import type { Candidate } from '../types';

const GRID = '52px 1.5fr 1.1fr 1.5fr 1fr 1fr 100px 120px';

const SKILL_LABEL: Record<string, string> = {
  skill: 'Skill',
  unskill: 'Unskill',
  training: 'Training',
};

const PAGE_SIZES = [10, 25, 50, 100];

type SortKey = 'registration_no' | 'candidate_reg_no' | 'full_name' | 'country' | 'candidate_skill';
type SortDir = 'asc' | 'desc';

export default function CandidatesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canAdd = can(user, 'candidates.add');
  const canEdit = can(user, 'candidates.edit');
  const canDelete = can(user, 'candidates.delete');

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('full_name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  async function load() {
    const res = await api.get<Candidate[]>('/candidates');
    setCandidates(res.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(c: Candidate) {
    const ok = await confirmDelete(`Remove ${c.full_name} from candidates?`);
    if (!ok) return;
    try {
      await api.delete(`/candidates/${c.id}`);
      setCandidates((prev) => prev.filter((row) => row.id !== c.id));
      toastSuccess('Candidate deleted');
    } catch {
      toastError('Could not delete candidate.');
    }
  }

  const submittedCount = (c: Candidate) =>
    (c.sections ?? []).filter((s) => s.status === 'submitted').length;

  const q = search.trim().toLowerCase();
  const filtered = q
    ? candidates.filter((c) =>
        [
          c.full_name,
          c.passport_number,
          c.nic,
          c.phone_number,
          c.whatsapp_number,
          c.candidate_reg_no,
          c.registration_no,
        ]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q)),
      )
    : candidates;

  const sorted = [...filtered].sort((a, b) => {
    const av = String(a[sortKey] ?? '').toLowerCase();
    const bv = String(b[sortKey] ?? '').toLowerCase();
    const cmp = av.localeCompare(bv, undefined, { numeric: true });
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const pageRows = sorted.slice(start, start + pageSize);

  // Reset to first page whenever the result set changes
  useEffect(() => {
    setPage(1);
  }, [q, sortKey, sortDir, pageSize]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const sortArrow = (key: SortKey) =>
    sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

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
            {q ? `${filtered.length} of ${candidates.length}` : candidates.length} candidates
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
        <div style={{ minWidth: 780 }}>
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
          <div onClick={() => toggleSort('full_name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
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
          <div />
        </div>

        {loading && (
          <div style={{ padding: '20px', fontSize: 13, color: 'var(--muted)' }}>Loading…</div>
        )}

        {!loading && candidates.length === 0 && (
          <div style={{ padding: '20px', fontSize: 13, color: 'var(--muted)' }}>
            No candidates yet. Click “New Registration” to add one.
          </div>
        )}

        {!loading && candidates.length > 0 && filtered.length === 0 && (
          <div style={{ padding: '20px', fontSize: 13, color: 'var(--muted)' }}>
            No candidates match “{search}”.
          </div>
        )}

        {pageRows.map((c) => (
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
            <div style={{ fontWeight: 500, fontSize: 12 }}>{c.registration_no}</div>
            <div style={{ color: 'var(--label-2)' }}>{c.candidate_reg_no || '—'}</div>
            <div style={{ fontWeight: 500 }}>{c.full_name}</div>
            <div style={{ color: 'var(--label-2)' }}>{c.country || '—'}</div>
            <div style={{ color: 'var(--label-2)' }}>
              {c.candidate_skill ? SKILL_LABEL[c.candidate_skill] : '—'}
            </div>
            <div>
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
        ))}
        </div>
        </div>

        {!loading && sorted.length > 0 && (
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
                onChange={(e) => setPageSize(Number(e.target.value))}
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
                {start + 1}–{Math.min(start + pageSize, sorted.length)} of {sorted.length}
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
