import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Cross-browser date picker with a consistent custom calendar popup.
 *
 * Replaces the native `<input type="date">` (which renders differently in every
 * browser) with a text field + React-rendered calendar so the look matches the
 * app's design tokens everywhere. Value is an ISO `yyyy-mm-dd` string (or '')
 * to stay drop-in compatible with the existing form state.
 */

type Props = {
  value: string;                       // ISO 'yyyy-mm-dd' or ''
  onChange: (iso: string) => void;
  disabled?: boolean;
  placeholder?: string;
  title?: string;
  style?: React.CSSProperties;
  id?: string;
};

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Parse 'yyyy-mm-dd' → {y,m,d} (m is 0-based) without timezone drift. */
function parseISO(iso: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  return { y: +match[1], m: +match[2] - 1, d: +match[3] };
}

function toISO(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Friendly display: '13 Jul 2026'. */
function formatDisplay(iso: string): string {
  const p = parseISO(iso);
  if (!p) return '';
  return `${String(p.d).padStart(2, '0')} ${MONTHS[p.m].slice(0, 3)} ${p.y}`;
}

export function DatePicker({ value, onChange, disabled, placeholder = 'Select date', title, style, id }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'days' | 'years'>('days');
  const rootRef = useRef<HTMLDivElement>(null);

  // Calendar view: default to selected value, else today.
  const selected = useMemo(() => parseISO(value), [value]);
  const today = useMemo(() => {
    const now = new Date();
    return { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };
  }, []);
  const [view, setView] = useState(() => selected ?? { y: today.y, m: today.m });

  // Sync view to the selected value whenever it (or the popup) opens.
  useEffect(() => {
    if (open) { setView(selected ?? { y: today.y, m: today.m }); setMode('days'); }
  }, [open, selected, today.y, today.m]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const firstWeekday = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const shiftMonth = (delta: number) => {
    setView((v) => {
      const m = v.m + delta;
      const y = v.y + Math.floor(m / 12);
      return { y, m: ((m % 12) + 12) % 12 };
    });
  };

  // Year picker: show a 12-year grid; nav arrows page by a decade.
  const decadeStart = Math.floor(view.y / 10) * 10 - 1; // e.g. 2019 for 2026
  const years = Array.from({ length: 12 }, (_, i) => decadeStart + i);
  const shiftYears = (delta: number) => setView((v) => ({ ...v, y: v.y + delta }));

  const pick = (d: number) => {
    onChange(toISO(view.y, view.m, d));
    setOpen(false);
  };

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        id={id}
        className="sr-input"
        title={title}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        style={{
          ...style,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          textAlign: 'left',
          cursor: disabled ? 'not-allowed' : 'pointer',
          background: '#fff',
        }}
      >
        <span style={{ color: value ? 'var(--text)' : 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value ? formatDisplay(value) : placeholder}
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--muted)', flexShrink: 0 }}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </button>

      {open && (
        <div
          className="fade-in-xs"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 50,
            width: 260,
            background: '#fff',
            border: '1px solid var(--border)',
            borderRadius: 10,
            boxShadow: '0 8px 24px oklch(0 0 0 / 0.12)',
            padding: 12,
          }}
        >
          {/* Header: month/year + nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <button
              type="button"
              onClick={() => (mode === 'days' ? shiftMonth(-1) : shiftYears(-10))}
              style={navBtn}
              aria-label={mode === 'days' ? 'Previous month' : 'Previous years'}
            >‹</button>
            <button
              type="button"
              onClick={() => setMode((m) => (m === 'days' ? 'years' : 'days'))}
              style={{ ...footBtn, fontSize: 14, color: 'var(--text)' }}
              title="Change year"
            >
              {mode === 'days' ? `${MONTHS[view.m]} ${view.y}` : `${decadeStart + 1} – ${decadeStart + 10}`}
            </button>
            <button
              type="button"
              onClick={() => (mode === 'days' ? shiftMonth(1) : shiftYears(10))}
              style={navBtn}
              aria-label={mode === 'days' ? 'Next month' : 'Next years'}
            >›</button>
          </div>

          {mode === 'years' ? (
            /* Year grid */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
              {years.map((y) => {
                const isCurrentDecade = y > decadeStart && y <= decadeStart + 10;
                const isSelectedYear = !!selected && selected.y === y;
                const isThisYear = today.y === y;
                return (
                  <button
                    key={y}
                    type="button"
                    onClick={() => { setView((v) => ({ ...v, y })); setMode('days'); }}
                    style={{
                      border: 'none',
                      borderRadius: 7,
                      padding: '10px 0',
                      fontSize: 13,
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                      background: isSelectedYear ? 'var(--accent)' : 'transparent',
                      color: isSelectedYear ? '#fff' : isCurrentDecade ? 'var(--text)' : 'var(--muted)',
                      fontWeight: isSelectedYear || isThisYear ? 600 : 400,
                      boxShadow: !isSelectedYear && isThisYear ? 'inset 0 0 0 1px var(--accent)' : 'none',
                    }}
                    onMouseEnter={(e) => { if (!isSelectedYear) e.currentTarget.style.background = 'var(--row-border)'; }}
                    onMouseLeave={(e) => { if (!isSelectedYear) e.currentTarget.style.background = 'transparent'; }}
                  >
                    {y}
                  </button>
                );
              })}
            </div>
          ) : (
          <>
          {/* Weekday header */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
            {WEEKDAYS.map((w) => (
              <div key={w} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--muted)', padding: '4px 0' }}>{w}</div>
            ))}
          </div>

          {/* Day grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {cells.map((d, i) => {
              if (d === null) return <div key={`e${i}`} />;
              const isSelected = !!selected && selected.y === view.y && selected.m === view.m && selected.d === d;
              const isToday = today.y === view.y && today.m === view.m && today.d === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => pick(d)}
                  style={{
                    border: 'none',
                    borderRadius: 7,
                    padding: '7px 0',
                    fontSize: 13,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    background: isSelected ? 'var(--accent)' : 'transparent',
                    color: isSelected ? '#fff' : 'var(--text)',
                    fontWeight: isSelected || isToday ? 600 : 400,
                    boxShadow: !isSelected && isToday ? 'inset 0 0 0 1px var(--accent)' : 'none',
                  }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--row-border)'; }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                >
                  {d}
                </button>
              );
            })}
          </div>
          </>
          )}

          {/* Footer: Today / Clear */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-soft)' }}>
            <button
              type="button"
              onClick={() => { onChange(toISO(today.y, today.m, today.d)); setOpen(false); }}
              style={footBtn}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); }}
              style={{ ...footBtn, color: 'var(--danger)' }}
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const navBtn: React.CSSProperties = {
  border: '1px solid var(--border)',
  background: '#fff',
  borderRadius: 7,
  width: 28,
  height: 28,
  cursor: 'pointer',
  fontSize: 18,
  lineHeight: 1,
  color: 'var(--text)',
  fontFamily: 'inherit',
};

const footBtn: React.CSSProperties = {
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--accent)',
  fontFamily: 'inherit',
  padding: '2px 4px',
};
