import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { PlusIcon, TrashIcon } from '../components/icons';
import { toastError, toastSuccess } from '../lib/alerts';
import { useIsMobile } from '../lib/useMediaQuery';
import type { FinancialYear, SalesInvoice, SalesInvoiceDraftLine, AccountRow } from '../types';

const inp: React.CSSProperties = { padding: '9px 12px', borderRadius: 7, fontSize: 14 };
const lbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 5, color: 'var(--label-2)' };
const tblHead: React.CSSProperties = { padding: '10px 14px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.03em', borderBottom: '1px solid var(--row-border)' };
const tblCell: React.CSSProperties = { padding: '10px 14px', borderBottom: '1px solid var(--row-border)' };

type Form = {
  financial_year_id: string;
  invoice_date: string;
  due_date: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  payment_method: 'cash_in_hand' | 'bank';
  payment_account_id: string;
  currency: string;
  notes: string;
};

const EMPTY_LINE: SalesInvoiceDraftLine = { description: '', quantity: '1', uom: '', unit_price: '', tax_pct: '0', line_total: '0' };

export default function SalesInvoiceFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const isNew = !id;

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [invoice, setInvoice] = useState<SalesInvoice | null>(null);

  const [years, setYears] = useState<FinancialYear[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  
  const [form, setForm] = useState<Form>({
    financial_year_id: '', invoice_date: new Date().toISOString().split('T')[0], due_date: '',
    customer_name: '', customer_phone: '', customer_address: '',
    payment_method: 'cash_in_hand', payment_account_id: '', currency: 'LKR', notes: '',
  });
  const [lines, setLines] = useState<SalesInvoiceDraftLine[]>([{ ...EMPTY_LINE }]);
  const [error, setError] = useState('');

  // Calc totals
  const subtotal = lines.reduce((sum, l) => sum + (Number(l.quantity) * Number(l.unit_price) || 0), 0);
  const taxAmount = lines.reduce((sum, l) => sum + ((Number(l.quantity) * Number(l.unit_price) * Number(l.tax_pct)) / 100 || 0), 0);
  const total = subtotal + taxAmount;

  // Filter payment accounts based on method
  const paymentAccounts = accounts.filter(a => {
    if (!a.is_active || !a.is_postable) return false;
    const gCode = a.group_code?.toLowerCase() || '';
    const gName = a.group_name?.toLowerCase() || '';
    if (form.payment_method === 'cash_in_hand') return gName.includes('cash') && !gName.includes('bank');
    if (form.payment_method === 'bank') return gName.includes('bank') || gCode.includes('bank');
    return false;
  });

  useEffect(() => {
    async function init() {
      try {
        const [fyRes, accRes] = await Promise.all([
          api.get<FinancialYear[]>('/accounting/financial-years'),
          api.get<AccountRow[]>('/accounting/accounts'),
        ]);
        setYears(fyRes.data);
        setAccounts(accRes.data);
        const activeY = fyRes.data.find(y => y.is_active);
        if (isNew && activeY) setForm(f => ({ ...f, financial_year_id: String(activeY.id) }));

        if (!isNew) {
          const invRes = await api.get<SalesInvoice>(`/accounting/sales-invoices/${id}`);
          const inv = invRes.data;
          setInvoice(inv);
          setForm({
            financial_year_id: inv.financial_year_id ? String(inv.financial_year_id) : '',
            invoice_date: inv.invoice_date, due_date: inv.due_date || '',
            customer_name: inv.customer_name, customer_phone: inv.customer_phone || '', customer_address: inv.customer_address || '',
            payment_method: inv.payment_method, payment_account_id: inv.payment_account_id ? String(inv.payment_account_id) : '',
            currency: inv.currency, notes: inv.notes || '',
          });
          if (inv.items.length) {
            setLines(inv.items.map(item => ({
              description: item.description, quantity: String(item.quantity), uom: item.uom || '',
              unit_price: String(item.unit_price), tax_pct: String(item.tax_pct), line_total: String(item.line_total)
            })));
          }
        }
      } catch {
        toastError('Failed to load data.');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [id, isNew]);

  function updateLine(index: number, field: keyof SalesInvoiceDraftLine, value: string) {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    // Auto-calc line total
    if (field === 'quantity' || field === 'unit_price' || field === 'tax_pct') {
      const q = Number(newLines[index].quantity) || 0;
      const p = Number(newLines[index].unit_price) || 0;
      const t = Number(newLines[index].tax_pct) || 0;
      newLines[index].line_total = ((q * p) + (q * p * t / 100)).toFixed(2);
    }
    setLines(newLines);
  }

  function addLine() { setLines([...lines, { ...EMPTY_LINE }]); }
  function removeLine(index: number) { if (lines.length > 1) setLines(lines.filter((_, i) => i !== index)); }

  async function handleSave() {
    if (!form.customer_name.trim()) { setError('Customer name is required.'); return; }
    if (!form.payment_method) { setError('Payment method is required.'); return; }
    if (!form.payment_account_id) { setError('Payment account is required.'); return; }
    
    const validLines = lines.filter(l => l.description.trim() && Number(l.quantity) > 0 && Number(l.unit_price) > 0);
    if (!validLines.length) { setError('Add at least one valid line item with description, qty > 0, price > 0.'); return; }

    setSaving(true); setError('');
    const payload = {
      ...form,
      financial_year_id: form.financial_year_id ? Number(form.financial_year_id) : null,
      payment_account_id: form.payment_account_id ? Number(form.payment_account_id) : null,
      subtotal, tax_amount: taxAmount, total,
      items: validLines.map(l => ({ ...l, quantity: Number(l.quantity), unit_price: Number(l.unit_price), tax_pct: Number(l.tax_pct), line_total: Number(l.line_total) })),
    };

    try {
      if (isNew) {
        await api.post('/accounting/sales-invoices', payload);
        toastSuccess('Invoice created.');
      } else {
        await api.put(`/accounting/sales-invoices/${id}`, payload);
        toastSuccess('Invoice updated.');
      }
      navigate('/accounting/sales-invoices');
    } catch (err: unknown) {
      const data = (err as any)?.response?.data;
      setError(data?.message || 'Failed to save invoice.');
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkPaid() {
    if (!invoice || invoice.status === 'Paid') return;
    try {
      await api.post(`/accounting/sales-invoices/${id}/mark-paid`);
      toastSuccess('Invoice marked as paid.');
      setInvoice({ ...invoice, status: 'Paid' });
    } catch {
      toastError('Could not mark as paid.');
    }
  }

  if (loading) return <div style={{ padding: 20 }}>Loading…</div>;

  const readOnly = invoice?.status === 'Paid' || invoice?.status === 'Cancelled';

  return (
    <div className="fade-in-s" style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <button onClick={() => navigate('/accounting/sales-invoices')} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 13, padding: 0, marginBottom: 4 }}>← Back to Invoices</button>
          <div style={{ fontSize: 24, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 12 }}>
            {isNew ? 'New Sales Invoice' : invoice?.invoice_number}
            {!isNew && <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, background: 'var(--surface-2)', fontWeight: 600 }}>{invoice?.status}</span>}
          </div>
        </div>
        {!isNew && invoice?.status === 'Issued' && (
          <button className="sr-btn-primary" onClick={handleMarkPaid} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13 }}>Mark as Paid</button>
        )}
      </div>

      <div style={{ background: 'var(--card)', borderRadius: 12, boxShadow: 'var(--card-shadow)', padding: 24, marginBottom: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid var(--row-border)' }}>Basic Information</div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          <div>
            <label style={lbl}>Customer Name *</label>
            <input className="sr-input" style={{ ...inp, width: '100%' }} value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} disabled={readOnly} />
          </div>
          <div>
            <label style={lbl}>Customer Phone</label>
            <input className="sr-input" style={{ ...inp, width: '100%' }} value={form.customer_phone} onChange={e => setForm({ ...form, customer_phone: e.target.value })} disabled={readOnly} />
          </div>
          <div>
            <label style={lbl}>Financial Year</label>
            <select className="sr-input" style={{ ...inp, width: '100%' }} value={form.financial_year_id} onChange={e => setForm({ ...form, financial_year_id: e.target.value })} disabled={readOnly}>
              <option value="">— Select —</option>
              {years.map(y => <option key={y.id} value={y.id}>{y.year_name}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Invoice Date *</label>
            <input type="date" className="sr-input" style={{ ...inp, width: '100%' }} value={form.invoice_date} onChange={e => setForm({ ...form, invoice_date: e.target.value })} disabled={readOnly} />
          </div>
          <div>
            <label style={lbl}>Due Date</label>
            <input type="date" className="sr-input" style={{ ...inp, width: '100%' }} value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} disabled={readOnly} />
          </div>
          <div style={{ gridColumn: isMobile ? '1/-1' : 'span 3' }}>
            <label style={lbl}>Customer Address</label>
            <input className="sr-input" style={{ ...inp, width: '100%' }} value={form.customer_address} onChange={e => setForm({ ...form, customer_address: e.target.value })} disabled={readOnly} />
          </div>
        </div>

        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid var(--row-border)' }}>Payment Details</div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 16, marginBottom: 24, background: 'var(--surface-2)', padding: 16, borderRadius: 8 }}>
          <div>
            <label style={lbl}>Payment Method *</label>
            <select className="sr-input" style={{ ...inp, width: '100%' }} value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value as 'cash_in_hand'|'bank', payment_account_id: '' })} disabled={readOnly}>
              <option value="cash_in_hand">Cash in Hand</option>
              <option value="bank">Bank Transfer / Check</option>
            </select>
          </div>
          <div>
            <label style={lbl}>Deposit to Account *</label>
            <select className="sr-input" style={{ ...inp, width: '100%' }} value={form.payment_account_id} onChange={e => setForm({ ...form, payment_account_id: e.target.value })} disabled={readOnly}>
              <option value="">— Select Account —</option>
              {paymentAccounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
            </select>
          </div>
        </div>

        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid var(--row-border)' }}>Line Items</div>
        <div style={{ overflowX: 'auto', marginBottom: 16 }}>
          <table style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...tblHead, width: 40 }}>#</th>
                <th style={{ ...tblHead, textAlign: 'left' }}>Description *</th>
                <th style={{ ...tblHead, width: 80, textAlign: 'right' }}>Qty *</th>
                <th style={{ ...tblHead, width: 80 }}>UOM</th>
                <th style={{ ...tblHead, width: 120, textAlign: 'right' }}>Unit Price *</th>
                <th style={{ ...tblHead, width: 80, textAlign: 'right' }}>Tax %</th>
                <th style={{ ...tblHead, width: 120, textAlign: 'right' }}>Total</th>
                <th style={{ ...tblHead, width: 50 }}></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td style={{ ...tblCell, color: 'var(--muted)', fontSize: 12 }}>{i + 1}</td>
                  <td style={tblCell}><input className="sr-input" style={{ ...inp, width: '100%' }} value={l.description} onChange={e => updateLine(i, 'description', e.target.value)} disabled={readOnly} placeholder="Item description" /></td>
                  <td style={tblCell}><input className="sr-input" type="number" min="0.01" step="0.01" style={{ ...inp, width: '100%', textAlign: 'right' }} value={l.quantity} onChange={e => updateLine(i, 'quantity', e.target.value)} disabled={readOnly} /></td>
                  <td style={tblCell}><input className="sr-input" style={{ ...inp, width: '100%' }} value={l.uom} onChange={e => updateLine(i, 'uom', e.target.value)} disabled={readOnly} placeholder="pcs, kg..." /></td>
                  <td style={tblCell}><input className="sr-input" type="number" min="0" step="0.01" style={{ ...inp, width: '100%', textAlign: 'right' }} value={l.unit_price} onChange={e => updateLine(i, 'unit_price', e.target.value)} disabled={readOnly} /></td>
                  <td style={tblCell}><input className="sr-input" type="number" min="0" max="100" step="1" style={{ ...inp, width: '100%', textAlign: 'right' }} value={l.tax_pct} onChange={e => updateLine(i, 'tax_pct', e.target.value)} disabled={readOnly} /></td>
                  <td style={{ ...tblCell, textAlign: 'right', fontWeight: 600 }}>{Number(l.line_total || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}</td>
                  <td style={{ ...tblCell, textAlign: 'center' }}>
                    <button onClick={() => removeLine(i)} disabled={readOnly || lines.length === 1} style={{ background: 'none', border: 'none', color: readOnly || lines.length===1 ? 'var(--row-border)' : 'oklch(0.55 0.16 25)', cursor: readOnly || lines.length===1 ? 'not-allowed' : 'pointer', padding: 4 }}>
                      <TrashIcon />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!readOnly && (
          <button onClick={addLine} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--accent,#6366f1)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}>
            <PlusIcon /> Add Line
          </button>
        )}

        {error && <div style={{ color: 'oklch(0.55 0.16 25)', fontSize: 13, marginTop: 14 }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24, paddingTop: 20, borderTop: '2px solid var(--row-border)' }}>
          <div style={{ width: 300 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14 }}>
              <span style={{ color: 'var(--muted)' }}>Subtotal</span>
              <span>{subtotal.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14 }}>
              <span style={{ color: 'var(--muted)' }}>Tax Amount</span>
              <span>{taxAmount.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontSize: 18, fontWeight: 700, borderTop: '1px solid var(--row-border)', marginTop: 8 }}>
              <span>Total ({form.currency})</span>
              <span>{total.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginBottom: 40 }}>
        <button onClick={() => navigate('/accounting/sales-invoices')} style={{ padding: '10px 20px', borderRadius: 8, fontSize: 14, background: 'var(--card)', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }}>
          Cancel
        </button>
        {!readOnly && (
          <button onClick={handleSave} disabled={saving} className="sr-btn-primary" style={{ padding: '10px 24px', borderRadius: 8, fontSize: 14 }}>
            {saving ? 'Saving...' : 'Save Invoice'}
          </button>
        )}
      </div>
    </div>
  );
}
