import { useEffect, useState } from 'react';
import type { AccountCategory, NormalBalance, StatementType } from '../../types';

interface Props {
  open: boolean;
  editing: AccountCategory | null;
  onClose: () => void;
  onSave: (data: {
    code: string;
    name: string;
    normal_balance: NormalBalance;
    statement_type: StatementType;
  }) => Promise<void>;
}

const fieldLabel: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 5,
  color: 'var(--label-2)',
};
const inputStyle: React.CSSProperties = { padding: '10px 12px', borderRadius: 7, fontSize: 14 };

export default function CategoryModal({ open, editing, onClose, onSave }: Props) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [normalBalance, setNormalBalance] = useState<NormalBalance>('debit');
  const [statementType, setStatementType] = useState<StatementType>('BS');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setCode(editing?.code ?? '');
    setName(editing?.name ?? '');
    setNormalBalance(editing?.normal_balance ?? 'debit');
    setStatementType(editing?.statement_type ?? 'BS');
  }, [open, editing]);

  if (!open) return null;

  async function handleSave() {
    if (!code.trim() || !name.trim()) {
      setError('Code and name are required.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSave({
        code: code.trim(),
        name: name.trim(),
        normal_balance: normalBalance,
        statement_type: statementType,
      });
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
        style={{ background: 'white', borderRadius: 14, width: 440, maxWidth: '90vw', padding: 28 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>
          {editing ? 'Edit Category' : 'Add Category'}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <label style={fieldLabel}>Code</label>
            <input
              className="sr-input"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="1000"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={fieldLabel}>Name</label>
            <input
              className="sr-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Assets"
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: error ? 12 : 22 }}>
          <div>
            <label style={fieldLabel}>Normal Balance</label>
            <select
              className="sr-input"
              value={normalBalance}
              onChange={(e) => setNormalBalance(e.target.value as NormalBalance)}
              style={inputStyle}
            >
              <option value="debit">Debit (Assets, Expenses)</option>
              <option value="credit">Credit (Liabilities, Equity, Income)</option>
            </select>
          </div>
          <div>
            <label style={fieldLabel}>Statement</label>
            <select
              className="sr-input"
              value={statementType}
              onChange={(e) => setStatementType(e.target.value as StatementType)}
              style={inputStyle}
            >
              <option value="BS">Balance Sheet</option>
              <option value="PNL">Profit &amp; Loss</option>
            </select>
          </div>
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
