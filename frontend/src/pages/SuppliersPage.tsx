import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { EditIcon, PlusIcon, TrashIcon } from '../components/icons';
import { confirmDelete, toastError, toastSuccess } from '../lib/alerts';
import { useIsMobile } from '../lib/useMediaQuery';
import type { Supplier } from '../types';

type Form = {
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  status: 'Active' | 'Inactive';
};

const EMPTY: Form = { name: '', contact_person: '', phone: '', email: '', address: '', status: 'Active' };
const fieldLabel: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 5, color: 'var(--label-2)' };
const inputStyle: React.CSSProperties = { padding: '10px 12px', borderRadius: 7, fontSize: 14 };

export default function SuppliersPage() {
  const isMobile = useIsMobile();
  const [rows, setRows] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    try {
      const res = await api.get<Supplier[]>('/accounting/suppliers');
      setRows(res.data);
    } catch {
      setRows([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY);
    setError('');
    setOpen(true);
  }

  function openEdit(s: Supplier) {
    setEditing(s);
    setForm({
      name: s.name,
      contact_person: s.contact_person ?? '',
      phone: s.phone ?? '',
      email: s.email ?? '',
      address: s.address ?? '',
      status: s.status,
    });
    setError('');
    setOpen(true);
  }

  async function save() {
    if (!form.name.trim()) {
      setError('Supplier name is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await api.put(`/accounting/suppliers/${editing.id}`, form);
        toastSuccess('Supplier updated');
      } else {
        await api.post('/accounting/suppliers', form);
        toastSuccess('Supplier added');
      }
      setOpen(false);
      await load();
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data;
      setError(data?.errors ? Object.values(data.errors)[0]?.[0] ?? '' : data?.message ?? 'Could not save the supplier.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(s: Supplier) {
    const ok = await confirmDelete(`Delete supplier "${s.name}"?`);
    if (!ok) return;
    try {
      await api.delete(`/accounting/suppliers/${s.id}`);
      setRows((prev) => prev.filter((r) => r.id !== s.id));
      toastSuccess('Supplier deleted');
    } catch {
      toastError('Could not delete the supplier.');
    }
  }

  const q = search.trim().toLowerCase();
  const filtered = q
    ? rows.filter((s) => s.name.toLowerCase().includes(q) || (s.contact_person ?? '').toLowerCase().includes(q) || (s.phone ?? '').includes(q))
    : rows;

  return (
    <div className="fade-in-s">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 2 }}>Supplier Master</div>
          <div style={{ fontSize: 14, color: 'var(--muted)' }}>{rows.length} suppliers</div>
        </div>
        <button className="sr-btn-primary" onClick={openAdd} style={{ padding: '10px 16px', borderRadius: 8, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <PlusIcon />
          New Supplier
        </button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <input className="sr-input" style={{ ...inputStyle, maxWidth: 360, width: '100%' }} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, contact or phone…" />
      </div>

      <div style={{ background: 'var(--card)', borderRadius: 12, boxShadow: 'var(--card-shadow)', overflow: 'hidden' }}>
        {!isMobile && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 130px 1fr 90px 80px', columnGap: 16, padding: '12px 20px', fontSize: 12, fontWeight: 700, color: 'var(--muted)', borderBottom: '1px solid var(--row-border)', textTransform: 'uppercase' }}>
            <div>Name</div>
            <div>Contact</div>
            <div>Phone</div>
            <div>Email</div>
            <div>Status</div>
            <div style={{ textAlign: 'right' }}>Actions</div>
          </div>
        )}
        {filtered.length === 0 && <div style={{ padding: '18px 20px', fontSize: 13, color: 'var(--muted)' }}>No suppliers found.</div>}
        {filtered.map((s) => (
          <div key={s.id} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr auto' : '1fr 160px 130px 1fr 90px 80px', columnGap: 16, padding: '13px 20px', fontSize: 14, alignItems: 'center', borderBottom: '1px solid var(--row-border)' }}>
            <div style={{ fontWeight: 500 }}>{s.name}</div>
            {!isMobile && <div style={{ color: 'var(--muted)' }}>{s.contact_person || '—'}</div>}
            {!isMobile && <div style={{ color: 'var(--muted)' }}>{s.phone || '—'}</div>}
            {!isMobile && <div style={{ color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.email || '—'}</div>}
            {!isMobile && (
              <div>
                <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 6, color: s.status === 'Active' ? 'oklch(0.45 0.13 150)' : 'oklch(0.55 0.02 250)', background: s.status === 'Active' ? 'oklch(0.95 0.05 150)' : 'oklch(0.94 0.01 250)' }}>{s.status}</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => openEdit(s)} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}><EditIcon /></button>
              <button onClick={() => handleDelete(s)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'oklch(0.55 0.16 25)', padding: 4 }}><TrashIcon /></button>
            </div>
          </div>
        ))}
      </div>

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'oklch(0 0 0 / 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={() => setOpen(false)}>
          <div className="fade-in-xs" style={{ background: 'white', borderRadius: 14, width: 520, maxWidth: '90vw', padding: 28 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>{editing ? 'Edit Supplier' : 'Add Supplier'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={fieldLabel}>Name *</label>
                <input className="sr-input" style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label style={fieldLabel}>Contact Person</label>
                <input className="sr-input" style={inputStyle} value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} />
              </div>
              <div>
                <label style={fieldLabel}>Phone</label>
                <input className="sr-input" style={inputStyle} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <label style={fieldLabel}>Email</label>
                <input className="sr-input" style={inputStyle} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={fieldLabel}>Address</label>
                <textarea className="sr-input" style={{ ...inputStyle, width: '100%' }} rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div>
                <label style={fieldLabel}>Status</label>
                <select className="sr-input" style={inputStyle} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'Active' | 'Inactive' })}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>
            {error && <div style={{ color: 'oklch(0.55 0.16 25)', fontSize: 13, marginBottom: 14 }}>{error}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setOpen(false)} style={{ padding: '10px 16px', borderRadius: 8, fontSize: 14, background: 'var(--row-border, #f3f4f6)', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button className="sr-btn-primary" onClick={save} disabled={saving} style={{ padding: '10px 18px', borderRadius: 8, fontSize: 14 }}>{saving ? 'Saving…' : editing ? 'Update' : 'Add'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
