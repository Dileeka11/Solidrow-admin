import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { PlusIcon, EyeIcon, TrashIcon } from '../components/icons';
import { confirmDelete, toastError, toastSuccess } from '../lib/alerts';
import { useIsMobile } from '../lib/useMediaQuery';
import type { FinancialYear, SalesInvoiceRow, SalesInvoiceStatus } from '../types';

const STATUS_COLORS: Record<SalesInvoiceStatus, { bg: string; color: string }> = {
  Draft:     { bg: 'oklch(0.94 0.01 250)', color: 'oklch(0.55 0.02 250)' },
  Issued:    { bg: 'oklch(0.93 0.08 240)', color: 'oklch(0.38 0.14 240)' },
  Paid:      { bg: 'oklch(0.93 0.07 150)', color: 'oklch(0.38 0.13 150)' },
  Cancelled: { bg: 'oklch(0.94 0.06 30)',  color: 'oklch(0.55 0.15 30)'  },
};

const inp: React.CSSProperties = { padding: '9px 12px', borderRadius: 7, fontSize: 14 };

export default function SalesInvoicesPage() {
  const isMobile = useIsMobile();
  const [rows, setRows] = useState<SalesInvoiceRow[]>([]);
  const [years, setYears] = useState<FinancialYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [invRes, fyRes] = await Promise.all([
        api.get<SalesInvoiceRow[]>('/accounting/sales-invoices'),
        api.get<FinancialYear[]>('/accounting/financial-years'),
      ]);
      setRows(invRes.data);
      setYears(fyRes.data);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(row: SalesInvoiceRow) {
    if (row.status === 'Paid') { toastError('Cannot delete a paid invoice.'); return; }
    const ok = await confirmDelete(`Delete invoice "${row.invoice_number}"?`);
    if (!ok) return;
    try {
      await api.delete(`/accounting/sales-invoices/${row.id}`);
      toastSuccess('Invoice deleted.');
      await load();
    } catch { toastError('Could not delete.'); }
  }

  const q = search.trim().toLowerCase();
  const filtered = rows.filter((r) => {
    if (yearFilter && String(r.financial_year_id) !== yearFilter) return false;
    if (statusFilter && r.status !== statusFilter) return false;
    if (q && !(r.invoice_number.toLowerCase().includes(q) || r.customer_name.toLowerCase().includes(q))) return false;
    return true;
  });

  const totalAmount = filtered.reduce((s, r) => s + r.total, 0);
  const gridCols = isMobile ? '1fr auto' : '150px 1fr 120px 120px 120px 110px 80px';

  return (
    <div className="fade-in-s">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 2 }}>Sales Invoices</div>
          <div style={{ fontSize: 14, color: 'var(--muted)' }}>
            {filtered.length} invoice{filtered.length !== 1 ? 's' : ''} &nbsp;·&nbsp;
            Total: <strong>LKR {totalAmount.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</strong>
          </div>
        </div>
        <Link
          id="btn-new-sales-invoice"
          to="/accounting/sales-invoices/new"
          className="sr-btn-primary"
          style={{ padding: '10px 16px', borderRadius: 8, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}
        >
          <PlusIcon /> New Invoice
        </Link>
      </div>

      {/* Filters */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 180px 160px', gap: 10, marginBottom: 16 }}>
        <input className="sr-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoice no. or customer…" style={inp} />
        <select className="sr-input" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} style={inp}>
          <option value="">All years</option>
          {years.map((y) => <option key={y.id} value={y.id}>{y.year_name}</option>)}
        </select>
        <select className="sr-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={inp}>
          <option value="">All status</option>
          {(['Draft', 'Issued', 'Paid', 'Cancelled'] as SalesInvoiceStatus[]).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--card)', borderRadius: 12, boxShadow: 'var(--card-shadow)', overflow: 'hidden' }}>
        {!isMobile && (
          <div style={{ display: 'grid', gridTemplateColumns: gridCols, columnGap: 14, padding: '12px 20px', fontSize: 12, fontWeight: 700, color: 'var(--muted)', borderBottom: '1px solid var(--row-border)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            <div>Invoice No.</div><div>Customer</div><div>Date</div><div>Due Date</div><div>Amount (LKR)</div><div>Status</div><div style={{ textAlign: 'right' }}>Actions</div>
          </div>
        )}
        {loading && <div style={{ padding: '18px 20px', fontSize: 13, color: 'var(--muted)' }}>Loading…</div>}
        {!loading && filtered.length === 0 && <div style={{ padding: '18px 20px', fontSize: 13, color: 'var(--muted)' }}>No invoices found.</div>}
        {!loading && filtered.map((row) => {
          const sc = STATUS_COLORS[row.status];
          return (
            <div key={row.id} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr auto' : gridCols, columnGap: 14, padding: '13px 20px', fontSize: 14, alignItems: 'center', borderBottom: '1px solid var(--row-border)' }}>
              <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: 'var(--accent,#6366f1)' }}>{row.invoice_number}</div>
              <div style={{ fontWeight: 500 }}>{row.customer_name}</div>
              {!isMobile && <div style={{ color: 'var(--muted)' }}>{row.invoice_date}</div>}
              {!isMobile && <div style={{ color: 'var(--muted)' }}>{row.due_date ?? '—'}</div>}
              {!isMobile && <div style={{ fontWeight: 600, textAlign: 'right', paddingRight: 8 }}>{Number(row.total).toLocaleString('en-LK', { minimumFractionDigits: 2 })}</div>}
              {!isMobile && (
                <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: sc.bg, color: sc.color, display: 'inline-block' }}>
                  {row.status}
                </span>
              )}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <Link id={`btn-view-si-${row.id}`} to={`/accounting/sales-invoices/${row.id}`} title="View / Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, display: 'flex' }}>
                  <EyeIcon />
                </Link>
                <button id={`btn-del-si-${row.id}`} onClick={() => handleDelete(row)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'oklch(0.55 0.16 25)', padding: 4 }}>
                  <TrashIcon />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
