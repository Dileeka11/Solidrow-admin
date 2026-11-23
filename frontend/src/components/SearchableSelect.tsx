import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

export interface SearchableOption {
  value: number | string;
  label: string;
}

interface Props {
  options: SearchableOption[];
  value: number | string | null;
  onChange: (value: number | string | null) => void;
  placeholder?: string;
  style?: CSSProperties;
}

/**
 * A select whose list can be filtered by typing — for long lists (e.g. demands)
 * where scrolling a native <select> is slow. Click to open, type to filter,
 * ↑/↓ + Enter to pick, Esc to close.
 */
export function SearchableSelect({ options, value, onChange, placeholder = '-- Select --', style }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => String(o.value) === String(value ?? '')) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  // Close when clicking anywhere outside.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Keep the highlighted row in view while arrowing through the list.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  function openList() {
    setQuery('');
    setActive(0);
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function pick(v: number | string | null) {
    onChange(v);
    setOpen(false);
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      {open ? (
        <input
          ref={inputRef}
          className="sr-input"
          style={style}
          value={query}
          placeholder={selected ? selected.label : 'Type to search…'}
          onChange={(e) => { setQuery(e.target.value); setActive(0); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, filtered.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
            else if (e.key === 'Enter') { e.preventDefault(); if (filtered[active]) pick(filtered[active].value); }
            else if (e.key === 'Escape') { setOpen(false); }
          }}
        />
      ) : (
        <button
          type="button"
          className="sr-input"
          onClick={openList}
          style={{ ...style, textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <span style={{ color: selected ? undefined : 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selected ? selected.label : placeholder}
          </span>
          <span style={{ color: 'var(--muted)', fontSize: 10, marginLeft: 8 }}>▼</span>
        </button>
      )}

      {open && (
        <div
          ref={listRef}
          style={{
            position: 'absolute', zIndex: 50, top: 'calc(100% + 4px)', left: 0, right: 0,
            maxHeight: 260, overflowY: 'auto', background: 'var(--card, #fff)',
            border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          }}
        >
          <div
            onMouseDown={(e) => { e.preventDefault(); pick(null); }}
            style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', color: 'var(--muted)' }}
          >
            {placeholder}
          </div>
          {filtered.map((o, i) => (
            <div
              key={o.value}
              data-idx={i}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => { e.preventDefault(); pick(o.value); }}
              style={{
                padding: '8px 12px', fontSize: 13, cursor: 'pointer',
                background: i === active ? 'var(--row-border, #f3f4f6)' : undefined,
                fontWeight: String(o.value) === String(value ?? '') ? 600 : undefined,
              }}
            >
              {o.label}
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: '8px 12px', fontSize: 13, color: 'var(--muted)' }}>No matches</div>
          )}
        </div>
      )}
    </div>
  );
}
