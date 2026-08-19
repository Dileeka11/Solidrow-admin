import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { PlusIcon, TrashIcon } from '../components/icons';
import { toastError, toastSuccess } from '../lib/alerts';
import { useIsMobile } from '../lib/useMediaQuery';
import type { Item, ItemCategory, PoDraftLine, PurchaseOrder, PurchaseRequisition, PurchaseRequisitionRow, Supplier } from '../types';

const UOMS = ['Pcs', 'Kg', 'Box', 'Litre', 'Set', 'Unit', 'Pack', 'Roll', 'Pair'];
const PAYMENT_TERMS = ['Net 30', 'Net 15', 'Net 60', 'Advance', 'COD'];
const CURRENCIES = ['LKR', 'USD', 'EUR', 'GBP'];
const today = () => new Date().toISOString().slice(0, 10);
const inputStyle: React.CSSProperties = { padding: '9px 12px', borderRadius: 7, fontSize: 14, width: '100%' };
const fieldLabel: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 5, color: 'var(--label-2)' };

const emptyLine = (): PoDraftLine => ({ description: '', category_id: '', quantity_ordered: '', uom: '', unit_price: '', discount_pct: '', tax_pct: '' });

function money(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function lineTotalOf(l: PoDraftLine): number {
  const base = (parseFloat(l.quantity_ordered) || 0) * (parseFloat(l.unit_price) || 0);
  const afterDisc = base - (base * (parseFloat(l.discount_pct) || 0)) / 100;
  return afterDisc + (afterDisc * (parseFloat(l.tax_pct) || 0)) / 100;
}

export default function PurchaseOrderFormPage() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { id } = useParams();
  const editingId = id ? Number(id) : null;

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [approvedPrs, setApprovedPrs] = useState<PurchaseRequisitionRow[]>([]);

  const [poNumber, setPoNumber] = useState('');
  const [status, setStatus] = useState<PurchaseOrder['status']>('Draft');
  const [poDate, setPoDate] = useState(today());
  const [supplierId, setSupplierId] = useState<number | ''>('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [currency, setCurrency] = useState('LKR');
  const [expectedDate, setExpectedDate] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [sourcePrIds, setSourcePrIds] = useState<number[]>([]);
  const [prModalOpen, setPrModalOpen] = useState(false);
  const [modalChecked, setModalChecked] = useState<number[]>([]);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [itemChecked, setItemChecked] = useState<number[]>([]);
  const [itemSearch, setItemSearch] = useState('');
  const [lines, setLines] = useState<PoDraftLine[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(editingId));

  const readOnly = status !== 'Draft';

  useEffect(() => {
    Promise.all([
      api.get<Supplier[]>('/accounting/suppliers'),
      api.get<ItemCategory[]>('/accounting/item-categories'),
      api.get<PurchaseRequisitionRow[]>('/accounting/purchase-requisitions'),
      api.get<Item[]>('/accounting/items'),
    ])
      .then(([s, c, prs, its]) => {
        setSuppliers(s.data);
        setCategories(c.data);
        setApprovedPrs(prs.data.filter((p) => p.status === 'Approved'));
        setItems(its.data.filter((it) => it.status === 'Active'));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!editingId) return;
    api
      .get<PurchaseOrder>(`/accounting/purchase-orders/${editingId}`)
      .then((res) => {
        const po = res.data;
        setPoNumber(po.po_number);
        setStatus(po.status);
        setPoDate(po.po_date);
        setSupplierId(po.supplier_id ?? '');
        setPaymentTerms(po.payment_terms ?? '');
        setCurrency(po.currency);
        setExpectedDate(po.expected_delivery_date ?? '');
        setDeliveryAddress(po.delivery_address ?? '');
        setSourcePrIds(po.source_pr_ids ?? []);
        setLines(
          po.items.length
            ? po.items.map((it) => ({
                description: it.description,
                category_id: it.category_id ?? '',
                quantity_ordered: String(it.quantity_ordered),
                uom: it.uom ?? '',
                unit_price: String(it.unit_price),
                discount_pct: String(it.discount_pct),
                tax_pct: String(it.tax_pct),
              }))
            : [emptyLine()],
        );
      })
      .catch(() => toastError('Could not load the purchase order.'))
      .finally(() => setLoading(false));
  }, [editingId]);

  const grandTotal = useMemo(() => lines.reduce((sum, l) => sum + lineTotalOf(l), 0), [lines]);

  function updateLine(i: number, patch: Partial<PoDraftLine>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (i: number) => setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));

  /** Append a fetched PR's items to the line grid (after existing rows). */
  function appendPrItems(pr: PurchaseRequisition) {
    const pulled: PoDraftLine[] = pr.items.map((it) => ({
      description: it.description,
      category_id: it.category_id ?? '',
      quantity_ordered: String(it.quantity),
      uom: it.uom ?? '',
      unit_price: String(it.est_unit_price),
      discount_pct: '',
      tax_pct: '',
    }));
    setLines((prev) => {
      const existing = prev.filter((l) => l.description.trim() || l.quantity_ordered);
      return [...existing, ...pulled];
    });
  }

  /** Append the ticked master items to the line grid as new rows. */
  function applyItemSelection() {
    const chosen = items.filter((it) => itemChecked.includes(it.id));
    const pulled: PoDraftLine[] = chosen.map((it) => ({
      description: it.name,
      category_id: it.category_id ?? '',
      quantity_ordered: '1',
      uom: it.uom ?? '',
      unit_price: String(Number(it.unit_price) || 0),
      discount_pct: '',
      tax_pct: '',
    }));
    setLines((prev) => {
      const existing = prev.filter((l) => l.description.trim() || l.quantity_ordered);
      return [...existing, ...pulled];
    });
    setItemModalOpen(false);
  }

  /**
   * Apply the modal's tick selection: pull items for any newly-added PRs, and
   * auto-fill the PO header from the first added PR — Supplier from a line's
   * Preferred Supplier, and Expected Delivery from the PR's Required Date.
   */
  async function applyPrSelection() {
    const added = modalChecked.filter((id) => !sourcePrIds.includes(id));
    let firstPr: PurchaseRequisition | null = null;
    for (const id of added) {
      try {
        const { data } = await api.get<PurchaseRequisition>(`/accounting/purchase-requisitions/${id}`);
        if (!firstPr) firstPr = data;
        appendPrItems(data);
      } catch {
        toastError('Could not pull items for a selected PR.');
      }
    }

    if (firstPr) {
      // Supplier ← first line item that names a preferred supplier.
      const preferred = firstPr.items.find((it) => it.preferred_supplier_id)?.preferred_supplier_id;
      if (preferred && supplierId === '') {
        setSupplierId(preferred);
      }
      // Expected Delivery ← PR's Required Date (only when still blank).
      if (firstPr.required_date && !expectedDate) {
        setExpectedDate(firstPr.required_date);
      }
    }

    setSourcePrIds(modalChecked);
    setPrModalOpen(false);
  }

  function removeSourcePr(id: number) {
    setSourcePrIds((prev) => prev.filter((x) => x !== id));
  }

  async function save() {
    const cleaned = lines
      .filter((l) => l.description.trim() && parseFloat(l.quantity_ordered) > 0)
      .map((l) => ({
        description: l.description.trim(),
        category_id: l.category_id === '' ? null : Number(l.category_id),
        quantity_ordered: parseFloat(l.quantity_ordered),
        uom: l.uom || null,
        unit_price: parseFloat(l.unit_price) || 0,
        discount_pct: parseFloat(l.discount_pct) || 0,
        tax_pct: parseFloat(l.tax_pct) || 0,
      }));

    if (cleaned.length === 0) {
      toastError('Add at least one line item (description + quantity).');
      return;
    }

    const payload = {
      po_date: poDate,
      supplier_id: supplierId === '' ? null : Number(supplierId),
      delivery_address: deliveryAddress.trim() || null,
      payment_terms: paymentTerms || null,
      currency,
      expected_delivery_date: expectedDate || null,
      source_pr_ids: sourcePrIds,
      items: cleaned,
    };

    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/accounting/purchase-orders/${editingId}`, payload);
        toastSuccess('Purchase order updated');
      } else {
        await api.post('/accounting/purchase-orders', payload);
        toastSuccess('Purchase order created');
      }
      navigate('/accounting/po');
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data;
      const first = data?.errors ? Object.values(data.errors)[0]?.[0] : undefined;
      toastError(first ?? data?.message ?? 'Could not save the purchase order.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading…</div>;

  return (
    <div className="fade-in-s" style={{ maxWidth: 1080 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 2 }}>{editingId ? (readOnly ? 'View Purchase Order' : 'Edit Purchase Order') : 'New Purchase Order'}</div>
          <div style={{ fontSize: 14, color: 'var(--muted)' }}>{poNumber ? `${poNumber} · ${status}` : 'PO number is assigned on save'}</div>
        </div>
        <button onClick={() => navigate('/accounting/po')} style={{ padding: '9px 16px', borderRadius: 8, fontSize: 14, background: 'var(--row-border, #f3f4f6)', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }}>Back</button>
      </div>

      {/* Header */}
      <div style={{ background: 'var(--card)', borderRadius: 12, boxShadow: 'var(--card-shadow)', padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 14 }}>
          <div>
            <label style={fieldLabel}>PO Date</label>
            <input className="sr-input" type="date" value={poDate} onChange={(e) => setPoDate(e.target.value)} style={inputStyle} disabled={readOnly} />
          </div>
          <div>
            <label style={fieldLabel}>Supplier</label>
            <select className="sr-input" value={supplierId} onChange={(e) => setSupplierId(e.target.value ? Number(e.target.value) : '')} style={inputStyle} disabled={readOnly}>
              <option value="">Select…</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label style={fieldLabel}>Payment Terms</label>
            <select className="sr-input" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} style={inputStyle} disabled={readOnly}>
              <option value="">—</option>
              {PAYMENT_TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={fieldLabel}>Currency</label>
            <select className="sr-input" value={currency} onChange={(e) => setCurrency(e.target.value)} style={inputStyle} disabled={readOnly}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={fieldLabel}>Expected Delivery</label>
            <input className="sr-input" type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} style={inputStyle} disabled={readOnly} />
          </div>
          <div>
            <label style={fieldLabel}>Delivery Address</label>
            <input className="sr-input" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} style={inputStyle} disabled={readOnly} placeholder="Warehouse / site" />
          </div>
        </div>

        {!readOnly && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--row-border)' }}>
            <label style={fieldLabel}>Source PR(s)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  setModalChecked([...sourcePrIds]);
                  setPrModalOpen(true);
                }}
                style={{ padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'var(--row-border, #f3f4f6)', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <PlusIcon /> Select PR(s)
              </button>
              {sourcePrIds.map((pid) => {
                const pr = approvedPrs.find((p) => p.id === pid);
                return (
                  <span key={pid} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, background: 'oklch(0.95 0.03 260)', color: 'var(--accent, #6366f1)', padding: '5px 10px', borderRadius: 7 }}>
                    {pr?.pr_number ?? `PR #${pid}`}
                    <button type="button" onClick={() => removeSourcePr(pid)} title="Remove" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 15, lineHeight: 1, padding: 0 }}>×</button>
                  </span>
                );
              })}
              {sourcePrIds.length === 0 && <span style={{ fontSize: 13, color: 'var(--muted)' }}>None selected</span>}
            </div>
          </div>
        )}
        {readOnly && sourcePrIds.length > 0 && (
          <div style={{ marginTop: 12, fontSize: 13, color: 'var(--muted)' }}>Source PRs: {sourcePrIds.length}</div>
        )}
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
          <div style={{ minWidth: 980 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr 70px 80px 110px 70px 70px 120px 40px', columnGap: 10, padding: '10px 20px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', borderBottom: '1px solid var(--row-border)', textTransform: 'uppercase' }}>
              <div>Description</div><div>Category</div><div>Qty</div><div>UOM</div><div>Unit Price</div><div>Disc%</div><div>Tax%</div><div>Line Total</div><div />
            </div>
            {lines.map((line, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr 70px 80px 110px 70px 70px 120px 40px', columnGap: 10, padding: '8px 20px', alignItems: 'center', borderBottom: '1px solid var(--row-border)' }}>
                <input className="sr-input" value={line.description} onChange={(e) => updateLine(i, { description: e.target.value })} style={inputStyle} disabled={readOnly} placeholder="Item / description" />
                <select className="sr-input" value={line.category_id} onChange={(e) => updateLine(i, { category_id: e.target.value ? Number(e.target.value) : '' })} style={inputStyle} disabled={readOnly}>
                  <option value="">—</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <input className="sr-input" type="number" min="0" step="0.01" value={line.quantity_ordered} onChange={(e) => updateLine(i, { quantity_ordered: e.target.value })} style={{ ...inputStyle, textAlign: 'right' }} disabled={readOnly} />
                <select className="sr-input" value={line.uom} onChange={(e) => updateLine(i, { uom: e.target.value })} style={inputStyle} disabled={readOnly}>
                  <option value="">—</option>
                  {UOMS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
                <input className="sr-input" type="number" min="0" step="0.01" value={line.unit_price} onChange={(e) => updateLine(i, { unit_price: e.target.value })} style={{ ...inputStyle, textAlign: 'right' }} disabled={readOnly} />
                <input className="sr-input" type="number" min="0" max="100" step="0.01" value={line.discount_pct} onChange={(e) => updateLine(i, { discount_pct: e.target.value })} style={{ ...inputStyle, textAlign: 'right' }} disabled={readOnly} />
                <input className="sr-input" type="number" min="0" max="100" step="0.01" value={line.tax_pct} onChange={(e) => updateLine(i, { tax_pct: e.target.value })} style={{ ...inputStyle, textAlign: 'right' }} disabled={readOnly} />
                <div style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 13 }}>{money(lineTotalOf(line))}</div>
                <button onClick={() => removeLine(i)} disabled={readOnly || lines.length <= 1} title="Remove" style={{ background: 'none', border: 'none', cursor: readOnly || lines.length <= 1 ? 'not-allowed' : 'pointer', color: readOnly || lines.length <= 1 ? 'var(--border)' : 'oklch(0.55 0.16 25)', padding: 4 }}><TrashIcon /></button>
              </div>
            ))}
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
          <span style={{ color: 'var(--muted)' }}>Order Total </span>
          <b style={{ fontFamily: 'monospace', fontSize: 17 }}>{money(grandTotal)}</b>
          <span style={{ color: 'var(--muted)', fontSize: 13 }}> {currency}</span>
        </div>
        {!readOnly && (
          <button className="sr-btn-primary" onClick={save} disabled={saving} style={{ padding: '11px 22px', borderRadius: 8, fontSize: 14 }}>
            {saving ? 'Saving…' : editingId ? 'Update PO' : 'Create PO'}
          </button>
        )}
      </div>

      {/* Item Master picker modal */}
      {itemModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'oklch(0 0 0 / 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={() => setItemModalOpen(false)}>
          <div className="fade-in-xs" style={{ background: 'white', borderRadius: 14, width: 640, maxWidth: '92vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column', padding: 24 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Add from Item Master</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>Ticked items are appended as new PO lines (qty defaults to 1).</div>

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

      {/* Source PR picker modal */}
      {prModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'oklch(0 0 0 / 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={() => setPrModalOpen(false)}>
          <div className="fade-in-xs" style={{ background: 'white', borderRadius: 14, width: 620, maxWidth: '92vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column', padding: 24 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Select Purchase Requisitions</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>Approved requisitions — ticked PRs have their items pulled into this PO.</div>

            <div style={{ overflowY: 'auto', border: '1px solid var(--row-border)', borderRadius: 10 }}>
              {approvedPrs.length === 0 && <div style={{ padding: '18px 16px', fontSize: 13, color: 'var(--muted)' }}>No approved requisitions available.</div>}
              {approvedPrs.map((pr) => {
                const checked = modalChecked.includes(pr.id);
                return (
                  <label key={pr.id} style={{ display: 'grid', gridTemplateColumns: '28px 1fr auto', alignItems: 'center', gap: 10, padding: '11px 14px', borderBottom: '1px solid var(--row-border)', cursor: 'pointer', background: checked ? 'oklch(0.97 0.02 260)' : 'transparent' }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => setModalChecked((prev) => (e.target.checked ? [...prev, pr.id] : prev.filter((x) => x !== pr.id)))}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontFamily: 'monospace' }}>{pr.pr_number}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                        {pr.pr_date}
                        {pr.department_name ? ` · ${pr.department_name}` : ''} · {pr.item_count} item{pr.item_count === 1 ? '' : 's'}
                      </div>
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: 13, textAlign: 'right' }}>
                      {Number(pr.total_estimated).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </label>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
              <button onClick={() => setPrModalOpen(false)} style={{ padding: '10px 16px', borderRadius: 8, fontSize: 14, background: 'var(--row-border, #f3f4f6)', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button className="sr-btn-primary" onClick={applyPrSelection} style={{ padding: '10px 18px', borderRadius: 8, fontSize: 14 }}>
                Apply ({modalChecked.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
