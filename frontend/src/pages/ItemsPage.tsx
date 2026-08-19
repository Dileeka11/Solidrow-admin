import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { EditIcon, PlusIcon, TrashIcon } from '../components/icons';
import { confirmDelete, toastError, toastSuccess } from '../lib/alerts';
import { useIsMobile } from '../lib/useMediaQuery';
import type { Item, ItemCategory } from '../types';

const UOMS = ['Pcs', 'Kg', 'Box', 'Litre', 'Set', 'Unit', 'Pack', 'Roll', 'Pair'];
const inputStyle: React.CSSProperties = { padding: '10px 12px', borderRadius: 7, fontSize: 14, width: '100%' };
const fieldLabel: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 5, color: 'var(--label-2)' };

const empty = { item_code: '', name: '', category_id: '' as number | '', uom: '', unit_price: '', status: 'Active' as Item['status'] };

function money(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ItemsPage() {
  const isMobile = useIsMobile();
  const [rows, setRows] = useState<Item[]>([]);
  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [form, setForm] = useState({ ...empty });
  const [editing, setEditing] = useState<Item | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const [items, cats] = await Promise.all([
        api.get<Item[]>('/accounting/items'),
        api.get<ItemCategory[]>('/accounting/item-categories'),
      ]);
      setRows(items.data);
      setCategories(cats.data);
    } catch {
      setRows([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const catName = (id: number | null) => categories.find((c) => c.id === id)?.name ?? '—';

  function startEdit(it: Item) {
    setEditing(it);
    setForm({
      item_code: it.item_code ?? '',
      name: it.name,
      category_id: it.category_id ?? '',
      uom: it.uom ?? '',
      unit_price: String(it.unit_price ?? ''),
      status: it.status,
    });
  }

  function cancelEdit() {
    setEditing(null);
    setForm({ ...empty });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      toastError('Item name is required.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        item_code: form.item_code.trim() || null,
        name,
        category_id: form.category_id === '' ? null : Number(form.category_id),
        uom: form.uom || null,
        unit_price: parseFloat(form.unit_price) || 0,
        status: form.status,
      };
      if (editing) {
        await api.put(`/accounting/items/${editing.id}`, payload);
        toastSuccess('Item updated');
      } else {
        await api.post('/accounting/items', payload);
        toastSuccess('Item added');
      }
      cancelEdit();
      await load();
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data;
      const first = data?.errors ? Object.values(data.errors)[0]?.[0] : undefined;
      toastError(first ?? data?.message ?? 'Could not save the item.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(it: Item) {
    const ok = await confirmDelete(`Delete item "${it.name}"?`);
    if (!ok) return;
    try {
      await api.delete(`/accounting/items/${it.id}`);
      setRows((prev) => prev.filter((r) => r.id !== it.id));
      if (editing?.id === it.id) cancelEdit();
      toastSuccess('Item deleted');
    } catch {
      toastError('Could not delete the item.');
    }
  }

  return (
    <div className="fade-in-s" style={{ maxWidth: 960 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 2 }}>Item Master</div>
        <div style={{ fontSize: 14, color: 'var(--muted)' }}>{rows.length} items · pulled onto PR / PO lines</div>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{ background: 'var(--card)', borderRadius: 12, boxShadow: 'var(--card-shadow)', padding: 20, marginBottom: 20 }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 14 }}>
          <div>
            <label style={fieldLabel}>Item Code</label>
            <input className="sr-input" style={inputStyle} value={form.item_code} onChange={(e) => setForm((f) => ({ ...f, item_code: e.target.value }))} placeholder="Optional, e.g. STN-001" />
          </div>
          <div style={{ gridColumn: isMobile ? 'auto' : 'span 2' }}>
            <label style={fieldLabel}>{editing ? 'Edit item name' : 'Item name'}</label>
            <input className="sr-input" style={inputStyle} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. A4 Photocopy Paper" />
          </div>
          <div>
            <label style={fieldLabel}>Category</label>
            <select className="sr-input" style={inputStyle} value={form.category_id} onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value ? Number(e.target.value) : '' }))}>
              <option value="">—</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label style={fieldLabel}>UOM</label>
            <select className="sr-input" style={inputStyle} value={form.uom} onChange={(e) => setForm((f) => ({ ...f, uom: e.target.value }))}>
              <option value="">—</option>
              {UOMS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label style={fieldLabel}>Unit Price</label>
            <input className="sr-input" type="number" min="0" step="0.01" style={inputStyle} value={form.unit_price} onChange={(e) => setForm((f) => ({ ...f, unit_price: e.target.value }))} placeholder="0.00" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          {editing && (
            <select className="sr-input" style={{ ...inputStyle, width: 'auto' }} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Item['status'] }))}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          )}
          <button type="submit" className="sr-btn-primary" disabled={saving} style={{ padding: '11px 18px', borderRadius: 8, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            {!editing && <PlusIcon />}
            {saving ? 'Saving…' : editing ? 'Update' : 'Add'}
          </button>
          {editing && (
            <button type="button" onClick={cancelEdit} style={{ padding: '11px 16px', borderRadius: 8, fontSize: 14, background: 'var(--row-border, #f3f4f6)', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancel
            </button>
          )}
        </div>
      </form>

      <div style={{ background: 'var(--card)', borderRadius: 12, boxShadow: 'var(--card-shadow)', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 130px 70px 110px 70px 90px', columnGap: 12, padding: '10px 20px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', borderBottom: '1px solid var(--row-border)', textTransform: 'uppercase' }}>
          <div>Code</div><div>Name</div><div>Category</div><div>UOM</div><div style={{ textAlign: 'right' }}>Unit Price</div><div>Status</div><div />
        </div>
        {rows.length === 0 && <div style={{ padding: '18px 20px', fontSize: 13, color: 'var(--muted)' }}>No items yet — add one above.</div>}
        {rows.map((it) => (
          <div key={it.id} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 130px 70px 110px 70px 90px', columnGap: 12, padding: '13px 20px', fontSize: 14, alignItems: 'center', borderBottom: '1px solid var(--row-border)' }}>
            <div style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--muted)' }}>{it.item_code || '—'}</div>
            <div style={{ fontWeight: 500 }}>{it.name}</div>
            <div style={{ color: 'var(--muted)' }}>{catName(it.category_id)}</div>
            <div style={{ color: 'var(--muted)' }}>{it.uom || '—'}</div>
            <div style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 13 }}>{money(Number(it.unit_price) || 0)}</div>
            <div style={{ fontSize: 12, color: it.status === 'Active' ? 'oklch(0.55 0.14 150)' : 'var(--muted)' }}>{it.status}</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => startEdit(it)} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}><EditIcon /></button>
              <button onClick={() => handleDelete(it)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'oklch(0.55 0.16 25)', padding: 4 }}><TrashIcon /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
