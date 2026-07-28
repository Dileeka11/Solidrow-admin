import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { EditIcon, PlusIcon, TrashIcon } from '../components/icons';
import { confirmDelete, toastError, toastSuccess } from '../lib/alerts';
import { useIsMobile } from '../lib/useMediaQuery';
import type { Agent } from '../types';

const inputStyle: React.CSSProperties = { padding: '10px 12px', borderRadius: 7, fontSize: 14, width: '100%' };

export default function AgentsPage() {
  const isMobile = useIsMobile();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [editing, setEditing] = useState<Agent | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const res = await api.get<Agent[]>('/agents');
      setAgents(res.data);
    } catch {
      setAgents([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(a: Agent) {
    setEditing(a);
    setName(a.name);
    setPhone(a.phone ?? '');
  }

  function cancelEdit() {
    setEditing(null);
    setName('');
    setPhone('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toastError('Agent name is required.');
      return;
    }
    const trimmedPhone = phone.trim();
    setSaving(true);
    try {
      if (editing) {
        const res = await api.put<Agent>(`/agents/${editing.id}`, { name: trimmed, phone: trimmedPhone });
        setAgents((prev) => prev.map((a) => (a.id === editing.id ? res.data : a)));
        toastSuccess('Agent updated');
      } else {
        const res = await api.post<Agent>('/agents', { name: trimmed, phone: trimmedPhone });
        setAgents((prev) => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
        toastSuccess('Agent added');
      }
      cancelEdit();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Could not save the agent.';
      toastError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(a: Agent) {
    const ok = await confirmDelete(`Delete agent "${a.name}"?`);
    if (!ok) return;
    try {
      await api.delete(`/agents/${a.id}`);
      setAgents((prev) => prev.filter((row) => row.id !== a.id));
      if (editing?.id === a.id) cancelEdit();
      toastSuccess('Agent deleted');
    } catch {
      toastError('Could not delete the agent.');
    }
  }

  return (
    <div className="fade-in-s" style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 2 }}>Agents</div>
        <div style={{ fontSize: 14, color: 'var(--muted)' }}>
          {agents.length} agents · selectable on the candidate form
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
            {editing ? 'Edit agent name' : 'New agent name'}
          </label>
          <input
            className="sr-input"
            style={inputStyle}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Kamal Perera"
          />
        </div>
        <div style={{ width: isMobile ? '100%' : 180 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 5, color: 'var(--label-2)' }}>
            Phone (optional)
          </label>
          <input
            className="sr-input"
            style={inputStyle}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={20}
            placeholder="e.g. 0771234567"
          />
        </div>
        <button
          type="submit"
          className="sr-btn-primary"
          disabled={saving}
          style={{ padding: '11px 18px', borderRadius: 8, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}
        >
          {!editing && <PlusIcon />}
          {saving ? 'Saving…' : editing ? 'Update' : 'Add Agent'}
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
        {agents.length === 0 && (
          <div style={{ padding: '18px 20px', fontSize: 13, color: 'var(--muted)' }}>
            No agents yet — add one above.
          </div>
        )}
        {agents.map((a) => (
          <div
            key={a.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 140px 90px',
              columnGap: 16,
              padding: '14px 20px',
              fontSize: 14,
              alignItems: 'center',
              borderBottom: '1px solid var(--row-border)',
            }}
          >
            <div style={{ fontWeight: 500 }}>{a.name}</div>
            <div style={{ color: a.phone ? 'inherit' : 'var(--muted)', fontSize: a.phone ? 14 : 12 }}>
              {a.phone || '—'}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => startEdit(a)}
                title="Edit"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}
              >
                <EditIcon />
              </button>
              <button
                onClick={() => handleDelete(a)}
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
