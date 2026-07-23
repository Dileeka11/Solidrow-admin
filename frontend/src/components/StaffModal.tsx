import { useEffect, useState } from 'react';
import { useIsMobile } from '../lib/useMediaQuery';
import type { Staff, StaffInput, StaffStatus } from '../types';

interface Props {
  open: boolean;
  editing: Staff | null;
  roles: string[];
  onClose: () => void;
  onSave: (data: StaffInput) => Promise<void>;
}

const EMPTY: StaffInput = {
  name: '',
  role: '',
  department: '',
  status: 'Active',
  email: '',
  password: '',
};

const fieldLabel: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 5,
  color: 'var(--label-2)',
};

export default function StaffModal({ open, editing, roles, onClose, onSave }: Props) {
  const isMobile = useIsMobile();
  const [form, setForm] = useState<StaffInput>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm(
      editing
        ? {
            name: editing.name,
            role: editing.role,
            department: editing.department,
            status: editing.status,
            email: editing.email,
            password: '',
          }
        : EMPTY,
    );
  }, [open, editing]);

  if (!open) return null;

  async function handleSave() {
    if (!form.name.trim()) {
      onClose();
      return;
    }
    if (!form.role) {
      setError('Please select a role.');
      return;
    }
    // Password is required for new staff (it's their login). Optional when editing.
    if (!editing && (form.password ?? '').length < 6) {
      setError('Password is required (min 6 characters) so the staff member can log in.');
      return;
    }
    if (editing && form.password && form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    // Don't send a blank password on edit — that would mean "keep current".
    const payload: StaffInput = { ...form };
    if (!payload.password) delete payload.password;

    setBusy(true);
    setError('');
    try {
      await onSave(payload);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Could not save. Please check the fields and try again.';
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'oklch(0 0 0 / 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        className="fade-in-xs"
        style={{
          background: 'white',
          borderRadius: 14,
          width: 460,
          maxWidth: '90vw',
          padding: 28,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>
          {editing ? 'Edit Staff Member' : 'Add Staff Member'}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <label style={fieldLabel}>Full Name</label>
            <input
              className="sr-input"
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              style={{ padding: '10px 12px', borderRadius: 7, fontSize: 14 }}
            />
          </div>
          <div>
            <label style={fieldLabel}>Role</label>
            <select
              className="sr-input"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              style={{ padding: '10px 12px', borderRadius: 7, fontSize: 14 }}
            >
              <option value="" disabled>
                Select a role…
              </option>
              {roles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
              {/* Keep an unknown existing role selectable when editing. */}
              {form.role && !roles.includes(form.role) && (
                <option value={form.role}>{form.role}</option>
              )}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <label style={fieldLabel}>Department</label>
            <input
              className="sr-input"
              type="text"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              style={{ padding: '10px 12px', borderRadius: 7, fontSize: 14 }}
            />
          </div>
          <div>
            <label style={fieldLabel}>Status</label>
            <select
              className="sr-input"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as StaffStatus })}
              style={{ padding: '10px 12px', borderRadius: 7, fontSize: 14 }}
            >
              <option value="Active">Active</option>
              <option value="On Leave">On Leave</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={fieldLabel}>Email</label>
          <input
            className="sr-input"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            style={{ padding: '10px 12px', borderRadius: 7, fontSize: 14 }}
          />
        </div>

        <div style={{ marginBottom: error ? 12 : 22 }}>
          <label style={fieldLabel}>
            Password {editing && <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(leave blank to keep current)</span>}
          </label>
          <input
            className="sr-input"
            type="password"
            placeholder={editing ? '••••••••' : 'Set a login password'}
            value={form.password ?? ''}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            style={{ padding: '10px 12px', borderRadius: 7, fontSize: 14 }}
          />
        </div>

        {error && (
          <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 18 }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 18px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'white',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
          <button
            className="sr-btn-primary"
            onClick={handleSave}
            disabled={busy}
            style={{ padding: '10px 18px', borderRadius: 8, fontSize: 14 }}
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
