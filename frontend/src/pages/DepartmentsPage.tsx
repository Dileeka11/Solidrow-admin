import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { EditIcon, PlusIcon, TrashIcon } from '../components/icons';
import { confirmDelete, toastError, toastSuccess } from '../lib/alerts';
import { useIsMobile } from '../lib/useMediaQuery';
import type { Department } from '../types';

const inputStyle: React.CSSProperties = { padding: '10px 12px', borderRadius: 7, fontSize: 14, width: '100%' };

export default function DepartmentsPage() {
  const isMobile = useIsMobile();
  const [rows, setRows] = useState<Department[]>([]);
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');
  const [editing, setEditing] = useState<Department | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const res = await api.get<Department[]>('/accounting/departments');
      setRows(res.data);
    } catch {
      setRows([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(d: Department) {
    setEditing(d);
    setName(d.name);
    setStatus(d.status);
  }

  function cancelEdit() {
    setEditing(null);
    setName('');
    setStatus('Active');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toastError('Department name is required.');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/accounting/departments/${editing.id}`, { name: trimmed, status });
        toastSuccess('Department updated');
      } else {
        await api.post('/accounting/departments', { name: trimmed, status });
        toastSuccess('Department added');
      }
      cancelEdit();
      await load();
    } catch (err: unknown) {
      toastError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Could not save the department.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(d: Department) {
    const ok = await confirmDelete(`Delete department "${d.name}"?`);
    if (!ok) return;
    try {
      await api.delete(`/accounting/departments/${d.id}`);
      setRows((prev) => prev.filter((r) => r.id !== d.id));
      if (editing?.id === d.id) cancelEdit();
      toastSuccess('Department deleted');
    } catch {
      toastError('Could not delete the department.');
    }
  }

  return (
    <div className="fade-in-s" style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 2 }}>Department Master</div>
        <div style={{ fontSize: 14, color: 'var(--muted)' }}>{rows.length} departments</div>
      </div>

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
            {editing ? 'Edit department name' : 'New department name'}
          </label>
          <input className="sr-input" style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Solidrow, RKB, Travel Tube" />
        </div>
        <div style={{ width: isMobile ? '100%' : 140 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 5, color: 'var(--label-2)' }}>Status</label>
          <select className="sr-input" style={inputStyle} value={status} onChange={(e) => setStatus(e.target.value as 'Active' | 'Inactive')}>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
        <button type="submit" className="sr-btn-primary" disabled={saving} style={{ padding: '11px 18px', borderRadius: 8, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          {!editing && <PlusIcon />}
          {saving ? 'Saving…' : editing ? 'Update' : 'Add'}
        </button>
        {editing && (
          <button type="button" onClick={cancelEdit} style={{ padding: '11px 16px', borderRadius: 8, fontSize: 14, background: 'var(--row-border, #f3f4f6)', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }}>
            Cancel
          </button>
        )}
      </form>

      <div style={{ background: 'var(--card)', borderRadius: 12, boxShadow: 'var(--card-shadow)', overflow: 'hidden' }}>
        {rows.length === 0 && <div style={{ padding: '18px 20px', fontSize: 13, color: 'var(--muted)' }}>No departments yet — add one above.</div>}
        {rows.map((d) => (
          <div key={d.id} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 90px', columnGap: 16, padding: '14px 20px', fontSize: 14, alignItems: 'center', borderBottom: '1px solid var(--row-border)' }}>
            <div style={{ fontWeight: 500 }}>{d.name}</div>
            <div>
              <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 6, color: d.status === 'Active' ? 'oklch(0.45 0.13 150)' : 'oklch(0.55 0.02 250)', background: d.status === 'Active' ? 'oklch(0.95 0.05 150)' : 'oklch(0.94 0.01 250)' }}>{d.status}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => startEdit(d)} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}><EditIcon /></button>
              <button onClick={() => handleDelete(d)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'oklch(0.55 0.16 25)', padding: 4 }}><TrashIcon /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
