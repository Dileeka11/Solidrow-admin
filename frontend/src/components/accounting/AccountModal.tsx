import { useEffect, useState } from 'react';
import type { AccountRow, ChartCategory } from '../../types';

interface Props {
  open: boolean;
  editing: AccountRow | null;
  chart: ChartCategory[];
  onClose: () => void;
  onSave: (data: { group_id: number; name: string; code: string; is_active: boolean }) => Promise<void>;
}

const fieldLabel: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 5,
  color: 'var(--label-2)',
};
const inputStyle: React.CSSProperties = { padding: '10px 12px', borderRadius: 7, fontSize: 14 };

export default function AccountModal({ open, editing, chart, onClose, onSave }: Props) {
  const [groupId, setGroupId] = useState<number | ''>('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setGroupId(editing?.group_id ?? '');
    setName(editing?.name ?? '');
    setCode(editing?.code ?? '');
    setIsActive(editing ? editing.is_active : true);
  }, [open, editing]);

  if (!open) return null;

  async function handleSave() {
    if (!groupId) {
      setError('Please select a group.');
      return;
    }
    if (!name.trim()) {
      setError('Account name is required.');
      return;
    }
    // Code is auto-generated on create when blank, but required when editing.
    if (editing && !code.trim()) {
      setError('Account code cannot be blank.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSave({ group_id: Number(groupId), name: name.trim(), code: code.trim(), is_active: isActive });
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })
        ?.response?.data;
      const firstFieldError = data?.errors ? Object.values(data.errors)[0]?.[0] : undefined;
      setError(firstFieldError ?? data?.message ?? 'Could not save. Please check the fields.');
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
        style={{ background: 'white', borderRadius: 14, width: 460, maxWidth: '90vw', padding: 28 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>
          {editing ? 'Edit Account' : 'Add Account'}
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={fieldLabel}>Group</label>
          <select
            className="sr-input"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : '')}
            style={inputStyle}
          >
            <option value="" disabled>
              Select a group…
            </option>
            {chart.map((cat) => (
              <optgroup key={cat.id} label={`${cat.code} · ${cat.name}`}>
                {cat.groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.code} · {g.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={fieldLabel}>Account Name</label>
          <input
            className="sr-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Petty Cash"
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: error ? 12 : 22, alignItems: 'end' }}>
          <div>
            <label style={fieldLabel}>
              Code {!editing && <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(auto if blank)</span>}
            </label>
            <input
              className="sr-input"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={editing ? '' : 'Leave blank to auto-generate'}
              style={inputStyle}
            />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, paddingBottom: 10 }}>
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Active
          </label>
        </div>

        {error && <div style={{ color: 'oklch(0.55 0.16 25)', fontSize: 13, marginBottom: 14 }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 16px',
              borderRadius: 8,
              fontSize: 14,
              background: 'var(--row-border, #f3f4f6)',
              border: '1px solid var(--border)',
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
            {busy ? 'Saving…' : editing ? 'Update' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}
