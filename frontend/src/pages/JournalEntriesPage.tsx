import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { PlusIcon } from '../components/icons';
import { useIsMobile } from '../lib/useMediaQuery';
import type { JournalEntry } from '../types';

function money(n: string | number): string {
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function docNo(id: number): string {
  return 'JE-' + String(id).padStart(6, '0');
}

export default function JournalEntriesPage() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    api
      .get<JournalEntry[]>('/accounting/journal-entries')
      .then((res) => setEntries(res.data))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, []);

  const entryTotal = (e: JournalEntry) => e.lines.reduce((sum, l) => sum + Number(l.debit), 0);

  return (
    <div className="fade-in-s" style={{ maxWidth: 920 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 2 }}>Journal Entries</div>
          <div style={{ fontSize: 14, color: 'var(--muted)' }}>{entries.length} posted entries</div>
        </div>
        <button
          className="sr-btn-primary"
          onClick={() => navigate('/accounting/journal/new')}
          style={{ padding: '10px 16px', borderRadius: 8, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <PlusIcon />
          New Entry
        </button>
      </div>

      <div style={{ background: 'var(--card)', borderRadius: 12, boxShadow: 'var(--card-shadow)', overflow: 'hidden' }}>
        {loading && <div style={{ padding: '18px 20px', fontSize: 13, color: 'var(--muted)' }}>Loading…</div>}
        {!loading && entries.length === 0 && (
          <div style={{ padding: '18px 20px', fontSize: 13, color: 'var(--muted)' }}>
            No journal entries yet — post your first one.
          </div>
        )}

        {!loading &&
          entries.map((e) => {
            const open = expanded === e.id;
            return (
              <div key={e.id} style={{ borderBottom: '1px solid var(--row-border)' }}>
                <button
                  onClick={() => setExpanded(open ? null : e.id)}
                  style={{
                    width: '100%',
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr 110px' : '130px 110px 1fr 130px',
                    columnGap: 12,
                    padding: '13px 20px',
                    fontSize: 14,
                    alignItems: 'center',
                    background: open ? 'oklch(0.98 0.005 250)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{docNo(e.id)}</span>
                  {!isMobile && <span>{e.entry_date}</span>}
                  <span style={{ color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.reference ? `${e.reference} · ` : ''}
                    {e.memo ?? '—'}
                  </span>
                  <span style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{money(entryTotal(e))}</span>
                </button>

                {open && (
                  <div style={{ padding: '4px 20px 16px' }}>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 120px 120px',
                        columnGap: 12,
                        padding: '8px 0',
                        fontSize: 12,
                        fontWeight: 700,
                        color: 'var(--muted)',
                        textTransform: 'uppercase',
                        borderBottom: '1px solid var(--row-border)',
                      }}
                    >
                      <div>Account</div>
                      <div style={{ textAlign: 'right' }}>Debit</div>
                      <div style={{ textAlign: 'right' }}>Credit</div>
                    </div>
                    {e.lines.map((l) => (
                      <div
                        key={l.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 120px 120px',
                          columnGap: 12,
                          padding: '8px 0',
                          fontSize: 13,
                          borderBottom: '1px solid var(--row-border)',
                        }}
                      >
                        <div>
                          <span style={{ fontFamily: 'monospace', color: 'var(--muted)', marginRight: 8 }}>{l.account_code}</span>
                          {l.account_name}
                          {l.memo && <span style={{ color: 'var(--muted)' }}> · {l.memo}</span>}
                        </div>
                        <div style={{ textAlign: 'right', fontFamily: 'monospace' }}>{Number(l.debit) ? money(l.debit) : '—'}</div>
                        <div style={{ textAlign: 'right', fontFamily: 'monospace' }}>{Number(l.credit) ? money(l.credit) : '—'}</div>
                      </div>
                    ))}
                    {(e.currency || e.posting_date) && (
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
                        Posting date: {e.posting_date ?? e.entry_date} · Currency: {e.currency}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
