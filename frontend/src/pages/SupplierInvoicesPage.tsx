import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { EditIcon, EyeIcon, PlusIcon, TrashIcon } from '../components/icons';
import { confirmDelete, toastError, toastSuccess } from '../lib/alerts';
import { useIsMobile } from '../lib/useMediaQuery';
import type { InvoiceStatus, SupplierInvoiceRow } from '../types';

function money(n: number | string): string {
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const statusColor: Record<InvoiceStatus, { fg: string; bg: string }> = {
  Draft: { fg: 'oklch(0.45 0.02 250)', bg: 'oklch(0.94 0.01 250)' },
  'Pending Matching': { fg: 'oklch(0.5 0.14 70)', bg: 'oklch(0.95 0.06 80)' },
  Matched: { fg: 'oklch(0.45 0.13 150)', bg: 'oklch(0.95 0.05 150)' },
  Disputed: { fg: 'oklch(0.5 0.16 25)', bg: 'oklch(0.95 0.05 25)' },
  'Approved for Payment': { fg: 'oklch(0.45 0.13 250)', bg: 'oklch(0.94 0.05 255)' },
  Paid: { fg: 'oklch(0.98 0 0)', bg: 'oklch(0.5 0.13 150)' },
};

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const c = statusColor[status];
  return <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 6, color: c.fg, background: c.bg, whiteSpace: 'nowrap' }}>{status}</span>;
}

const iconBtn = (color: string): React.CSSProperties => ({ background: 'none', border: 'none', cursor: 'pointer', color, padding: 4 });
const smallBtn = (fg: string, bg: string): React.CSSProperties => ({ padding: '5px 10px', borderRadius: 6, fontSize: 12, background: bg, color: fg, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 });

export default function SupplierInvoicesPage() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [rows, setRows] = useState<SupplierInvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<SupplierInvoiceRow[]>('/accounting/supplier-invoices');
      setRows(res.data);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function act(id: number, action: string, label: string) {
    try {
      await api.post(`/accounting/supplier-invoices/${id}/${action}`);
      toastSuccess(`Invoice ${label}`);
      await load();
    } catch (err: unknown) {
      toastError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? `Could not ${action} the invoice.`);
    }
  }

  async function handleDelete(r: SupplierInvoiceRow) {
    const ok = await confirmDelete(`Delete invoice ${r.internal_ref_no}?`);
    if (!ok) return;
    try {
      await api.delete(`/accounting/supplier-invoices/${r.id}`);
      setRows((prev) => prev.filter((x) => x.id !== r.id));
      toastSuccess('Invoice deleted');
    } catch (err: unknown) {
      toastError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not delete the invoice.');
    }
  }

  return (
    <div className="fade-in-s">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 2 }}>Supplier Payments</div>
          <div style={{ fontSize: 14, color: 'var(--muted)' }}>{rows.length} invoices</div>
        </div>
        <button className="sr-btn-primary" onClick={() => navigate('/accounting/payment/new')} style={{ padding: '10px 16px', borderRadius: 8, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <PlusIcon />
          New Invoice
        </button>
      </div>

      <div style={{ background: 'var(--card)', borderRadius: 12, boxShadow: 'var(--card-shadow)', overflow: 'hidden' }}>
        {!isMobile && (
          <div style={{ display: 'grid', gridTemplateColumns: '150px 110px 130px 1fr 160px 110px 170px', columnGap: 12, padding: '12px 20px', fontSize: 12, fontWeight: 700, color: 'var(--muted)', borderBottom: '1px solid var(--row-border)', textTransform: 'uppercase' }}>
            <div>Ref No.</div>
            <div>Date</div>
            <div>PO</div>
            <div>Supplier</div>
            <div>Status</div>
            <div style={{ textAlign: 'right' }}>Total</div>
            <div style={{ textAlign: 'right' }}>Actions</div>
          </div>
        )}
        {loading && <div style={{ padding: '18px 20px', fontSize: 13, color: 'var(--muted)' }}>Loading…</div>}
        {!loading && rows.length === 0 && <div style={{ padding: '18px 20px', fontSize: 13, color: 'var(--muted)' }}>No supplier invoices yet.</div>}
        {!loading && rows.map((r) => (
          <div key={r.id} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr auto' : '150px 110px 130px 1fr 160px 110px 170px', columnGap: 12, rowGap: 4, padding: '13px 20px', fontSize: 14, alignItems: 'center', borderBottom: '1px solid var(--row-border)' }}>
            <div style={{ fontWeight: 600, fontFamily: 'monospace' }}>{r.internal_ref_no}</div>
            {!isMobile && <div style={{ color: 'var(--muted)' }}>{r.invoice_date}</div>}
            {!isMobile && <div style={{ fontFamily: 'monospace', fontSize: 13 }}>{r.po_number ?? '—'}</div>}
            {!isMobile && <div>{r.supplier_name ?? '—'}</div>}
            <div><StatusBadge status={r.status} /></div>
            {!isMobile && <div style={{ textAlign: 'right', fontFamily: 'monospace' }}>{money(r.total)}</div>}
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
              {r.status === 'Draft' && (
                <>
                  <button onClick={() => navigate(`/accounting/payment/${r.id}`)} title="Edit" style={iconBtn('var(--muted)')}><EditIcon /></button>
                  <button onClick={() => act(r.id, 'submit', 'submitted')} className="sr-btn-primary" style={{ padding: '5px 10px', borderRadius: 6, fontSize: 12 }}>Submit</button>
                  <button onClick={() => handleDelete(r)} title="Delete" style={iconBtn('oklch(0.55 0.16 25)')}><TrashIcon /></button>
                </>
              )}
              {(r.status === 'Pending Matching' || r.status === 'Disputed') && (
                <>
                  <button onClick={() => navigate(`/accounting/payment/${r.id}`)} title="Matching" style={iconBtn('var(--muted)')}><EyeIcon /></button>
                  <button onClick={() => act(r.id, 'match', 'matched')} className="sr-btn-primary" style={{ padding: '5px 10px', borderRadius: 6, fontSize: 12 }}>Run Match</button>
                </>
              )}
              {r.status === 'Matched' && (
                <>
                  <button onClick={() => navigate(`/accounting/payment/${r.id}`)} title="Matching" style={iconBtn('var(--muted)')}><EyeIcon /></button>
                  <button onClick={() => act(r.id, 'approve', 'approved')} className="sr-btn-primary" style={{ padding: '5px 10px', borderRadius: 6, fontSize: 12 }}>Approve</button>
                  <button onClick={() => act(r.id, 'dispute', 'disputed')} style={smallBtn('oklch(0.5 0.16 25)', 'oklch(0.95 0.05 25)')}>Dispute</button>
                </>
              )}
              {r.status === 'Approved for Payment' && (
                <>
                  <button onClick={() => navigate(`/accounting/payment/${r.id}`)} title="View" style={iconBtn('var(--muted)')}><EyeIcon /></button>
                  <button onClick={() => act(r.id, 'pay', 'marked paid')} className="sr-btn-primary" style={{ padding: '5px 10px', borderRadius: 6, fontSize: 12 }}>Mark Paid</button>
                </>
              )}
              {r.status === 'Paid' && (
                <button onClick={() => navigate(`/accounting/payment/${r.id}`)} title="View" style={iconBtn('var(--muted)')}><EyeIcon /></button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
