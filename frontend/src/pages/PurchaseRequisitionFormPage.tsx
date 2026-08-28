import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { PlusIcon, TrashIcon } from '../components/icons';
import { toastError, toastSuccess } from '../lib/alerts';
import { useIsMobile } from '../lib/useMediaQuery';
import type { AccountRow, Department, Item, ItemCategory, PrDraftLine, PrPriority, PurchaseRequisition, Supplier } from '../types';

const UOMS = ['Pcs', 'Kg', 'Box', 'Litre', 'Set', 'Unit', 'Pack', 'Roll', 'Pair'];
const today = () => new Date().toISOString().slice(0, 10);
const inputStyle: React.CSSProperties = { padding: '9px 12px', borderRadius: 7, fontSize: 14, width: '100%' };
const fieldLabel: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 5, color: 'var(--label-2)' };

const emptyLine = (): PrDraftLine => ({ description: '', category_id: '', quantity: '', uom: '', est_unit_price: '', preferred_supplier_id: '', remarks: '' });

function money(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PurchaseRequisitionFormPage() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { id } = useParams();
  const editingId = id ? Number(id) : null;

  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [itemChecked, setItemChecked] = useState<number[]>([]);
  const [itemSearch, setItemSearch] = useState('');

  const [prNumber, setPrNumber] = useState('');
  const [status, setStatus] = useState<PurchaseRequisition['status']>('Draft');
  const [requestedBy, setRequestedBy] = useState('');
  const [prDate, setPrDate] = useState(today());
  const [departmentId, setDepartmentId] = useState<number | ''>('');
  const [priority, setPriority] = useState<PrPriority>('Normal');
  const [requiredDate, setRequiredDate] = useState('');
  const [purpose, setPurpose] = useState('');
  const [budgetAccountId, setBudgetAccountId] = useState<number | ''>('');
  const [lines, setLines] = useState<PrDraftLine[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(editingId));

  const readOnly = status !== 'Draft';

  useEffect(() => {
    Promise.all([
      api.get<Department[]>('/accounting/departments'),
      api.get<ItemCategory[]>('/accounting/item-categories'),
      api.get<Supplier[]>('/accounting/suppliers'),
      api.get<AccountRow[]>('/accounting/accounts'),
      api.get<Item[]>('/accounting/items'),
    ])
      .then(([d, c, s, a, its]) => {
        setDepartments(d.data);
        setCategories(c.data);
        setSuppliers(s.data);
        setAccounts(a.data);
        setItems(its.data.filter((it) => it.status === 'Active'));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!editingId) return;
    api
      .get<PurchaseRequisition>(`/accounting/purchase-requisitions/${editingId}`)
      .then((res) => {
        const pr = res.data;
        setPrNumber(pr.pr_number);
        setStatus(pr.status);
        setRequestedBy(pr.requested_by ?? '');
        setPrDate(pr.pr_date);
        setDepartmentId(pr.department_id ?? '');
        setPriority(pr.priority);
        setRequiredDate(pr.required_date ?? '');
        setPurpose(pr.purpose ?? '');
        setBudgetAccountId(pr.budget_account_id ?? '');
        setLines(
          pr.items.length
            ? pr.items.map((it) => ({
                description: it.description,
                category_id: it.category_id ?? '',
                quantity: String(it.quantity),
                uom: it.uom ?? '',
                est_unit_price: String(it.est_unit_price),
                preferred_supplier_id: it.preferred_supplier_id ?? '',
                remarks: it.remarks ?? '',
              }))
            : [emptyLine()],
        );
      })
      .catch(() => toastError('Could not load the requisition.'))
      .finally(() => setLoading(false));
  }, [editingId]);

  const grandTotal = useMemo(
    () => lines.reduce((sum, l) => sum + (parseFloat(l.quantity) || 0) * (parseFloat(l.est_unit_price) || 0), 0),
    [lines],
  );

  function updateLine(i: number, patch: Partial<PrDraftLine>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (i: number) => setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));

  /** Append the ticked master items to the line grid as new rows. */
  function applyItemSelection() {
    const chosen = items.filter((it) => itemChecked.includes(it.id));
    const pulled: PrDraftLine[] = chosen.map((it) => ({
      description: it.name,
      category_id: it.category_id ?? '',
      quantity: '1',
      uom: it.uom ?? '',
      est_unit_price: String(Number(it.unit_price) || 0),
      preferred_supplier_id: '',
      remarks: '',
    }));
    setLines((prev) => {
      const existing = prev.filter((l) => l.description.trim() || l.quantity);
      return [...existing, ...pulled];
    });
    setItemModalOpen(false);
  }

  async function save() {
    const cleaned = lines
      .filter((l) => l.description.trim() && parseFloat(l.quantity) > 0)
      .map((l) => ({
        description: l.description.trim(),
        category_id: l.category_id === '' ? null : Number(l.category_id),
        quantity: parseFloat(l.quantity),
        uom: l.uom || null,
        est_unit_price: parseFloat(l.est_unit_price) || 0,
        preferred_supplier_id: l.preferred_supplier_id === '' ? null : Number(l.preferred_supplier_id),
        remarks: l.remarks.trim() || null,
      }));

    if (cleaned.length === 0) {
      toastError('Add at least one line item (description + quantity).');
      return;
    }

    const payload = {
      pr_date: prDate,
      department_id: departmentId === '' ? null : Number(departmentId),
      priority,
      required_date: requiredDate || null,
      purpose: purpose.trim() || null,
      budget_account_id: budgetAccountId === '' ? null : Number(budgetAccountId),
      items: cleaned,
    };

    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/accounting/purchase-requisitions/${editingId}`, payload);
        toastSuccess('Requisition updated');
      } else {
        await api.post('/accounting/purchase-requisitions', payload);
        toastSuccess('Requisition created');
      }
      navigate('/accounting/pr');
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data;
      const first = data?.errors ? Object.values(data.errors)[0]?.[0] : undefined;
      toastError(first ?? data?.message ?? 'Could not save the requisition.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading…</div>;

  return (
    <div className="fade-in-s" style={{ maxWidth: 1040 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 2 }}>
            {editingId ? (readOnly ? 'View Requisition' : 'Edit Requisition') : 'New Requisition'}
          </div>
          <div style={{ fontSize: 14, color: 'var(--muted)' }}>
            {prNumber ? `${prNumber} · ${status}` : 'PR number is assigned on save'}
            {requestedBy && ` · Requested by ${requestedBy}`}
          </div>
        </div>
        <button onClick={() => navigate('/accounting/pr')} style={{ padding: '9px 16px', borderRadius: 8, fontSize: 14, background: 'var(--row-border, #f3f4f6)', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }}>
          Back
        </button>
      </div>

      {/* Header */}
      <div style={{ background: 'var(--card)', borderRadius: 12, boxShadow: 'var(--card-shadow)', padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 14 }}>
          <div>
            <label style={fieldLabel}>PR Date</label>
            <input className="sr-input" type="date" value={prDate} onChange={(e) => setPrDate(e.target.value)} style={inputStyle} disabled={readOnly} />
          </div>
          <div>
            <label style={fieldLabel}>Department</label>
            <select className="sr-input" value={departmentId} onChange={(e) => setDepartmentId(e.target.value ? Number(e.target.value) : '')} style={inputStyle} disabled={readOnly}>
              <option value="">Select…</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label style={fieldLabel}>Priority</label>
            <select className="sr-input" value={priority} onChange={(e) => setPriority(e.target.value as PrPriority)} style={inputStyle} disabled={readOnly}>
              <option>Normal</option><option>Urgent</option><option>Critical</option>
            </select>
          </div>
          <div>
            <label style={fieldLabel}>Required Date</label>
            <input className="sr-input" type="date" value={requiredDate} onChange={(e) => setRequiredDate(e.target.value)} style={inputStyle} disabled={readOnly} />
          </div>
          <div>
            <label style={fieldLabel}>Budget Code / Cost Center</label>
            <select className="sr-input" value={budgetAccountId} onChange={(e) => setBudgetAccountId(e.target.value ? Number(e.target.value) : '')} style={inputStyle} disabled={readOnly}>
              <option value="">None</option>
              {accounts.filter((a) => a.is_postable).map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: isMobile ? 'auto' : '1 / -1' }}>
            <label style={fieldLabel}>Purpose / Justification</label>
            <textarea className="sr-input" value={purpose} onChange={(e) => setPurpose(e.target.value)} rows={2} style={inputStyle} disabled={readOnly} placeholder="Why this purchase is needed" />
          </div>
        </div>
      </div>

      {/* Line items */}
      <div style={{ background: 'var(--card)', borderRadius: 12, boxShadow: 'var(--card-shadow)', overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--row-border)' }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Line Items</span>
          {!readOnly && (
            <button
              type="button"
              onClick={() => {
                setItemChecked([]);
                setItemSearch('');
                setItemModalOpen(true);
              }}
              style={{ padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'var(--row-border, #f3f4f6)', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <PlusIcon /> Add from Item Master
            </button>
          )}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 900 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.1fr 70px 90px 110px 120px 1.1fr 40px', columnGap: 10, padding: '10px 20px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', borderBottom: '1px solid var(--row-border)', textTransform: 'uppercase' }}>
              <div>Description</div><div>Category</div><div>Qty</div><div>UOM</div><div>Unit Price</div><div>Est. Total</div><div>Pref. Supplier</div><div />
            </div>
            {lines.map((line, i) => {
              const lineTotal = (parseFloat(line.quantity) || 0) * (parseFloat(line.est_unit_price) || 0);
              return (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.1fr 70px 90px 110px 120px 1.1fr 40px', columnGap: 10, padding: '8px 20px', alignItems: 'center', borderBottom: '1px solid var(--row-border)' }}>
                  <input className="sr-input" value={line.description} onChange={(e) => updateLine(i, { description: e.target.value })} style={inputStyle} disabled={readOnly} placeholder="Item / description" />
                  <select className="sr-input" value={line.category_id} onChange={(e) => updateLine(i, { category_id: e.target.value ? Number(e.target.value) : '' })} style={inputStyle} disabled={readOnly}>
                    <option value="">—</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <input className="sr-input" type="number" min="0" step="0.01" value={line.quantity} onChange={(e) => updateLine(i, { quantity: e.target.value })} style={{ ...inputStyle, textAlign: 'right' }} disabled={readOnly} />
                  <select className="sr-input" value={line.uom} onChange={(e) => updateLine(i, { uom: e.target.value })} style={inputStyle} disabled={readOnly}>
                    <option value="">—</option>
                    {UOMS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <input className="sr-input" type="number" min="0" step="0.01" value={line.est_unit_price} onChange={(e) => updateLine(i, { est_unit_price: e.target.value })} style={{ ...inputStyle, textAlign: 'right' }} disabled={readOnly} />
                  <div style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 13 }}>{money(lineTotal)}</div>
                  <select className="sr-input" value={line.preferred_supplier_id} onChange={(e) => updateLine(i, { preferred_supplier_id: e.target.value ? Number(e.target.value) : '' })} style={inputStyle} disabled={readOnly}>
                    <option value="">—</option>
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <button onClick={() => removeLine(i)} disabled={readOnly || lines.length <= 1} title="Remove" style={{ background: 'none', border: 'none', cursor: readOnly || lines.length <= 1 ? 'not-allowed' : 'pointer', color: readOnly || lines.length <= 1 ? 'var(--border)' : 'oklch(0.55 0.16 25)', padding: 4 }}><TrashIcon /></button>
                </div>
              );
            })}
          </div>
        </div>
        {!readOnly && (
          <div style={{ padding: '12px 20px' }}>
            <button onClick={addLine} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--accent, #6366f1)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
              <PlusIcon /> Add line
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', background: 'var(--card)', borderRadius: 12, boxShadow: 'var(--card-shadow)', padding: '16px 20px' }}>
        <div style={{ fontSize: 15 }}>
          <span style={{ color: 'var(--muted)' }}>Estimated Total </span>
          <b style={{ fontFamily: 'monospace', fontSize: 17 }}>{money(grandTotal)}</b>
        </div>
        {!readOnly && (
          <button className="sr-btn-primary" onClick={save} disabled={saving} style={{ padding: '11px 22px', borderRadius: 8, fontSize: 14 }}>
            {saving ? 'Saving…' : editingId ? 'Update Requisition' : 'Create Requisition'}
          </button>
        )}
      </div>

      {/* Item Master picker modal */}
      {itemModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'oklch(0 0 0 / 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={() => setItemModalOpen(false)}>
          <div className="fade-in-xs" style={{ background: 'white', borderRadius: 14, width: 640, maxWidth: '92vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column', padding: 24 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Add from Item Master</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>Ticked items are appended as new requisition lines (qty defaults to 1).</div>

            <input
              className="sr-input"
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              placeholder="Search by name or code…"
              style={{ padding: '9px 12px', borderRadius: 7, fontSize: 14, width: '100%', marginBottom: 12 }}
            />

            <div style={{ overflowY: 'auto', border: '1px solid var(--row-border)', borderRadius: 10 }}>
              {items.length === 0 && <div style={{ padding: '18px 16px', fontSize: 13, color: 'var(--muted)' }}>No items in the master file yet.</div>}
              {items
                .filter((it) => {
                  const q = itemSearch.trim().toLowerCase();
                  if (!q) return true;
                  return it.name.toLowerCase().includes(q) || (it.item_code ?? '').toLowerCase().includes(q);
                })
                .map((it) => {
                  const checked = itemChecked.includes(it.id);
                  return (
                    <label key={it.id} style={{ display: 'grid', gridTemplateColumns: '28px 1fr auto', alignItems: 'center', gap: 10, padding: '11px 14px', borderBottom: '1px solid var(--row-border)', cursor: 'pointer', background: checked ? 'oklch(0.97 0.02 260)' : 'transparent' }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => setItemChecked((prev) => (e.target.checked ? [...prev, it.id] : prev.filter((x) => x !== it.id)))}
                      />
                      <div>
                        <div style={{ fontWeight: 600 }}>{it.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                          {it.item_code ? `${it.item_code} · ` : ''}
                          {categories.find((c) => c.id === it.category_id)?.name ?? 'Uncategorised'}
                          {it.uom ? ` · ${it.uom}` : ''}
                        </div>
                      </div>
                      <div style={{ fontFamily: 'monospace', fontSize: 13, textAlign: 'right' }}>{money(Number(it.unit_price) || 0)}</div>
                    </label>
                  );
                })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
              <button onClick={() => setItemModalOpen(false)} style={{ padding: '10px 16px', borderRadius: 8, fontSize: 14, background: 'var(--row-border, #f3f4f6)', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button className="sr-btn-primary" onClick={applyItemSelection} disabled={itemChecked.length === 0} style={{ padding: '10px 18px', borderRadius: 8, fontSize: 14 }}>
                Add ({itemChecked.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
