import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { EditIcon, EyeIcon, PlusIcon, TrashIcon } from '../components/icons';
import { confirmDelete, toastError, toastSuccess } from '../lib/alerts';
import { useIsMobile } from '../lib/useMediaQuery';
import type { PrStatus, PurchaseRequisitionRow } from '../types';

function money(n: number | string): string {
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const statusColor: Record<PrStatus, { fg: string; bg: string }> = {
  Draft: { fg: 'oklch(0.45 0.02 250)', bg: 'oklch(0.94 0.01 250)' },
  'Pending Approval': { fg: 'oklch(0.5 0.14 70)', bg: 'oklch(0.95 0.06 80)' },
  Approved: { fg: 'oklch(0.45 0.13 150)', bg: 'oklch(0.95 0.05 150)' },
  Rejected: { fg: 'oklch(0.5 0.16 25)', bg: 'oklch(0.95 0.05 25)' },
  'Converted to PO': { fg: 'oklch(0.45 0.13 250)', bg: 'oklch(0.94 0.05 255)' },
};

function StatusBadge({ status }: { status: PrStatus }) {
  const c = statusColor[status];
  return <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 6, color: c.fg, background: c.bg, whiteSpace: 'nowrap' }}>{status}</span>;
}

export default function PurchaseRequisitionsPage() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [rows, setRows] = useState<PurchaseRequisitionRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<PurchaseRequisitionRow[]>('/accounting/purchase-requisitions');
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

  async function act(id: number, action: 'submit' | 'approve' | 'reject', label: string) {
    try {
      await api.post(`/accounting/purchase-requisitions/${id}/${action}`);
      toastSuccess(`Requisition ${label}`);
      await load();
    } catch (err: unknown) {
      toastError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? `Could not ${action} the requisition.`);
    }
  }

  async function handleDelete(r: PurchaseRequisitionRow) {
    const ok = await confirmDelete(`Delete requisition ${r.pr_number}?`);
    if (!ok) return;
    try {
      await api.delete(`/accounting/purchase-requisitions/${r.id}`);
      setRows((prev) => prev.filter((x) => x.id !== r.id));
      toastSuccess('Requisition deleted');
    } catch (err: unknown) {
      toastError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not delete the requisition.');
    }
  }

  return (
    <div className="fade-in-s">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 2 }}>Purchase Requisitions</div>
          <div style={{ fontSize: 14, color: 'var(--muted)' }}>{rows.length} requisitions</div>
        </div>
        <button className="sr-btn-primary" onClick={() => navigate('/accounting/pr/new')} style={{ padding: '10px 16px', borderRadius: 8, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <PlusIcon />
          New PR
        </button>
      </div>

      <div style={{ background: 'var(--card)', borderRadius: 12, boxShadow: 'var(--card-shadow)', overflow: 'hidden' }}>
        {!isMobile && (
          <div style={{ display: 'grid', gridTemplateColumns: '140px 110px 1fr 90px 130px 120px 130px', columnGap: 14, padding: '12px 20px', fontSize: 12, fontWeight: 700, color: 'var(--muted)', borderBottom: '1px solid var(--row-border)', textTransform: 'uppercase' }}>
            <div>PR No.</div>
            <div>Date</div>
            <div>Department</div>
            <div>Priority</div>
            <div>Status</div>
            <div style={{ textAlign: 'right' }}>Est. Total</div>
            <div style={{ textAlign: 'right' }}>Actions</div>
          </div>
        )}
        {loading && <div style={{ padding: '18px 20px', fontSize: 13, color: 'var(--muted)' }}>Loading…</div>}
        {!loading && rows.length === 0 && <div style={{ padding: '18px 20px', fontSize: 13, color: 'var(--muted)' }}>No requisitions yet — create one.</div>}
        {!loading && rows.map((r) => (
          <div key={r.id} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr auto' : '140px 110px 1fr 90px 130px 120px 130px', columnGap: 14, rowGap: 4, padding: '13px 20px', fontSize: 14, alignItems: 'center', borderBottom: '1px solid var(--row-border)' }}>
            <div style={{ fontWeight: 600, fontFamily: 'monospace' }}>{r.pr_number}</div>
            {!isMobile && <div style={{ color: 'var(--muted)' }}>{r.pr_date}</div>}
            {!isMobile && <div>{r.department_name ?? '—'}</div>}
            {!isMobile && <div style={{ fontSize: 13, color: r.priority === 'Critical' ? 'oklch(0.55 0.16 25)' : r.priority === 'Urgent' ? 'oklch(0.55 0.14 60)' : 'var(--muted)', fontWeight: r.priority === 'Normal' ? 400 : 600 }}>{r.priority}</div>}
            <div><StatusBadge status={r.status} /></div>
            {!isMobile && <div style={{ textAlign: 'right', fontFamily: 'monospace' }}>{money(r.total_estimated)}</div>}
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
              {r.status === 'Draft' && (
                <>
                  <button onClick={() => navigate(`/accounting/pr/${r.id}`)} title="Edit" style={iconBtn('var(--muted)')}><EditIcon /></button>
                  <button onClick={() => act(r.id, 'submit', 'submitted')} className="sr-btn-primary" style={{ padding: '5px 10px', borderRadius: 6, fontSize: 12 }}>Submit</button>
                  <button onClick={() => handleDelete(r)} title="Delete" style={iconBtn('oklch(0.55 0.16 25)')}><TrashIcon /></button>
                </>
              )}
              {r.status === 'Pending Approval' && (
                <>
                  <button onClick={() => navigate(`/accounting/pr/${r.id}`)} title="View" style={iconBtn('var(--muted)')}><EyeIcon /></button>
                  <button onClick={() => act(r.id, 'approve', 'approved')} className="sr-btn-primary" style={{ padding: '5px 10px', borderRadius: 6, fontSize: 12 }}>Approve</button>
                  <button onClick={() => act(r.id, 'reject', 'rejected')} style={{ padding: '5px 10px', borderRadius: 6, fontSize: 12, background: 'oklch(0.95 0.05 25)', color: 'oklch(0.5 0.16 25)', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Reject</button>
                </>
              )}
              {(r.status === 'Approved' || r.status === 'Converted to PO') && (
                <button onClick={() => navigate(`/accounting/pr/${r.id}`)} title="View" style={iconBtn('var(--muted)')}><EyeIcon /></button>
              )}
              {r.status === 'Rejected' && (
                <>
                  <button onClick={() => navigate(`/accounting/pr/${r.id}`)} title="View" style={iconBtn('var(--muted)')}><EyeIcon /></button>
                  <button onClick={() => handleDelete(r)} title="Delete" style={iconBtn('oklch(0.55 0.16 25)')}><TrashIcon /></button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function iconBtn(color: string): React.CSSProperties {
  return { background: 'none', border: 'none', cursor: 'pointer', color, padding: 4 };
}
