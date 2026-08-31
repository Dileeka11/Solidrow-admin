import { useEffect, useState } from 'react';
import type { AccountRow, ChartCategory } from '../../types';

export interface AccountSaveData {
  group_id?: number;
  parent_id?: number;
  name: string;
  is_active: boolean;
}

interface Props {
  open: boolean;
  editing: AccountRow | null;
  /** When set, we're adding a sub-account under this row (group is inherited). */
  parent: AccountRow | null;
  chart: ChartCategory[];
  /** Full accounts list used to populate the optional parent dropdown. */
  accounts: AccountRow[];
  onClose: () => void;
  onSave: (data: AccountSaveData) => Promise<void>;
}

const fieldLabel: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 5,
  color: 'var(--label-2)',
};
const inputStyle: React.CSSProperties = { padding: '10px 12px', borderRadius: 7, fontSize: 14 };
const readonlyBox: React.CSSProperties = {
  ...inputStyle,
  background: 'var(--row-border, #f3f4f6)',
  border: '1px solid var(--border)',
  color: 'var(--muted)',
  fontFamily: 'monospace',
};

export default function AccountModal({ open, editing, parent, chart, accounts, onClose, onSave }: Props) {
  const [groupId, setGroupId] = useState<number | ''>('');
  const [selectedParentId, setSelectedParentId] = useState<number | ''>('');
  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // A sub-account inherits its group from the parent prop (via the table "+" button).
  // When adding top-level, the user may optionally pick a parent from the dropdown.
  const isSubAccount = !editing && !!parent;
  const showGroupSelector = !editing && !parent && !selectedParentId;
  // The parent selected via the dropdown (when using "+ New Account").
  const chosenParent = selectedParentId ? accounts.find((a) => a.id === Number(selectedParentId)) : null;

  useEffect(() => {
    if (!open) return;
    setError('');
    setGroupId(editing?.group_id ?? '');
    setSelectedParentId('');
    setName(editing?.name ?? '');
    setIsActive(editing ? editing.is_active : true);
  }, [open, editing, parent]);

  if (!open) return null;

  const title = editing ? 'Edit Account' : isSubAccount || selectedParentId ? 'Add Sub-account' : 'Add Account';

  async function handleSave() {
    if (showGroupSelector && !groupId) {
      setError('Please select a group.');
      return;
    }
    if (!name.trim()) {
      setError('Account name is required.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const data: AccountSaveData = { name: name.trim(), is_active: isActive };
      if (isSubAccount && parent) data.parent_id = parent.id;
      else if (selectedParentId) data.parent_id = Number(selectedParentId);
      else if (showGroupSelector) data.group_id = Number(groupId);
      await onSave(data);
    } catch (err: unknown) {
      const resp = (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })
        ?.response?.data;
      const firstFieldError = resp?.errors ? Object.values(resp.errors)[0]?.[0] : undefined;
      setError(firstFieldError ?? resp?.message ?? 'Could not save. Please check the fields.');
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
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>{title}</div>

        {/* Sub-account: parent shown read-only (group is inherited). */}
        {isSubAccount && parent && (
          <div style={{ marginBottom: 14 }}>
            <label style={fieldLabel}>Under</label>
            <div style={readonlyBox}>
              {parent.code} · {parent.name}
            </div>
          </div>
        )}

        {/* Top-level new account: optional parent account selector. */}
        {!editing && !parent && (
          <div style={{ marginBottom: 14 }}>
            <label style={fieldLabel}>Parent Account <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(optional)</span></label>
            <select
              className="sr-input"
              value={selectedParentId}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : '';
                setSelectedParentId(val);
                setGroupId('');
              }}
              style={inputStyle}
            >
              <option value="">None (top-level account)</option>
              {accounts
                .filter((a) => a.is_active)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} · {a.name}
                  </option>
                ))}
            </select>
            {chosenParent && (
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                Group: {chosenParent.group_code} · {chosenParent.group_name}
              </div>
            )}
          </div>
        )}

        {/* Top-level account: pick the group it rolls up to (only when no parent selected). */}
        {showGroupSelector && (
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
        )}

        {/* Editing: show the (locked) code + group for context. */}
        {editing && (
          <div style={{ marginBottom: 14 }}>
            <label style={fieldLabel}>Code (auto-generated · locked)</label>
            <div style={readonlyBox}>{editing.code}</div>
          </div>
        )}

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

        <div style={{ marginBottom: error ? 12 : 22 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Active
          </label>
        </div>

        {!editing && (
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: error ? 12 : 20 }}>
            The account code is generated automatically.
          </div>
        )}

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
