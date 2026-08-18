import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { toastError, toastSuccess } from '../lib/alerts';
import { useIsMobile } from '../lib/useMediaQuery';
import type { GoodsReceivedNote, GrnDraftLine, PurchaseOrder, PurchaseOrderRow } from '../types';

const CONDITIONS = ['Good', 'Damaged', 'Short Shipped'];
const today = () => new Date().toISOString().slice(0, 10);
const inputStyle: React.CSSProperties = { padding: '9px 12px', borderRadius: 7, fontSize: 14, width: '100%' };
const fieldLabel: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 5, color: 'var(--label-2)' };

export default function GoodsReceivedNoteFormPage() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { id } = useParams();
  const editingId = id ? Number(id) : null;

  const [receivablePos, setReceivablePos] = useState<PurchaseOrderRow[]>([]);
  const [grnNumber, setGrnNumber] = useState('');
  const [status, setStatus] = useState<GoodsReceivedNote['status']>('Draft');
  const [grnDate, setGrnDate] = useState(today());
  const [poId, setPoId] = useState<number | ''>('');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [warehouse, setWarehouse] = useState('');
  const [lines, setLines] = useState<GrnDraftLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(editingId));

  const readOnly = status !== 'Draft';

  useEffect(() => {
    api
      .get<PurchaseOrderRow[]>('/accounting/purchase-orders')
      .then((res) => setReceivablePos(res.data.filter((p) => ['Approved', 'Sent to Supplier', 'Partially Received'].includes(p.status))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!editingId) return;
    api
      .get<GoodsReceivedNote>(`/accounting/grns/${editingId}`)
      .then((res) => {
        const grn = res.data;
        setGrnNumber(grn.grn_number);
        setStatus(grn.status);
        setGrnDate(grn.grn_date);
        setPoId(grn.po_id);
        setDeliveryNote(grn.delivery_note_no ?? '');
        setWarehouse(grn.warehouse ?? '');
        setLines(
          grn.items.map((it) => ({
            po_item_id: it.po_item_id,
            description: it.description,
            quantity_ordered: Number(it.quantity_ordered),
            quantity_pending: Number(it.quantity_ordered),
            quantity_received: String(it.quantity_received),
            quantity_accepted: String(it.quantity_accepted),
            quantity_rejected: String(it.quantity_rejected),
            rejection_reason: it.rejection_reason ?? '',
            batch_serial_no: it.batch_serial_no ?? '',
            condition: it.condition ?? '',
            remarks: it.remarks ?? '',
          })),
        );
      })
      .catch(() => toastError('Could not load the GRN.'))
      .finally(() => setLoading(false));
  }, [editingId]);

  /** When a PO is chosen, pull its pending line items into the receipt grid. */
  async function onPickPo(newPoId: number | '') {
    setPoId(newPoId);
    setLines([]);
    if (!newPoId) return;
    try {
      const { data } = await api.get<PurchaseOrder>(`/accounting/purchase-orders/${newPoId}`);
      const pending = data.items
        .filter((it) => Number(it.quantity_pending) > 0)
        .map((it) => {
          const pend = Number(it.quantity_pending);
          return {
            po_item_id: it.id ?? null,
            description: it.description,
            quantity_ordered: Number(it.quantity_ordered),
            quantity_pending: pend,
            quantity_received: String(pend),
            quantity_accepted: String(pend),
            quantity_rejected: '0',
            rejection_reason: '',
            batch_serial_no: '',
            condition: 'Good',
            remarks: '',
          } as GrnDraftLine;
        });
      if (pending.length === 0) toastError('This PO has no pending quantities to receive.');
      setLines(pending);
    } catch {
      toastError('Could not load PO items.');
    }
  }

  function updateLine(i: number, patch: Partial<GrnDraftLine>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function save() {
    if (!poId) {
      toastError('Select a purchase order.');
      return;
    }
    const items = lines
      .filter((l) => Number(l.quantity_received) > 0)
      .map((l) => ({
        po_item_id: l.po_item_id,
        description: l.description,
        quantity_ordered: l.quantity_ordered,
        quantity_received: parseFloat(l.quantity_received) || 0,
        quantity_accepted: parseFloat(l.quantity_accepted) || 0,
        quantity_rejected: parseFloat(l.quantity_rejected) || 0,
        rejection_reason: l.rejection_reason.trim() || null,
        batch_serial_no: l.batch_serial_no.trim() || null,
        condition: l.condition || null,
        remarks: l.remarks.trim() || null,
      }));

    if (items.length === 0) {
      toastError('Enter a received quantity for at least one line.');
      return;
    }

    const payload = { grn_date: grnDate, po_id: Number(poId), delivery_note_no: deliveryNote.trim() || null, warehouse: warehouse.trim() || null, items };

    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/accounting/grns/${editingId}`, payload);
        toastSuccess('GRN updated');
      } else {
        await api.post('/accounting/grns', payload);
        toastSuccess('GRN created');
      }
      navigate('/accounting/grn');
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data;
      const first = data?.errors ? Object.values(data.errors)[0]?.[0] : undefined;
      toastError(first ?? data?.message ?? 'Could not save the GRN.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading…</div>;

  return (
    <div className="fade-in-s" style={{ maxWidth: 1120 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 2 }}>{editingId ? (readOnly ? 'View GRN' : 'Edit GRN') : 'New Goods Received Note'}</div>
          <div style={{ fontSize: 14, color: 'var(--muted)' }}>{grnNumber ? `${grnNumber} · ${status}` : 'GRN number is assigned on save'}</div>
        </div>
        <button onClick={() => navigate('/accounting/grn')} style={{ padding: '9px 16px', borderRadius: 8, fontSize: 14, background: 'var(--row-border, #f3f4f6)', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }}>Back</button>
      </div>

      {/* Header */}
      <div style={{ background: 'var(--card)', borderRadius: 12, boxShadow: 'var(--card-shadow)', padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 14 }}>
          <div>
            <label style={fieldLabel}>GRN Date</label>
            <input className="sr-input" type="date" value={grnDate} onChange={(e) => setGrnDate(e.target.value)} style={inputStyle} disabled={readOnly} />
          </div>
          <div>
            <label style={fieldLabel}>Reference PO</label>
            <select className="sr-input" value={poId} onChange={(e) => onPickPo(e.target.value ? Number(e.target.value) : '')} style={inputStyle} disabled={readOnly || Boolean(editingId)}>
              <option value="">Select a purchase order…</option>
              {receivablePos.map((p) => <option key={p.id} value={p.id}>{p.po_number} · {p.supplier_name ?? ''}</option>)}
              {editingId && !receivablePos.some((p) => p.id === poId) && poId !== '' && <option value={poId}>Current PO</option>}
            </select>
          </div>
          <div>
            <label style={fieldLabel}>Delivery Note / Waybill No.</label>
            <input className="sr-input" value={deliveryNote} onChange={(e) => setDeliveryNote(e.target.value)} style={inputStyle} disabled={readOnly} placeholder="Supplier document ref" />
          </div>
          <div>
            <label style={fieldLabel}>Warehouse / Location</label>
            <input className="sr-input" value={warehouse} onChange={(e) => setWarehouse(e.target.value)} style={inputStyle} disabled={readOnly} placeholder="e.g. Main Store" />
          </div>
        </div>
      </div>

      {/* Line items */}
      <div style={{ background: 'var(--card)', borderRadius: 12, boxShadow: 'var(--card-shadow)', overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '12px 20px', fontSize: 13, fontWeight: 700, borderBottom: '1px solid var(--row-border)' }}>Received Items</div>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 1040 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 70px 80px 80px 80px 1fr 110px 1fr', columnGap: 10, padding: '10px 20px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', borderBottom: '1px solid var(--row-border)', textTransform: 'uppercase' }}>
              <div>Item</div><div>Ordered</div><div>Received</div><div>Accepted</div><div>Rejected</div><div>Reject Reason</div><div>Condition</div><div>Batch / Remarks</div>
            </div>
            {lines.length === 0 && <div style={{ padding: '16px 20px', fontSize: 13, color: 'var(--muted)' }}>Pick a purchase order to load its pending items.</div>}
            {lines.map((line, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.5fr 70px 80px 80px 80px 1fr 110px 1fr', columnGap: 10, padding: '8px 20px', alignItems: 'center', borderBottom: '1px solid var(--row-border)' }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{line.description}</div>
                <div style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 13, color: 'var(--muted)' }}>{line.quantity_ordered}</div>
                <input className="sr-input" type="number" min="0" step="0.01" value={line.quantity_received} onChange={(e) => updateLine(i, { quantity_received: e.target.value })} style={{ ...inputStyle, textAlign: 'right' }} disabled={readOnly} />
                <input className="sr-input" type="number" min="0" step="0.01" value={line.quantity_accepted} onChange={(e) => updateLine(i, { quantity_accepted: e.target.value })} style={{ ...inputStyle, textAlign: 'right' }} disabled={readOnly} />
                <input className="sr-input" type="number" min="0" step="0.01" value={line.quantity_rejected} onChange={(e) => updateLine(i, { quantity_rejected: e.target.value })} style={{ ...inputStyle, textAlign: 'right' }} disabled={readOnly} />
                <input className="sr-input" value={line.rejection_reason} onChange={(e) => updateLine(i, { rejection_reason: e.target.value })} style={inputStyle} disabled={readOnly} placeholder={Number(line.quantity_rejected) > 0 ? 'Required' : '—'} />
                <select className="sr-input" value={line.condition} onChange={(e) => updateLine(i, { condition: e.target.value })} style={inputStyle} disabled={readOnly}>
                  <option value="">—</option>
                  {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <input className="sr-input" value={line.batch_serial_no} onChange={(e) => updateLine(i, { batch_serial_no: e.target.value })} style={inputStyle} disabled={readOnly} placeholder="Batch / serial" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, background: 'var(--card)', borderRadius: 12, boxShadow: 'var(--card-shadow)', padding: '16px 20px' }}>
        {!readOnly && (
          <button className="sr-btn-primary" onClick={save} disabled={saving} style={{ padding: '11px 22px', borderRadius: 8, fontSize: 14 }}>
            {saving ? 'Saving…' : editingId ? 'Update GRN' : 'Create GRN'}
          </button>
        )}
      </div>
    </div>
  );
}
