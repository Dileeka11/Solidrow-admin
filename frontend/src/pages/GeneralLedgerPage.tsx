import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { toastError } from '../lib/alerts';
import { useIsMobile } from '../lib/useMediaQuery';
import type { AccountRow, GeneralLedger } from '../types';

const inputStyle: React.CSSProperties = { padding: '9px 12px', borderRadius: 7, fontSize: 14, width: '100%' };
const fieldLabel: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 5, color: 'var(--label-2)' };

function money(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function GeneralLedgerPage() {
  const isMobile = useIsMobile();
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [accountId, setAccountId] = useState<number | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [ledger, setLedger] = useState<GeneralLedger | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .get<AccountRow[]>('/accounting/accounts')
      .then((res) => setAccounts(res.data))
      .catch(() => setAccounts([]));
  }, []);

  const accountGroups = useMemo(() => {
    const map = new Map<string, { label: string; accounts: AccountRow[] }>();
    for (const a of accounts) {
      const key = a.group_code;
      if (!map.has(key)) map.set(key, { label: `${a.group_code} · ${a.group_name}`, accounts: [] });
      map.get(key)!.accounts.push(a);
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [accounts]);

  async function run() {
    if (!accountId) {
      toastError('Please select an account.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.get<GeneralLedger>('/accounting/general-ledger', {
        params: { account_id: accountId, from: from || undefined, to: to || undefined },
      });
      setLedger(res.data);
    } catch (err: unknown) {
      toastError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Could not load the ledger.',
      );
      setLedger(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fade-in-s">
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 2 }}>General Ledger</div>
        <div style={{ fontSize: 14, color: 'var(--muted)' }}>Running balance for a single account over a date range.</div>
      </div>

      {/* Filters */}
      <div
        style={{
          background: 'var(--card)',
          borderRadius: 12,
          boxShadow: 'var(--card-shadow)',
          padding: 20,
          marginBottom: 16,
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 170px 170px 120px',
          gap: 12,
          alignItems: 'end',
        }}
      >
        <div>
          <label style={fieldLabel}>Account</label>
          <select className="sr-input" value={accountId} onChange={(e) => setAccountId(e.target.value ? Number(e.target.value) : '')} style={inputStyle}>
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
        </div>
        <div>
          <label style={fieldLabel}>From</label>
          <input className="sr-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={fieldLabel}>To</label>
          <input className="sr-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} style={inputStyle} />
        </div>
        <button className="sr-btn-primary" onClick={run} disabled={loading} style={{ padding: '10px 18px', borderRadius: 8, fontSize: 14 }}>
          {loading ? 'Loading…' : 'View'}
        </button>
      </div>

      {ledger && (
        <div style={{ background: 'var(--card)', borderRadius: 12, boxShadow: 'var(--card-shadow)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--row-border)' }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              {ledger.account.code} · {ledger.account.name}
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              Opening balance: <b style={{ fontFamily: 'monospace' }}>{money(ledger.opening_balance)}</b>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr 90px 90px' : '110px 110px 1fr 120px 120px 130px',
              columnGap: 12,
              padding: '10px 20px',
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--muted)',
              borderBottom: '1px solid var(--row-border)',
              textTransform: 'uppercase',
            }}
          >
            {!isMobile && <div>Doc No</div>}
            <div>Date</div>
            {!isMobile && <div>Memo</div>}
            <div style={{ textAlign: 'right' }}>Debit</div>
            <div style={{ textAlign: 'right' }}>Credit</div>
            <div style={{ textAlign: 'right' }}>Balance</div>
          </div>

          {ledger.lines.length === 0 && (
            <div style={{ padding: '16px 20px', fontSize: 13, color: 'var(--muted)' }}>No postings in this range.</div>
          )}
          {ledger.lines.map((l) => (
            <div
              key={`${l.entry_id}-${l.doc_no}-${l.balance}`}
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr 90px 90px' : '110px 110px 1fr 120px 120px 130px',
                columnGap: 12,
                padding: '10px 20px',
                fontSize: 13,
                alignItems: 'center',
                borderBottom: '1px solid var(--row-border)',
              }}
            >
              {!isMobile && <div style={{ fontFamily: 'monospace', fontSize: 12 }}>{l.doc_no}</div>}
              <div>{l.date}</div>
              {!isMobile && <div style={{ color: 'var(--muted)' }}>{l.memo ?? '—'}</div>}
              <div style={{ textAlign: 'right', fontFamily: 'monospace' }}>{l.debit ? money(l.debit) : '—'}</div>
              <div style={{ textAlign: 'right', fontFamily: 'monospace' }}>{l.credit ? money(l.credit) : '—'}</div>
              <div style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{money(l.balance)}</div>
            </div>
          ))}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr 90px 90px' : '110px 110px 1fr 120px 120px 130px',
              columnGap: 12,
              padding: '12px 20px',
              fontSize: 13,
              fontWeight: 700,
              background: 'oklch(0.98 0.005 250)',
            }}
          >
            {!isMobile && <div />}
            <div>Totals</div>
            {!isMobile && <div />}
            <div style={{ textAlign: 'right', fontFamily: 'monospace' }}>{money(ledger.total_debit)}</div>
            <div style={{ textAlign: 'right', fontFamily: 'monospace' }}>{money(ledger.total_credit)}</div>
            <div style={{ textAlign: 'right', fontFamily: 'monospace' }}>{money(ledger.closing_balance)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
