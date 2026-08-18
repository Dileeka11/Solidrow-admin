import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { EditIcon, EyeIcon, PlusIcon, TrashIcon } from '../components/icons';
import { confirmDelete, toastError, toastSuccess } from '../lib/alerts';
import { useIsMobile } from '../lib/useMediaQuery';
import type { GrnRow, GrnStatus } from '../types';

const statusColor: Record<GrnStatus, { fg: string; bg: string }> = {
  Draft: { fg: 'oklch(0.45 0.02 250)', bg: 'oklch(0.94 0.01 250)' },
  Confirmed: { fg: 'oklch(0.45 0.13 150)', bg: 'oklch(0.95 0.05 150)' },
  'Partially Matched': { fg: 'oklch(0.5 0.13 300)', bg: 'oklch(0.95 0.05 305)' },
  'Fully Matched': { fg: 'oklch(0.45 0.13 250)', bg: 'oklch(0.94 0.05 255)' },
};

function StatusBadge({ status }: { status: GrnStatus }) {
  const c = statusColor[status];
  return <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 6, color: c.fg, background: c.bg, whiteSpace: 'nowrap' }}>{status}</span>;
}

const iconBtn = (color: string): React.CSSProperties => ({ background: 'none', border: 'none', cursor: 'pointer', color, padding: 4 });

export default function GoodsReceivedNotesPage() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [rows, setRows] = useState<GrnRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<GrnRow[]>('/accounting/grns');
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

  async function confirmGrn(id: number) {
    try {
      await api.post(`/accounting/grns/${id}/confirm`);
      toastSuccess('GRN confirmed');
      await load();
    } catch (err: unknown) {
      toastError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not confirm the GRN.');
    }
  }

  async function handleDelete(r: GrnRow) {
    const ok = await confirmDelete(`Delete GRN ${r.grn_number}?`);
    if (!ok) return;
    try {
      await api.delete(`/accounting/grns/${r.id}`);
      setRows((prev) => prev.filter((x) => x.id !== r.id));
      toastSuccess('GRN deleted');
    } catch (err: unknown) {
      toastError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not delete the GRN.');
    }
  }

  return (
    <div className="fade-in-s">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 2 }}>Goods Received Notes</div>
          <div style={{ fontSize: 14, color: 'var(--muted)' }}>{rows.length} GRNs</div>
        </div>
        <button className="sr-btn-primary" onClick={() => navigate('/accounting/grn/new')} style={{ padding: '10px 16px', borderRadius: 8, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <PlusIcon />
          New GRN
        </button>
      </div>

      <div style={{ background: 'var(--card)', borderRadius: 12, boxShadow: 'var(--card-shadow)', overflow: 'hidden' }}>
        {!isMobile && (
          <div style={{ display: 'grid', gridTemplateColumns: '150px 110px 140px 1fr 140px 130px', columnGap: 14, padding: '12px 20px', fontSize: 12, fontWeight: 700, color: 'var(--muted)', borderBottom: '1px solid var(--row-border)', textTransform: 'uppercase' }}>
            <div>GRN No.</div>
            <div>Date</div>
            <div>PO</div>
            <div>Supplier</div>
            <div>Status</div>
            <div style={{ textAlign: 'right' }}>Actions</div>
          </div>
        )}
        {loading && <div style={{ padding: '18px 20px', fontSize: 13, color: 'var(--muted)' }}>Loading…</div>}
        {!loading && rows.length === 0 && <div style={{ padding: '18px 20px', fontSize: 13, color: 'var(--muted)' }}>No GRNs yet — create one against a purchase order.</div>}
        {!loading && rows.map((r) => (
          <div key={r.id} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr auto' : '150px 110px 140px 1fr 140px 130px', columnGap: 14, rowGap: 4, padding: '13px 20px', fontSize: 14, alignItems: 'center', borderBottom: '1px solid var(--row-border)' }}>
            <div style={{ fontWeight: 600, fontFamily: 'monospace' }}>{r.grn_number}</div>
            {!isMobile && <div style={{ color: 'var(--muted)' }}>{r.grn_date}</div>}
            {!isMobile && <div style={{ fontFamily: 'monospace', fontSize: 13 }}>{r.po_number ?? '—'}</div>}
            {!isMobile && <div>{r.supplier_name ?? '—'}</div>}
            <div><StatusBadge status={r.status} /></div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
              {r.status === 'Draft' ? (
                <>
                  <button onClick={() => navigate(`/accounting/grn/${r.id}`)} title="Edit" style={iconBtn('var(--muted)')}><EditIcon /></button>
                  <button onClick={() => confirmGrn(r.id)} className="sr-btn-primary" style={{ padding: '5px 10px', borderRadius: 6, fontSize: 12 }}>Confirm</button>
                  <button onClick={() => handleDelete(r)} title="Delete" style={iconBtn('oklch(0.55 0.16 25)')}><TrashIcon /></button>
                </>
              ) : (
                <button onClick={() => navigate(`/accounting/grn/${r.id}`)} title="View" style={iconBtn('var(--muted)')}><EyeIcon /></button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
