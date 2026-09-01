import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { EditIcon, PlusIcon, TrashIcon } from '../components/icons';
import { confirmDelete, toastError, toastSuccess } from '../lib/alerts';
import { useIsMobile } from '../lib/useMediaQuery';
import type { Supplier } from '../types';

type PaymentTerms = 'immediate' | '30_days' | '60_days' | '90_days';

type Form = {
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  payment_terms: PaymentTerms | '';
  bank_name: string;
  bank_branch: string;
  bank_account_no: string;
  notes: string;
  status: 'Active' | 'Inactive';
};

const EMPTY: Form = {
  name: '', contact_person: '', phone: '', email: '', address: '',
  payment_terms: '', bank_name: '', bank_branch: '', bank_account_no: '',
  notes: '', status: 'Active',
};

const PAYMENT_TERMS_LABELS: Record<PaymentTerms, string> = {
  immediate: 'Immediate',
  '30_days': '30 Days',
  '60_days': '60 Days',
  '90_days': '90 Days',
};

const inp: React.CSSProperties = { padding: '10px 12px', borderRadius: 7, fontSize: 14 };
const lbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 5, color: 'var(--label-2)' };

// ── View modal for full supplier details ────────────────────────────────────
function SupplierViewModal({ supplier, onClose, onEdit }: {
  supplier: Supplier;
  onClose: () => void;
  onEdit: () => void;
}) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'oklch(0 0 0 / 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
      onClick={onClose}
    >
      <div
        className="fade-in-xs"
        style={{ background: 'var(--card, white)', borderRadius: 16, width: 560, maxWidth: '94vw', padding: 28, boxShadow: '0 8px 40px oklch(0 0 0 / 0.2)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent,#6366f1)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              {supplier.supplier_code ?? '—'}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{supplier.name}</div>
          </div>
          <span style={{
            fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20,
            background: supplier.status === 'Active' ? 'oklch(0.93 0.07 150)' : 'oklch(0.94 0.01 250)',
            color: supplier.status === 'Active' ? 'oklch(0.38 0.13 150)' : 'oklch(0.55 0.02 250)',
          }}>
            {supplier.status}
          </span>
        </div>

        {/* Grid of details */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
          {[
            ['Contact Person', supplier.contact_person],
            ['Phone', supplier.phone],
            ['Email', supplier.email],
            ['Payment Terms', supplier.payment_terms ? PAYMENT_TERMS_LABELS[supplier.payment_terms] : null],
          ].map(([label, value]) => (
            <div key={label as string}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 14 }}>{value || '—'}</div>
            </div>
          ))}
          <div style={{ gridColumn: '1/-1' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>Address</div>
            <div style={{ fontSize: 14 }}>{supplier.address || '—'}</div>
          </div>
        </div>

        {/* Bank Details */}
        {(supplier.bank_name || supplier.bank_account_no) && (
          <div style={{ background: 'var(--surface-2, #f8f9fb)', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>Bank Details</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {[['Bank', supplier.bank_name], ['Branch', supplier.bank_branch], ['Account No', supplier.bank_account_no]].map(([l, v]) => (
                <div key={l as string}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>{l}</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{v || '—'}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {supplier.notes && (
          <div style={{ fontSize: 13, color: 'var(--muted)', borderTop: '1px solid var(--row-border)', paddingTop: 12, marginBottom: 16 }}>
            {supplier.notes}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '9px 16px', borderRadius: 8, fontSize: 14, background: 'var(--row-border)', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }}>Close</button>
          <button className="sr-btn-primary" onClick={onEdit} style={{ padding: '9px 18px', borderRadius: 8, fontSize: 14 }}>Edit</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SuppliersPage() {
  const isMobile = useIsMobile();
  const [rows, setRows] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [viewSupplier, setViewSupplier] = useState<Supplier | null>(null);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [activeTab, setActiveTab] = useState<'basic' | 'bank'>('basic');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    try {
      const res = await api.get<Supplier[]>('/accounting/suppliers');
      setRows(res.data);
    } catch { setRows([]); }
  }

  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY);
    setActiveTab('basic');
    setError('');
    setFormOpen(true);
  }

  function openEdit(s: Supplier) {
    setEditing(s);
    setForm({
      name: s.name, contact_person: s.contact_person ?? '', phone: s.phone ?? '',
      email: s.email ?? '', address: s.address ?? '',
      payment_terms: (s.payment_terms as PaymentTerms) ?? '',
      bank_name: s.bank_name ?? '', bank_branch: s.bank_branch ?? '',
      bank_account_no: s.bank_account_no ?? '', notes: s.notes ?? '',
      status: s.status,
    });
    setActiveTab('basic');
    setError('');
    setViewSupplier(null);
    setFormOpen(true);
  }

  async function save() {
    if (!form.name.trim()) { setError('Supplier name is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, payment_terms: form.payment_terms || null };
      if (editing) {
        await api.put(`/accounting/suppliers/${editing.id}`, payload);
        toastSuccess('Supplier updated.');
      } else {
        await api.post('/accounting/suppliers', payload);
        toastSuccess('Supplier added.');
      }
      setFormOpen(false);
      await load();
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data;
      setError(data?.errors ? Object.values(data.errors)[0]?.[0] ?? '' : data?.message ?? 'Could not save.');
    } finally { setSaving(false); }
  }

  async function handleDelete(s: Supplier) {
    const ok = await confirmDelete(`Delete supplier "${s.name}"?`);
    if (!ok) return;
    try {
      await api.delete(`/accounting/suppliers/${s.id}`);
      setRows((p) => p.filter((r) => r.id !== s.id));
      toastSuccess('Deleted.');
    } catch { toastError('Could not delete.'); }
  }

  const q = search.trim().toLowerCase();
  const filtered = rows.filter((s) => {
    if (statusFilter && s.status !== statusFilter) return false;
    if (q && !(s.name.toLowerCase().includes(q) || (s.contact_person ?? '').toLowerCase().includes(q) || (s.phone ?? '').includes(q) || (s.supplier_code ?? '').toLowerCase().includes(q))) return false;
    return true;
  });

  const gridCols = isMobile ? '1fr auto' : '110px 1fr 150px 120px 80px 80px 80px';

  return (
    <div className="fade-in-s">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 2 }}>Supplier Master</div>
          <div style={{ fontSize: 14, color: 'var(--muted)' }}>{rows.length} suppliers registered</div>
        </div>
        <button id="btn-new-supplier" className="sr-btn-primary" onClick={openAdd} style={{ padding: '10px 16px', borderRadius: 8, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <PlusIcon /> New Supplier
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 160px', gap: 10, marginBottom: 16 }}>
        <input className="sr-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, code, contact or phone…" style={inp} />
        <select className="sr-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={inp}>
          <option value="">All status</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--card)', borderRadius: 12, boxShadow: 'var(--card-shadow)', overflow: 'hidden' }}>
        {!isMobile && (
          <div style={{ display: 'grid', gridTemplateColumns: gridCols, columnGap: 14, padding: '12px 20px', fontSize: 12, fontWeight: 700, color: 'var(--muted)', borderBottom: '1px solid var(--row-border)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            <div>Code</div><div>Name</div><div>Contact</div><div>Phone</div><div>Terms</div><div>Status</div><div style={{ textAlign: 'right' }}>Actions</div>
          </div>
        )}
        {filtered.length === 0 && <div style={{ padding: '18px 20px', fontSize: 13, color: 'var(--muted)' }}>No suppliers found.</div>}
        {filtered.map((s) => (
          <div key={s.id} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr auto' : gridCols, columnGap: 14, padding: '13px 20px', fontSize: 14, alignItems: 'center', borderBottom: '1px solid var(--row-border)', cursor: 'pointer' }}
            onClick={() => setViewSupplier(s)}
          >
            <div style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--accent,#6366f1)', fontWeight: 700 }}>{s.supplier_code ?? '—'}</div>
            <div style={{ fontWeight: 600 }}>{s.name}</div>
            {!isMobile && <div style={{ color: 'var(--muted)', fontSize: 13 }}>{s.contact_person || '—'}</div>}
            {!isMobile && <div style={{ color: 'var(--muted)' }}>{s.phone || '—'}</div>}
            {!isMobile && (
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {s.payment_terms ? PAYMENT_TERMS_LABELS[s.payment_terms] : '—'}
              </div>
            )}
            {!isMobile && (
              <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: s.status === 'Active' ? 'oklch(0.95 0.05 150)' : 'oklch(0.94 0.01 250)', color: s.status === 'Active' ? 'oklch(0.45 0.13 150)' : 'oklch(0.55 0.02 250)' }}>
                {s.status}
              </span>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
              <button id={`btn-edit-sup-${s.id}`} onClick={() => openEdit(s)} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}><EditIcon /></button>
              <button id={`btn-del-sup-${s.id}`} onClick={() => handleDelete(s)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'oklch(0.55 0.16 25)', padding: 4 }}><TrashIcon /></button>
            </div>
          </div>
        ))}
      </div>

      {/* View Modal */}
      {viewSupplier && (
        <SupplierViewModal
          supplier={viewSupplier}
          onClose={() => setViewSupplier(null)}
          onEdit={() => openEdit(viewSupplier)}
        />
      )}

      {/* Form Modal */}
      {formOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'oklch(0 0 0 / 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={() => setFormOpen(false)}>
          <div className="fade-in-xs" style={{ background: 'var(--card, white)', borderRadius: 16, width: 580, maxWidth: '94vw', padding: 28, boxShadow: '0 8px 36px oklch(0 0 0 / 0.18)', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>{editing ? 'Edit Supplier' : 'New Supplier'}</div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid var(--row-border)', paddingBottom: 0 }}>
              {(['basic', 'bank'] as const).map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', borderBottom: activeTab === tab ? '2px solid var(--accent,#6366f1)' : '2px solid transparent', marginBottom: -2, color: activeTab === tab ? 'var(--accent,#6366f1)' : 'var(--muted)' }}>
                  {tab === 'basic' ? 'Basic Info' : 'Bank Details'}
                </button>
              ))}
            </div>

            {activeTab === 'basic' && (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
                <div style={{ gridColumn: '1/-1' }}>
                  <label htmlFor="sup-name" style={lbl}>Supplier Name *</label>
                  <input id="sup-name" className="sr-input" style={{ ...inp, width: '100%' }} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="sup-contact" style={lbl}>Contact Person</label>
                  <input id="sup-contact" className="sr-input" style={{ ...inp, width: '100%' }} value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="sup-phone" style={lbl}>Phone</label>
                  <input id="sup-phone" className="sr-input" style={{ ...inp, width: '100%' }} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="sup-email" style={lbl}>Email</label>
                  <input id="sup-email" className="sr-input" type="email" style={{ ...inp, width: '100%' }} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="sup-terms" style={lbl}>Payment Terms</label>
                  <select id="sup-terms" className="sr-input" style={{ ...inp, width: '100%' }} value={form.payment_terms} onChange={(e) => setForm({ ...form, payment_terms: e.target.value as PaymentTerms | '' })}>
                    <option value="">— Select —</option>
                    <option value="immediate">Immediate</option>
                    <option value="30_days">30 Days</option>
                    <option value="60_days">60 Days</option>
                    <option value="90_days">90 Days</option>
                  </select>
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label htmlFor="sup-address" style={lbl}>Address</label>
                  <textarea id="sup-address" className="sr-input" style={{ ...inp, width: '100%' }} rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="sup-status" style={lbl}>Status</label>
                  <select id="sup-status" className="sr-input" style={{ ...inp, width: '100%' }} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'Active' | 'Inactive' })}>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label htmlFor="sup-notes" style={lbl}>Notes</label>
                  <textarea id="sup-notes" className="sr-input" style={{ ...inp, width: '100%' }} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
              </div>
            )}

            {activeTab === 'bank' && (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
                <div style={{ gridColumn: '1/-1' }}>
                  <label htmlFor="sup-bank-name" style={lbl}>Bank Name</label>
                  <input id="sup-bank-name" className="sr-input" style={{ ...inp, width: '100%' }} value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} placeholder="e.g. HNB" />
                </div>
                <div>
                  <label htmlFor="sup-bank-branch" style={lbl}>Branch</label>
                  <input id="sup-bank-branch" className="sr-input" style={{ ...inp, width: '100%' }} value={form.bank_branch} onChange={(e) => setForm({ ...form, bank_branch: e.target.value })} placeholder="e.g. Colombo 03" />
                </div>
                <div>
                  <label htmlFor="sup-bank-accno" style={lbl}>Account Number</label>
                  <input id="sup-bank-accno" className="sr-input" style={{ ...inp, width: '100%' }} value={form.bank_account_no} onChange={(e) => setForm({ ...form, bank_account_no: e.target.value })} />
                </div>
              </div>
            )}

            {error && <div style={{ color: 'oklch(0.55 0.16 25)', fontSize: 13, marginTop: 14 }}>{error}</div>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
              <button onClick={() => setFormOpen(false)} style={{ padding: '10px 16px', borderRadius: 8, fontSize: 14, background: 'var(--row-border)', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button id="btn-save-supplier" className="sr-btn-primary" onClick={save} disabled={saving} style={{ padding: '10px 22px', borderRadius: 8, fontSize: 14 }}>
                {saving ? 'Saving…' : editing ? 'Update' : 'Add Supplier'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
