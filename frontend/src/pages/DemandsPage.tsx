import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { EditIcon, PlusIcon, TrashIcon } from '../components/icons';
import { confirmDelete, toastError, toastSuccess } from '../lib/alerts';
import { useIsMobile } from '../lib/useMediaQuery';
import type { Demand } from '../types';

const inputStyle: React.CSSProperties = { padding: '10px 12px', borderRadius: 7, fontSize: 14, width: '100%' };

export default function DemandsPage() {
  const isMobile = useIsMobile();
  const [demands, setDemands] = useState<Demand[]>([]);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<Demand | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const res = await api.get<Demand[]>('/demands');
      setDemands(res.data);
    } catch {
      setDemands([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(d: Demand) {
    setEditing(d);
    setName(d.name);
  }

  function cancelEdit() {
    setEditing(null);
    setName('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toastError('Demand name is required.');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const res = await api.put<Demand>(`/demands/${editing.id}`, { name: trimmed });
        setDemands((prev) => prev.map((d) => (d.id === editing.id ? res.data : d)));
        toastSuccess('Demand updated');
      } else {
        const res = await api.post<Demand>('/demands', { name: trimmed });
        setDemands((prev) => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
        toastSuccess('Demand added');
      }
      cancelEdit();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Could not save the demand.';
      toastError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(d: Demand) {
    const ok = await confirmDelete(`Delete demand "${d.name}"?`);
    if (!ok) return;
    try {
      await api.delete(`/demands/${d.id}`);
      setDemands((prev) => prev.filter((row) => row.id !== d.id));
      if (editing?.id === d.id) cancelEdit();
      toastSuccess('Demand deleted');
    } catch {
      toastError('Could not delete the demand.');
    }
  }

  return (
    <div className="fade-in-s" style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 2 }}>Demands</div>
        <div style={{ fontSize: 14, color: 'var(--muted)' }}>
          {demands.length} demands · selected in Final Test details
        </div>
      </div>

      {/* Add / edit form */}
      <form
        onSubmit={handleSubmit}
        style={{
          background: 'var(--card)',
          borderRadius: 12,
          boxShadow: 'var(--card-shadow)',
          padding: 20,
          marginBottom: 20,
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'stretch' : 'flex-end',
          gap: 12,
        }}
      >
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 5, color: 'var(--label-2)' }}>
            {editing ? 'Edit demand name' : 'New demand name'}
          </label>
          <input
            className="sr-input"
            style={inputStyle}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Israel Welder — 20 pax"
          />
        </div>
        <button
          type="submit"
          className="sr-btn-primary"
          disabled={saving}
          style={{ padding: '11px 18px', borderRadius: 8, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}
        >
          {!editing && <PlusIcon />}
          {saving ? 'Saving…' : editing ? 'Update' : 'Add Demand'}
        </button>
        {editing && (
          <button
            type="button"
            onClick={cancelEdit}
            style={{ padding: '11px 16px', borderRadius: 8, fontSize: 14, background: 'var(--row-border, #f3f4f6)', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Cancel
          </button>
        )}
      </form>

      {/* List */}
      <div style={{ background: 'var(--card)', borderRadius: 12, boxShadow: 'var(--card-shadow)', overflow: 'hidden' }}>
        {demands.length === 0 && (
          <div style={{ padding: '18px 20px', fontSize: 13, color: 'var(--muted)' }}>
            No demands yet — add one above.
          </div>
        )}
        {demands.map((d) => (
          <div
            key={d.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 90px',
              columnGap: 16,
              padding: '14px 20px',
              fontSize: 14,
              alignItems: 'center',
              borderBottom: '1px solid var(--row-border)',
            }}
          >
            <div style={{ fontWeight: 500 }}>{d.name}</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => startEdit(d)}
                title="Edit"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}
              >
                <EditIcon />
              </button>
              <button
                onClick={() => handleDelete(d)}
                title="Delete"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'oklch(0.55 0.16 25)', padding: 4 }}
              >
                <TrashIcon />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
