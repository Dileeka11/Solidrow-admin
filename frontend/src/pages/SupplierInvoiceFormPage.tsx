import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { PlusIcon, TrashIcon } from '../components/icons';
import { toastError, toastSuccess } from '../lib/alerts';
import { useIsMobile } from '../lib/useMediaQuery';
import type { GrnRow, InvoiceDraftLine, MatchingResult, PurchaseOrder, PurchaseOrderRow, SupplierInvoice } from '../types';

const today = () => new Date().toISOString().slice(0, 10);
const inputStyle: React.CSSProperties = { padding: '9px 12px', borderRadius: 7, fontSize: 14, width: '100%' };
const fieldLabel: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 5, color: 'var(--label-2)' };
const emptyLine = (): InvoiceDraftLine => ({ po_item_id: null, description: '', quantity_invoiced: '', unit_price: '', tax_pct: '' });

function money(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function lineTotalOf(l: InvoiceDraftLine): number {
  const base = (parseFloat(l.quantity_invoiced) || 0) * (parseFloat(l.unit_price) || 0);
  return base + (base * (parseFloat(l.tax_pct) || 0)) / 100;
}

function MatchBadge({ status }: { status: string }) {
  const ok = status === 'Match';
  const c = ok ? { fg: 'oklch(0.45 0.13 150)', bg: 'oklch(0.95 0.05 150)' } : status === 'Variance' ? { fg: 'oklch(0.5 0.16 25)', bg: 'oklch(0.95 0.05 25)' } : { fg: 'oklch(0.5 0.02 250)', bg: 'oklch(0.94 0.01 250)' };
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 5, color: c.fg, background: c.bg, whiteSpace: 'nowrap' }}>{ok ? '✓ ' : status === 'Variance' ? '⚠ ' : ''}{status}</span>;
}

