import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useIsMobile } from '../lib/useMediaQuery';
import type { TrialBalance } from '../types';

const inputStyle: React.CSSProperties = { padding: '9px 12px', borderRadius: 7, fontSize: 14, width: '100%' };
const fieldLabel: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 5, color: 'var(--label-2)' };

function money(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function TrialBalancePage() {
  const isMobile = useIsMobile();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [tb, setTb] = useState<TrialBalance | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    try {
      const res = await api.get<TrialBalance>('/accounting/trial-balance', {
        params: { from: from || undefined, to: to || undefined },
      });
      setTb(res.data);
    } catch {
      setTb(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fade-in-s" style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 2 }}>Trial Balance</div>
        <div style={{ fontSize: 14, color: 'var(--muted)' }}>Every account with a movement — total debits must equal total credits.</div>
      </div>

      <div
        style={{
          background: 'var(--card)',
          borderRadius: 12,
          boxShadow: 'var(--card-shadow)',
          padding: 20,
          marginBottom: 16,
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 120px',
          gap: 12,
          alignItems: 'end',
        }}
      >
        <div>
          <label style={fieldLabel}>From</label>
          <input className="sr-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={fieldLabel}>To</label>
          <input className="sr-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} style={inputStyle} />
        </div>
        <button className="sr-btn-primary" onClick={run} disabled={loading} style={{ padding: '10px 18px', borderRadius: 8, fontSize: 14 }}>
          {loading ? 'Loading…' : 'Run'}
        </button>
      </div>

      {tb && (
        <div style={{ background: 'var(--card)', borderRadius: 12, boxShadow: 'var(--card-shadow)', overflow: 'hidden' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '110px 1fr 130px 130px',
              columnGap: 12,
              padding: '12px 20px',
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--muted)',
              borderBottom: '1px solid var(--row-border)',
              textTransform: 'uppercase',
            }}
          >
            <div>Code</div>
            <div>Account</div>
            <div style={{ textAlign: 'right' }}>Debit</div>
            <div style={{ textAlign: 'right' }}>Credit</div>
          </div>

          {tb.rows.length === 0 && (
            <div style={{ padding: '16px 20px', fontSize: 13, color: 'var(--muted)' }}>No movements in this range.</div>
          )}
          {tb.rows.map((r) => (
            <div
              key={r.code}
              style={{
                display: 'grid',
                gridTemplateColumns: '110px 1fr 130px 130px',
                columnGap: 12,
                padding: '10px 20px',
                fontSize: 13,
                alignItems: 'center',
                borderBottom: '1px solid var(--row-border)',
              }}
            >
              <div style={{ fontFamily: 'monospace', fontWeight: 600 }}>{r.code}</div>
              <div>{r.name}</div>
              <div style={{ textAlign: 'right', fontFamily: 'monospace' }}>{r.debit ? money(r.debit) : '—'}</div>
              <div style={{ textAlign: 'right', fontFamily: 'monospace' }}>{r.credit ? money(r.credit) : '—'}</div>
            </div>
          ))}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '110px 1fr 130px 130px',
              columnGap: 12,
              padding: '13px 20px',
              fontSize: 14,
              fontWeight: 700,
              background: 'oklch(0.98 0.005 250)',
            }}
          >
            <div />
            <div style={{ color: tb.balanced ? 'oklch(0.45 0.13 150)' : 'oklch(0.55 0.16 25)' }}>
              {tb.balanced ? '✓ Balanced' : '✗ Not balanced'}
            </div>
            <div style={{ textAlign: 'right', fontFamily: 'monospace' }}>{money(tb.total_debit)}</div>
            <div style={{ textAlign: 'right', fontFamily: 'monospace' }}>{money(tb.total_credit)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
