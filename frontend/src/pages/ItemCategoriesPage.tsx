import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { EditIcon, PlusIcon, TrashIcon } from '../components/icons';
import { confirmDelete, toastError, toastSuccess } from '../lib/alerts';
import { useIsMobile } from '../lib/useMediaQuery';
import type { ItemCategory } from '../types';

const inputStyle: React.CSSProperties = { padding: '10px 12px', borderRadius: 7, fontSize: 14, width: '100%' };

export default function ItemCategoriesPage() {
  const isMobile = useIsMobile();
  const [rows, setRows] = useState<ItemCategory[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [editing, setEditing] = useState<ItemCategory | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const res = await api.get<ItemCategory[]>('/accounting/item-categories');
      setRows(res.data);
    } catch {
      setRows([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(c: ItemCategory) {
    setEditing(c);
    setName(c.name);
    setDescription(c.description ?? '');
  }

  function cancelEdit() {
    setEditing(null);
    setName('');
    setDescription('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toastError('Category name is required.');
      return;
    }
    setSaving(true);
    try {
      const payload = { name: trimmed, description: description.trim() || null };
      if (editing) {
        await api.put(`/accounting/item-categories/${editing.id}`, payload);
        toastSuccess('Category updated');
      } else {
        await api.post('/accounting/item-categories', payload);
        toastSuccess('Category added');
      }
      cancelEdit();
      await load();
    } catch (err: unknown) {
      toastError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Could not save the category.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(c: ItemCategory) {
    const ok = await confirmDelete(`Delete category "${c.name}"?`);
    if (!ok) return;
    try {
      await api.delete(`/accounting/item-categories/${c.id}`);
      setRows((prev) => prev.filter((r) => r.id !== c.id));
      if (editing?.id === c.id) cancelEdit();
      toastSuccess('Category deleted');
    } catch {
      toastError('Could not delete the category.');
    }
  }

  return (
    <div className="fade-in-s" style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 2 }}>Category Master</div>
        <div style={{ fontSize: 14, color: 'var(--muted)' }}>{rows.length} item categories · used on PR / PO lines</div>
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
            {editing ? 'Edit category name' : 'New category name'}
          </label>
          <input className="sr-input" style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Stationery, IT Equipment, Raw Material" />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 5, color: 'var(--label-2)' }}>Description</label>
          <input className="sr-input" style={inputStyle} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
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
        {rows.length === 0 && <div style={{ padding: '18px 20px', fontSize: 13, color: 'var(--muted)' }}>No categories yet — add one above.</div>}
        {rows.map((c) => (
          <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 90px', columnGap: 16, padding: '14px 20px', fontSize: 14, alignItems: 'center', borderBottom: '1px solid var(--row-border)' }}>
            <div style={{ fontWeight: 500 }}>{c.name}</div>
            <div style={{ color: 'var(--muted)' }}>{c.description || '—'}</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => startEdit(c)} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}><EditIcon /></button>
              <button onClick={() => handleDelete(c)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'oklch(0.55 0.16 25)', padding: 4 }}><TrashIcon /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