export default function SupplierInvoiceFormPage() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { id } = useParams();
  const editingId = id ? Number(id) : null;

  const [pos, setPos] = useState<PurchaseOrderRow[]>([]);
  const [grns, setGrns] = useState<GrnRow[]>([]);

  const [refNo, setRefNo] = useState('');
  const [status, setStatus] = useState<SupplierInvoice['status']>('Draft');
  const [invoiceDate, setInvoiceDate] = useState(today());
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState('');
  const [poId, setPoId] = useState<number | ''>('');
  const [grnIds, setGrnIds] = useState<number[]>([]);
  const [dueDate, setDueDate] = useState('');
  const [currency, setCurrency] = useState('LKR');
  const [attached, setAttached] = useState('');
  const [lines, setLines] = useState<InvoiceDraftLine[]>([emptyLine()]);
  const [matching, setMatching] = useState<MatchingResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(editingId));

  const readOnly = status !== 'Draft';

  useEffect(() => {
    Promise.all([
      api.get<PurchaseOrderRow[]>('/accounting/purchase-orders'),
      api.get<GrnRow[]>('/accounting/grns'),
    ])
      .then(([p, g]) => {
        setPos(p.data);
        setGrns(g.data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!editingId) return;
    api
      .get<SupplierInvoice>(`/accounting/supplier-invoices/${editingId}`)
      .then((res) => {
        const inv = res.data;
        setRefNo(inv.internal_ref_no);
        setStatus(inv.status);
        setInvoiceDate(inv.invoice_date);
        setSupplierInvoiceNo(inv.supplier_invoice_no ?? '');
        setPoId(inv.po_id ?? '');
        setGrnIds(inv.grn_ids ?? []);
        setDueDate(inv.due_date ?? '');
        setCurrency(inv.currency);
        setAttached(inv.attached_document ?? '');
        setLines(inv.items.length ? inv.items.map((it) => ({ po_item_id: it.po_item_id, description: it.description, quantity_invoiced: String(it.quantity_invoiced), unit_price: String(it.unit_price), tax_pct: String(it.tax_pct) })) : [emptyLine()]);
      })
      .catch(() => toastError('Could not load the invoice.'))
      .finally(() => setLoading(false));
    // Load the matching comparison for saved invoices with a PO.
    api.get<MatchingResult>(`/accounting/supplier-invoices/${editingId}/matching`).then((r) => setMatching(r.data)).catch(() => {});
  }, [editingId]);

  const grandTotal = useMemo(() => lines.reduce((s, l) => s + lineTotalOf(l), 0), [lines]);
  const poGrns = useMemo(() => grns.filter((g) => g.po_id === poId && g.status !== 'Draft'), [grns, poId]);

  function updateLine(i: number, patch: Partial<InvoiceDraftLine>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (i: number) => setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));

  async function onPickPo(newPoId: number | '') {
    setPoId(newPoId);
    setGrnIds([]);
    if (!newPoId) return;
    try {
      const { data } = await api.get<PurchaseOrder>(`/accounting/purchase-orders/${newPoId}`);
      setLines(
        data.items.map((it) => ({
          po_item_id: it.id ?? null,
          description: it.description,
          quantity_invoiced: String(it.quantity_received && Number(it.quantity_received) > 0 ? it.quantity_received : it.quantity_ordered),
          unit_price: String(it.unit_price),
          tax_pct: String(it.tax_pct),
        })),
      );
    } catch {
      toastError('Could not load PO items.');
    }
  }

  async function save() {
    const items = lines
      .filter((l) => l.description.trim() && parseFloat(l.quantity_invoiced) > 0)
      .map((l) => ({ po_item_id: l.po_item_id, description: l.description.trim(), quantity_invoiced: parseFloat(l.quantity_invoiced), unit_price: parseFloat(l.unit_price) || 0, tax_pct: parseFloat(l.tax_pct) || 0 }));
    if (items.length === 0) {
      toastError('Add at least one line item.');
      return;
    }
    const payload = { invoice_date: invoiceDate, supplier_invoice_no: supplierInvoiceNo.trim() || null, po_id: poId === '' ? null : Number(poId), grn_ids: grnIds, due_date: dueDate || null, currency, attached_document: attached.trim() || null, items };
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/accounting/supplier-invoices/${editingId}`, payload);
        toastSuccess('Invoice updated');
      } else {
        await api.post('/accounting/supplier-invoices', payload);
        toastSuccess('Invoice created');
      }
      navigate('/accounting/payment');
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data;
      const first = data?.errors ? Object.values(data.errors)[0]?.[0] : undefined;
      toastError(first ?? data?.message ?? 'Could not save the invoice.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading…</div>;

  return (
    <div className="fade-in-s" style={{ maxWidth: 1120 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 2 }}>{editingId ? (readOnly ? 'Invoice & Matching' : 'Edit Invoice') : 'New Supplier Invoice'}</div>
          <div style={{ fontSize: 14, color: 'var(--muted)' }}>{refNo ? `${refNo} · ${status}` : 'Reference is assigned on save'}</div>
        </div>
        <button onClick={() => navigate('/accounting/payment')} style={{ padding: '9px 16px', borderRadius: 8, fontSize: 14, background: 'var(--row-border, #f3f4f6)', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }}>Back</button>
      </div>

      {/* Header */}
      <div style={{ background: 'var(--card)', borderRadius: 12, boxShadow: 'var(--card-shadow)', padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 14 }}>
          <div>
            <label style={fieldLabel}>Invoice Date</label>
            <input className="sr-input" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} style={inputStyle} disabled={readOnly} />
          </div>
          <div>
            <label style={fieldLabel}>Supplier Invoice No.</label>
            <input className="sr-input" value={supplierInvoiceNo} onChange={(e) => setSupplierInvoiceNo(e.target.value)} style={inputStyle} disabled={readOnly} placeholder="As on supplier bill" />
          </div>
          <div>
            <label style={fieldLabel}>Reference PO</label>
            <select className="sr-input" value={poId} onChange={(e) => onPickPo(e.target.value ? Number(e.target.value) : '')} style={inputStyle} disabled={readOnly}>
              <option value="">None</option>
              {pos.map((p) => <option key={p.id} value={p.id}>{p.po_number} · {p.supplier_name ?? ''}</option>)}
            </select>
          </div>
          <div>
            <label style={fieldLabel}>Due Date</label>
            <input className="sr-input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={inputStyle} disabled={readOnly} />
          </div>
          <div>
            <label style={fieldLabel}>Currency</label>
            <select className="sr-input" value={currency} onChange={(e) => setCurrency(e.target.value)} style={inputStyle} disabled={readOnly}>
              {['LKR', 'USD', 'EUR', 'GBP'].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={fieldLabel}>Attached Document</label>
            <input className="sr-input" value={attached} onChange={(e) => setAttached(e.target.value)} style={inputStyle} disabled={readOnly} placeholder="File name / URL" />
          </div>
        </div>
        {poId !== '' && poGrns.length > 0 && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--row-border)' }}>
            <label style={fieldLabel}>Reference GRN(s)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {poGrns.map((g) => (
                <label key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, background: 'var(--row-border, #f3f4f6)', padding: '5px 10px', borderRadius: 7, cursor: readOnly ? 'default' : 'pointer' }}>
                  <input type="checkbox" disabled={readOnly} checked={grnIds.includes(g.id)} onChange={(e) => setGrnIds((prev) => (e.target.checked ? [...prev, g.id] : prev.filter((x) => x !== g.id)))} />
                  {g.grn_number}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Line items */}
      <div style={{ background: 'var(--card)', borderRadius: 12, boxShadow: 'var(--card-shadow)', overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '12px 20px', fontSize: 13, fontWeight: 700, borderBottom: '1px solid var(--row-border)' }}>Invoice Line Items</div>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 760 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 90px 120px 80px 130px 40px', columnGap: 10, padding: '10px 20px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', borderBottom: '1px solid var(--row-border)', textTransform: 'uppercase' }}>
              <div>Description</div><div>Qty</div><div>Unit Price</div><div>Tax%</div><div>Line Total</div><div />
            </div>
            {lines.map((line, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 90px 120px 80px 130px 40px', columnGap: 10, padding: '8px 20px', alignItems: 'center', borderBottom: '1px solid var(--row-border)' }}>
                <input className="sr-input" value={line.description} onChange={(e) => updateLine(i, { description: e.target.value })} style={inputStyle} disabled={readOnly} placeholder="Item / description" />
                <input className="sr-input" type="number" min="0" step="0.01" value={line.quantity_invoiced} onChange={(e) => updateLine(i, { quantity_invoiced: e.target.value })} style={{ ...inputStyle, textAlign: 'right' }} disabled={readOnly} />
                <input className="sr-input" type="number" min="0" step="0.01" value={line.unit_price} onChange={(e) => updateLine(i, { unit_price: e.target.value })} style={{ ...inputStyle, textAlign: 'right' }} disabled={readOnly} />
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

      {/* 3-way matching (saved invoices with a PO) */}
      {editingId && matching && matching.rows.length > 0 && (
        <div style={{ background: 'var(--card)', borderRadius: 12, boxShadow: 'var(--card-shadow)', overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ padding: '12px 20px', fontSize: 13, fontWeight: 700, borderBottom: '1px solid var(--row-border)', display: 'flex', justifyContent: 'space-between' }}>
            <span>3-Way Matching (PO · GRN · Invoice)</span>
            <span style={{ color: matching.matched ? 'oklch(0.45 0.13 150)' : 'oklch(0.5 0.16 25)' }}>{matching.matched ? '✓ Fully matched' : '⚠ Variances found'}</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 900 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 70px 70px 70px 90px 90px 90px 90px 100px', columnGap: 8, padding: '10px 20px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', borderBottom: '1px solid var(--row-border)', textTransform: 'uppercase' }}>
                <div>Item</div><div>Ord</div><div>Rec</div><div>Inv</div><div>Qty</div><div>Agreed</div><div>Billed</div><div>Price</div><div>Total</div>
              </div>
              {matching.rows.map((r, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.6fr 70px 70px 70px 90px 90px 90px 90px 100px', columnGap: 8, padding: '9px 20px', fontSize: 12.5, alignItems: 'center', borderBottom: '1px solid var(--row-border)' }}>
                  <div style={{ fontWeight: 500 }}>{r.description}</div>
                  <div style={{ textAlign: 'right', fontFamily: 'monospace' }}>{r.ordered_qty ?? '—'}</div>
                  <div style={{ textAlign: 'right', fontFamily: 'monospace' }}>{r.received_qty ?? '—'}</div>
                  <div style={{ textAlign: 'right', fontFamily: 'monospace' }}>{r.invoiced_qty}</div>
                  <div><MatchBadge status={r.qty_status} /></div>
                  <div style={{ textAlign: 'right', fontFamily: 'monospace' }}>{r.agreed_price ?? '—'}</div>
                  <div style={{ textAlign: 'right', fontFamily: 'monospace' }}>{r.billed_price ?? '—'}</div>
                  <div><MatchBadge status={r.price_status} /></div>
                  <div><MatchBadge status={r.total_status} /></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', background: 'var(--card)', borderRadius: 12, boxShadow: 'var(--card-shadow)', padding: '16px 20px' }}>
        <div style={{ fontSize: 15 }}>
          <span style={{ color: 'var(--muted)' }}>Invoice Total </span>
          <b style={{ fontFamily: 'monospace', fontSize: 17 }}>{money(grandTotal)}</b>
          <span style={{ color: 'var(--muted)', fontSize: 13 }}> {currency}</span>
        </div>
        {!readOnly && (
          <button className="sr-btn-primary" onClick={save} disabled={saving} style={{ padding: '11px 22px', borderRadius: 8, fontSize: 14 }}>
            {saving ? 'Saving…' : editingId ? 'Update Invoice' : 'Create Invoice'}
          </button>
        )}
      </div>
    </div>
  );
}
