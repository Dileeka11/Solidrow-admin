import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { EditIcon, PlusIcon, TrashIcon } from '../components/icons';
import { confirmDelete, toastError, toastSuccess } from '../lib/alerts';
import type { JobCategory } from '../types';

const inputStyle: React.CSSProperties = { padding: '10px 12px', borderRadius: 7, fontSize: 14, width: '100%' };

export default function JobCategoriesPage() {
  const [categories, setCategories] = useState<JobCategory[]>([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [editing, setEditing] = useState<JobCategory | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const res = await api.get<JobCategory[]>('/job-categories');
      setCategories(res.data);
    } catch {
      setCategories([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(c: JobCategory) {
    setEditing(c);
    setName(c.name);
    setCode(c.code ?? '');
  }

  function cancelEdit() {
    setEditing(null);
    setName('');
    setCode('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toastError('Category name is required.');
      return;
    }
    const trimmedCode = code.trim().toUpperCase();
    setSaving(true);
    try {
      if (editing) {
        const res = await api.put<JobCategory>(`/job-categories/${editing.id}`, { name: trimmed, code: trimmedCode });
        setCategories((prev) => prev.map((c) => (c.id === editing.id ? res.data : c)));
        toastSuccess('Job category updated');
      } else {
        const res = await api.post<JobCategory>('/job-categories', { name: trimmed, code: trimmedCode });
        setCategories((prev) => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
        toastSuccess('Job category added');
      }
      cancelEdit();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Could not save the category.';
      toastError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(c: JobCategory) {
    const ok = await confirmDelete(`Delete job category "${c.name}"?`);
    if (!ok) return;
    try {
      await api.delete(`/job-categories/${c.id}`);
      setCategories((prev) => prev.filter((row) => row.id !== c.id));
      if (editing?.id === c.id) cancelEdit();
      toastSuccess('Job category deleted');
    } catch {
      toastError('Could not delete the category.');
    }
  }

  return (
    <div className="fade-in-s" style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 2 }}>Job Categories</div>
        <div style={{ fontSize: 14, color: 'var(--muted)' }}>
          {categories.length} categories · used in Section 5 (Employee Details)
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
          alignItems: 'flex-end',
          gap: 12,
        }}
      >
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 5, color: 'var(--label-2)' }}>
            {editing ? 'Edit category name' : 'New category name'}
          </label>
          <input
            className="sr-input"
            style={inputStyle}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Welder, Caregiver, Driver"
          />
        </div>
        <div style={{ width: 130 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 5, color: 'var(--label-2)' }}>
            Trade code
          </label>
          <input
            className="sr-input"
            style={inputStyle}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={8}
            placeholder="e.g. TI, SC"
          />
        </div>
        <button
          type="submit"
          className="sr-btn-primary"
          disabled={saving}
          style={{ padding: '11px 18px', borderRadius: 8, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}
        >
          {!editing && <PlusIcon />}
          {saving ? 'Saving…' : editing ? 'Update' : 'Add Category'}
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
        {categories.length === 0 && (
          <div style={{ padding: '18px 20px', fontSize: 13, color: 'var(--muted)' }}>
            No job categories yet — add one above.
          </div>
        )}
        {categories.map((c) => (
          <div
            key={c.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 90px 90px',
              columnGap: 16,
              padding: '14px 20px',
              fontSize: 14,
              alignItems: 'center',
              borderBottom: '1px solid var(--row-border)',
            }}
          >
            <div style={{ fontWeight: 500 }}>{c.name}</div>
            <div>
              {c.code
                ? <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent,#6366f1)', background: 'oklch(0.95 0.03 260)', padding: '2px 8px', borderRadius: 6 }}>{c.code}</span>
                : <span style={{ fontSize: 12, color: 'var(--muted)' }}>—</span>}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => startEdit(c)}
                title="Edit"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}
              >
                <EditIcon />
              </button>
              <button
                onClick={() => handleDelete(c)}
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
