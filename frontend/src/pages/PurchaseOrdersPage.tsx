import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { EditIcon, EyeIcon, PlusIcon, TrashIcon } from '../components/icons';
import { confirmDelete, toastError, toastSuccess } from '../lib/alerts';
import { useIsMobile } from '../lib/useMediaQuery';
import type { PoStatus, PurchaseOrderRow } from '../types';

function money(n: number | string): string {
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const statusColor: Record<PoStatus, { fg: string; bg: string }> = {
  Draft: { fg: 'oklch(0.45 0.02 250)', bg: 'oklch(0.94 0.01 250)' },
  'Pending Approval': { fg: 'oklch(0.5 0.14 70)', bg: 'oklch(0.95 0.06 80)' },
  Approved: { fg: 'oklch(0.45 0.13 150)', bg: 'oklch(0.95 0.05 150)' },
  'Sent to Supplier': { fg: 'oklch(0.45 0.13 250)', bg: 'oklch(0.94 0.05 255)' },
  'Partially Received': { fg: 'oklch(0.5 0.13 300)', bg: 'oklch(0.95 0.05 305)' },
  'Fully Received': { fg: 'oklch(0.45 0.13 150)', bg: 'oklch(0.95 0.05 150)' },
  Closed: { fg: 'oklch(0.4 0.02 250)', bg: 'oklch(0.92 0.01 250)' },
  Cancelled: { fg: 'oklch(0.5 0.16 25)', bg: 'oklch(0.95 0.05 25)' },
};

function StatusBadge({ status }: { status: PoStatus }) {
  const c = statusColor[status];
  return <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 6, color: c.fg, background: c.bg, whiteSpace: 'nowrap' }}>{status}</span>;
}

const iconBtn = (color: string): React.CSSProperties => ({ background: 'none', border: 'none', cursor: 'pointer', color, padding: 4 });
const smallBtn = (fg: string, bg: string): React.CSSProperties => ({ padding: '5px 10px', borderRadius: 6, fontSize: 12, background: bg, color: fg, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 });

export default function PurchaseOrdersPage() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [rows, setRows] = useState<PurchaseOrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<PurchaseOrderRow[]>('/accounting/purchase-orders');
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
      await api.post(`/accounting/purchase-orders/${id}/${action}`);
      toastSuccess(`PO ${label}`);
      await load();
    } catch (err: unknown) {
      toastError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? `Could not ${action} the PO.`);
    }
  }

  async function handleDelete(r: PurchaseOrderRow) {
    const ok = await confirmDelete(`Delete purchase order ${r.po_number}?`);
    if (!ok) return;
    try {
      await api.delete(`/accounting/purchase-orders/${r.id}`);
      setRows((prev) => prev.filter((x) => x.id !== r.id));
      toastSuccess('PO deleted');
    } catch (err: unknown) {
      toastError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not delete the PO.');
    }
  }

  return (
    <div className="fade-in-s">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 2 }}>Purchase Orders</div>
          <div style={{ fontSize: 14, color: 'var(--muted)' }}>{rows.length} orders</div>
        </div>
        <button className="sr-btn-primary" onClick={() => navigate('/accounting/po/new')} style={{ padding: '10px 16px', borderRadius: 8, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <PlusIcon />
          New PO
        </button>
      </div>

      <div style={{ background: 'var(--card)', borderRadius: 12, boxShadow: 'var(--card-shadow)', overflow: 'hidden' }}>
        {!isMobile && (
          <div style={{ display: 'grid', gridTemplateColumns: '150px 110px 1fr 150px 120px 150px', columnGap: 14, padding: '12px 20px', fontSize: 12, fontWeight: 700, color: 'var(--muted)', borderBottom: '1px solid var(--row-border)', textTransform: 'uppercase' }}>
            <div>PO No.</div>
            <div>Date</div>
            <div>Supplier</div>
            <div>Status</div>
            <div style={{ textAlign: 'right' }}>Total</div>
            <div style={{ textAlign: 'right' }}>Actions</div>
          </div>
        )}
        {loading && <div style={{ padding: '18px 20px', fontSize: 13, color: 'var(--muted)' }}>Loading…</div>}
        {!loading && rows.length === 0 && <div style={{ padding: '18px 20px', fontSize: 13, color: 'var(--muted)' }}>No purchase orders yet — create one.</div>}
        {!loading && rows.map((r) => (
          <div key={r.id} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr auto' : '150px 110px 1fr 150px 120px 150px', columnGap: 14, rowGap: 4, padding: '13px 20px', fontSize: 14, alignItems: 'center', borderBottom: '1px solid var(--row-border)' }}>
            <div style={{ fontWeight: 600, fontFamily: 'monospace' }}>{r.po_number}</div>
            {!isMobile && <div style={{ color: 'var(--muted)' }}>{r.po_date}</div>}
            {!isMobile && <div>{r.supplier_name ?? '—'}</div>}
            <div><StatusBadge status={r.status} /></div>
            {!isMobile && <div style={{ textAlign: 'right', fontFamily: 'monospace' }}>{money(r.total)}</div>}
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
              {r.status === 'Draft' && (
                <>
                  <button onClick={() => navigate(`/accounting/po/${r.id}`)} title="Edit" style={iconBtn('var(--muted)')}><EditIcon /></button>
                  <button onClick={() => act(r.id, 'submit', 'submitted')} className="sr-btn-primary" style={{ padding: '5px 10px', borderRadius: 6, fontSize: 12 }}>Submit</button>
                  <button onClick={() => handleDelete(r)} title="Delete" style={iconBtn('oklch(0.55 0.16 25)')}><TrashIcon /></button>
                </>
              )}
              {r.status === 'Pending Approval' && (
                <>
                  <button onClick={() => navigate(`/accounting/po/${r.id}`)} title="View" style={iconBtn('var(--muted)')}><EyeIcon /></button>
                  <button onClick={() => act(r.id, 'approve', 'approved')} className="sr-btn-primary" style={{ padding: '5px 10px', borderRadius: 6, fontSize: 12 }}>Approve</button>
                  <button onClick={() => act(r.id, 'reject', 'sent back')} style={smallBtn('oklch(0.5 0.16 25)', 'oklch(0.95 0.05 25)')}>Reject</button>
                </>
              )}
              {r.status === 'Approved' && (
                <>
                  <button onClick={() => navigate(`/accounting/po/${r.id}`)} title="View" style={iconBtn('var(--muted)')}><EyeIcon /></button>
                  <button onClick={() => act(r.id, 'send', 'sent to supplier')} className="sr-btn-primary" style={{ padding: '5px 10px', borderRadius: 6, fontSize: 12 }}>Send</button>
                  <button onClick={() => act(r.id, 'cancel', 'cancelled')} style={smallBtn('oklch(0.5 0.16 25)', 'oklch(0.95 0.05 25)')}>Cancel</button>
                </>
              )}
              {['Sent to Supplier', 'Partially Received', 'Fully Received', 'Closed', 'Cancelled'].includes(r.status) && (
                <button onClick={() => navigate(`/accounting/po/${r.id}`)} title="View" style={iconBtn('var(--muted)')}><EyeIcon /></button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
