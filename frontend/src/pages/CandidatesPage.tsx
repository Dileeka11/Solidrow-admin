import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { EditIcon, PlusIcon, TrashIcon } from '../components/icons';
import { confirmDelete, toastError, toastSuccess } from '../lib/alerts';
import { useAuth } from '../auth/AuthContext';
import { can } from '../lib/permissions';
import type { Candidate } from '../types';

const GRID = '1.6fr 1.2fr 1.6fr 1fr 1fr 110px 90px';

const SKILL_LABEL: Record<string, string> = {
  skill: 'Skill',
  unskill: 'Unskill',
  training: 'Training',
};

export default function CandidatesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canAdd = can(user, 'candidates.add');
  const canEdit = can(user, 'candidates.edit');
  const canDelete = can(user, 'candidates.delete');

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);

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
          <div style={{ fontSize: 14, color: 'var(--muted)' }}>{candidates.length} candidates</div>
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

      <div
        style={{
          background: 'var(--card)',
          borderRadius: 12,
          boxShadow: 'var(--card-shadow)',
          overflow: 'hidden',
        }}
      >
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
          <div>Registration No</div>
          <div>Candidate Reg No</div>
          <div>Name</div>
          <div>Country</div>
          <div>Skill</div>
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

        {candidates.map((c) => (
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
                {submittedCount(c)}/8
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
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
  );
}
