import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { PlusIcon, TrashIcon } from '../components/icons';
import { toastError, toastSuccess } from '../lib/alerts';
import type { AccountRow, JournalDraftLine } from '../types';

const inputStyle: React.CSSProperties = { padding: '9px 12px', borderRadius: 7, fontSize: 14, width: '100%' };
const fieldLabel: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 5, color: 'var(--label-2)' };

const today = () => new Date().toISOString().slice(0, 10);
const emptyLine = (): JournalDraftLine => ({ account_id: '', dr_cr: '', amount: '', memo: '' });

function money(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ManualJournalEntryPage() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [entryDate, setEntryDate] = useState(today());
  const [postingDate, setPostingDate] = useState(today());
  const [reference, setReference] = useState('');
  const [memo, setMemo] = useState('');
  const [lines, setLines] = useState<JournalDraftLine[]>([emptyLine(), emptyLine()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<AccountRow[]>('/accounting/accounts')
      // Only leaf (postable) accounts — header accounts roll up their children.
      .then((res) => setAccounts(res.data.filter((a) => a.is_active && a.is_postable)))
      .catch(() => setAccounts([]));
  }, []);

  // Active accounts grouped by their group, for the line dropdown's optgroups.
  const accountGroups = useMemo(() => {
    const map = new Map<string, { label: string; accounts: AccountRow[] }>();
    for (const a of accounts) {
      const key = a.group_code;
      if (!map.has(key)) map.set(key, { label: `${a.group_code} · ${a.group_name}`, accounts: [] });
      map.get(key)!.accounts.push(a);
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [accounts]);

  const totals = useMemo(() => {
    let debit = 0;
    let credit = 0;
    for (const l of lines) {
      const amt = parseFloat(l.amount) || 0;
      if (l.dr_cr === 'debit') debit += amt;
      else if (l.dr_cr === 'credit') credit += amt;
    }
    return { debit, credit, diff: Math.round((debit - credit) * 100) / 100 };
  }, [lines]);

  const balanced = totals.diff === 0 && totals.debit > 0;

  function updateLine(i: number, patch: Partial<JournalDraftLine>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(i: number) {
    setLines((prev) => (prev.length <= 2 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  async function handlePost() {
    // Keep only rows the user actually filled in.
    const cleaned = lines
      .filter((l) => l.account_id !== '' && l.dr_cr !== '' && parseFloat(l.amount) > 0)
      .map((l) => ({
        account_id: Number(l.account_id),
        dr_cr: l.dr_cr,
        amount: parseFloat(l.amount),
        memo: l.memo.trim() || null,
      }));

    if (cleaned.length < 2) {
      toastError('A journal entry needs at least two lines (a debit and a credit).');
      return;
    }
    if (!balanced) {
      toastError(`Entry is not balanced. Debit ${money(totals.debit)} ≠ Credit ${money(totals.credit)}.`);
      return;
    }

    setSaving(true);
    try {
      await api.post('/accounting/journal-entries', {
        entry_date: entryDate,
        posting_date: postingDate,
        reference: reference.trim() || null,
        memo: memo.trim() || null,
        lines: cleaned,
      });
      toastSuccess('Journal entry posted');
      navigate('/accounting/ledger');
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })
        ?.response?.data;
      const firstFieldError = data?.errors ? Object.values(data.errors)[0]?.[0] : undefined;
      toastError(firstFieldError ?? data?.message ?? 'Could not post the entry.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fade-in-s" style={{ maxWidth: 920 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 2 }}>Manual Journal Entry</div>
        <div style={{ fontSize: 14, color: 'var(--muted)' }}>Post a balanced double-entry voucher.</div>
      </div>

      {/* Header */}
      <div style={{ background: 'var(--card)', borderRadius: 12, boxShadow: 'var(--card-shadow)', padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
          <div>
            <label style={fieldLabel}>Document Date</label>
            <input className="sr-input" type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={fieldLabel}>Posting Date</label>
            <input className="sr-input" type="date" value={postingDate} onChange={(e) => setPostingDate(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={fieldLabel}>Reference</label>
            <input className="sr-input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional" style={inputStyle} />
          </div>
          <div>
            <label style={fieldLabel}>Memo</label>
            <input className="sr-input" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Optional" style={inputStyle} />
          </div>
        </div>
      </div>

      {/* Lines */}
      <div style={{ background: 'var(--card)', borderRadius: 12, boxShadow: 'var(--card-shadow)', overflow: 'hidden', marginBottom: 16 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 110px 150px 1fr 44px',
            columnGap: 12,
            padding: '12px 20px',
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--muted)',
            borderBottom: '1px solid var(--row-border)',
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
          }}
        >
          <div>Account</div>
          <div>Dr / Cr</div>
          <div>Amount</div>
          <div>Text</div>
          <div />
        </div>

        {lines.map((line, i) => (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 110px 150px 1fr 44px',
              columnGap: 12,
              padding: '10px 20px',
              alignItems: 'center',
              borderBottom: '1px solid var(--row-border)',
            }}
          >
            <select
              className="sr-input"
              value={line.account_id}
              onChange={(e) => updateLine(i, { account_id: e.target.value ? Number(e.target.value) : '' })}
              style={inputStyle}
            >
              <option value="">Select account…</option>
              {accountGroups.map((grp) => (
                <optgroup key={grp.label} label={grp.label}>
                  {grp.accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} · {a.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <select
              className="sr-input"
              value={line.dr_cr}
              onChange={(e) => updateLine(i, { dr_cr: e.target.value as JournalDraftLine['dr_cr'] })}
              style={inputStyle}
            >
              <option value="">—</option>
              <option value="debit">Debit</option>
              <option value="credit">Credit</option>
            </select>
            <input
              className="sr-input"
              type="number"
              min="0"
              step="0.01"
              value={line.amount}
              onChange={(e) => updateLine(i, { amount: e.target.value })}
              placeholder="0.00"
              style={{ ...inputStyle, textAlign: 'right' }}
            />
            <input
              className="sr-input"
              value={line.memo}
              onChange={(e) => updateLine(i, { memo: e.target.value })}
              placeholder="Line text"
              style={inputStyle}
            />
            <button
              onClick={() => removeLine(i)}
              disabled={lines.length <= 2}
              title="Remove line"
              style={{
                background: 'none',
                border: 'none',
                cursor: lines.length <= 2 ? 'not-allowed' : 'pointer',
                color: lines.length <= 2 ? 'var(--border)' : 'oklch(0.55 0.16 25)',
                padding: 4,
              }}
            >
              <TrashIcon />
            </button>
          </div>
        ))}

        <div style={{ padding: '12px 20px' }}>
          <button
            onClick={addLine}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--accent, #6366f1)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <PlusIcon />
            Add line
          </button>
        </div>
      </div>

      {/* Balance bar + actions */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
          background: 'var(--card)',
          borderRadius: 12,
          boxShadow: 'var(--card-shadow)',
          padding: '16px 20px',
        }}
      >
        <div style={{ display: 'flex', gap: 24, fontSize: 14 }}>
          <div>
            <span style={{ color: 'var(--muted)' }}>Debit </span>
            <b style={{ fontFamily: 'monospace' }}>{money(totals.debit)}</b>
          </div>
          <div>
            <span style={{ color: 'var(--muted)' }}>Credit </span>
            <b style={{ fontFamily: 'monospace' }}>{money(totals.credit)}</b>
          </div>
          <div
            style={{
              fontWeight: 700,
              color: balanced ? 'oklch(0.45 0.13 150)' : 'oklch(0.55 0.16 25)',
            }}
          >
            {balanced ? '✓ Balanced' : `Difference ${money(Math.abs(totals.diff))}`}
          </div>
        </div>
        <button
          className="sr-btn-primary"
          onClick={handlePost}
          disabled={saving || !balanced}
          style={{ padding: '11px 22px', borderRadius: 8, fontSize: 14, opacity: balanced ? 1 : 0.6 }}
        >
          {saving ? 'Posting…' : 'Post Entry'}
        </button>
      </div>
    </div>
  );
}
