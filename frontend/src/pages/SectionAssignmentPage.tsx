import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { confirmAction, toastError, toastSuccess } from '../lib/alerts';
import { useAuth } from '../auth/AuthContext';
import { can } from '../lib/permissions';
import type { Staff } from '../types';

const SECTION_TITLES = [
  'Personal Details',
  'Training Details',
  'Document Attachment',
  'Job & Visa Processing',
  'Employee Details',
  'Departure Details',
];

interface SectionAssignment {
  section_no: number;
  staff_ids: number[];
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 5,
  color: 'var(--label-2)',
};
const cardStyle: React.CSSProperties = {
  background: 'var(--card)',
  borderRadius: 12,
  boxShadow: 'var(--card-shadow)',
  padding: 24,
};

/** Compact checkbox dropdown for picking multiple staff members. */
function StaffMultiSelect({
  staff,
  value,
  disabled,
  onChange,
}: {
  staff: Staff[];
  value: number[];
  disabled?: boolean;
  onChange: (ids: number[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const selected = staff.filter((s) => value.includes(s.id));
  const summary =
    selected.length === 0
      ? '-- Assign staff --'
      : selected.length <= 2
        ? selected.map((s) => s.name).join(', ')
        : `${selected.length} staff selected`;

  const toggle = (id: number) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className="sr-input"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        style={{
          padding: '7px 10px',
          borderRadius: 7,
          fontSize: 14,
          width: '100%',
          textAlign: 'left',
          background: 'var(--card)',
          cursor: disabled ? 'default' : 'pointer',
          color: selected.length ? 'inherit' : 'var(--muted)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary}</span>
        <span style={{ fontSize: 10, color: 'var(--muted)' }}>▼</span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 20,
            background: 'var(--card)',
            border: '1px solid var(--border-soft)',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            maxHeight: 240,
            overflowY: 'auto',
            padding: 4,
          }}
        >
          {staff.length === 0 && (
            <div style={{ padding: '8px 10px', fontSize: 13, color: 'var(--muted)' }}>No staff available</div>
          )}
          {staff.map((s) => (
            <label
              key={s.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 8px',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              <input type="checkbox" checked={value.includes(s.id)} onChange={() => toggle(s.id)} />
              <span>{s.name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SectionAssignmentPage() {
  const { user } = useAuth();
  const canEdit = can(user, 'sections.edit');

  const [staff, setStaff] = useState<Staff[]>([]);
  const [assignments, setAssignments] = useState<Record<number, number[]>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<Staff[]>('/staff').then((r) => setStaff(r.data)).catch(() => setStaff([]));
    api
      .get<SectionAssignment[]>('/section-assignments')
      .then((r) => {
        const map: Record<number, number[]> = {};
        r.data.forEach((a) => {
          map[a.section_no] = a.staff_ids ?? [];
        });
        setAssignments(map);
      })
      .catch(() => setAssignments({}));
  }, []);

  async function handleSave() {
    const ok = await confirmAction('Save these section assignments?', 'Save assignments', 'Yes, save');
    if (!ok) return;
    setSaving(true);
    try {
      const r = await api.put<SectionAssignment[]>('/section-assignments', { assignments });
      const map: Record<number, number[]> = {};
      r.data.forEach((a) => {
        map[a.section_no] = a.staff_ids ?? [];
      });
      setAssignments(map);
      toastSuccess('Section assignments saved');
    } catch {
      toastError('Could not save assignments.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fade-in-s" style={{ maxWidth: 760 }}>
      <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>Section Assignment</div>
      <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20 }}>
        Assign one or more staff members to each section. This mapping applies to every candidate — new
        candidates are created with these assignments, and open (not-yet-submitted) sections of existing
        candidates are kept in sync.
      </div>

      <div style={cardStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {SECTION_TITLES.map((title, i) => {
            const n = i + 1;
            return (
              <div
                key={n}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '30px 1.6fr 1.4fr',
                  gap: 12,
                  alignItems: 'center',
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: 'var(--row-bg, #fafafa)',
                  border: '1px solid var(--border-soft)',
                }}
              >
                <div style={{ fontWeight: 700, color: 'var(--muted)' }}>{n}</div>
                <div>
                  <label style={labelStyle}>{title}</label>
                </div>
                <StaffMultiSelect
                  staff={staff}
                  value={assignments[n] ?? []}
                  disabled={!canEdit}
                  onChange={(ids) => setAssignments((a) => ({ ...a, [n]: ids }))}
                />
              </div>
            );
          })}
        </div>

        {canEdit && (
          <div style={{ marginTop: 18 }}>
            <button
              className="sr-btn-primary"
              onClick={handleSave}
              disabled={saving}
              style={{ padding: '10px 18px', borderRadius: 8, fontSize: 14 }}
            >
              {saving ? 'Saving…' : 'Save Assignments'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
