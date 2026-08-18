import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import AccountModal from '../components/accounting/AccountModal';
import { EditIcon, PlusIcon, TrashIcon } from '../components/icons';
import { confirmDelete, toastError, toastSuccess } from '../lib/alerts';
import { useIsMobile } from '../lib/useMediaQuery';
import type { AccountRow, ChartCategory } from '../types';

const inputStyle: React.CSSProperties = { padding: '9px 12px', borderRadius: 7, fontSize: 14 };

export default function ChartOfAccountsPage() {
  const isMobile = useIsMobile();
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [chart, setChart] = useState<ChartCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AccountRow | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [accRes, chartRes] = await Promise.all([
        api.get<AccountRow[]>('/accounting/accounts'),
        api.get<ChartCategory[]>('/accounting/chart'),
      ]);
      setAccounts(accRes.data);
      setChart(chartRes.data);
    } catch {
      setAccounts([]);
      setChart([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const categoryNames = useMemo(
    () => Array.from(new Set(accounts.map((a) => a.category_name))).sort(),
    [accounts],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accounts.filter((a) => {
      if (q && !(a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q))) return false;
      if (categoryFilter && a.category_name !== categoryFilter) return false;
      if (typeFilter && a.type !== typeFilter) return false;
      if (statusFilter === 'active' && !a.is_active) return false;
      if (statusFilter === 'inactive' && a.is_active) return false;
      return true;
    });
  }, [accounts, search, categoryFilter, typeFilter, statusFilter]);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(a: AccountRow) {
    setEditing(a);
    setModalOpen(true);
  }

  async function handleSave(data: { group_id: number; name: string; code: string; is_active: boolean }) {
    if (editing) {
      await api.put(`/accounting/accounts/${editing.id}`, data);
      toastSuccess('Account updated');
    } else {
      // Send code only if the user typed one (blank => backend auto-generates).
      const payload: Record<string, unknown> = { group_id: data.group_id, name: data.name, is_active: data.is_active };
      if (data.code) payload.code = data.code;
      await api.post('/accounting/accounts', payload);
      toastSuccess('Account added');
    }
    setModalOpen(false);
    await load();
  }

  async function handleDelete(a: AccountRow) {
    const ok = await confirmDelete(`Delete account "${a.code} · ${a.name}"?`);
    if (!ok) return;
    try {
      await api.delete(`/accounting/accounts/${a.id}`);
      setAccounts((prev) => prev.filter((row) => row.id !== a.id));
      toastSuccess('Account deleted');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Could not delete the account.';
      toastError(msg);
    }
  }

  return (
    <div className="fade-in-s">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 2 }}>Chart of Accounts</div>
          <div style={{ fontSize: 14, color: 'var(--muted)' }}>
            {accounts.length} ledger accounts across {chart.length} categories
          </div>
        </div>
        <button
          className="sr-btn-primary"
          onClick={openCreate}
          style={{ padding: '10px 16px', borderRadius: 8, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <PlusIcon />
          New Account
        </button>
      </div>

      {/* Filters */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 180px 160px 160px',
          gap: 10,
          marginBottom: 16,
        }}
      >
        <input
          className="sr-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by code or name…"
          style={inputStyle}
        />
        <select className="sr-input" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={inputStyle}>
          <option value="">All categories</option>
          {categoryNames.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select className="sr-input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={inputStyle}>
          <option value="">All statements</option>
          <option value="BS">Balance Sheet</option>
          <option value="PNL">Profit &amp; Loss</option>
        </select>
        <select className="sr-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={inputStyle}>
          <option value="">All status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--card)', borderRadius: 12, boxShadow: 'var(--card-shadow)', overflow: 'hidden' }}>
        {!isMobile && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '110px 1fr 160px 130px 90px 90px 80px',
              columnGap: 16,
              padding: '12px 20px',
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--muted)',
              borderBottom: '1px solid var(--row-border)',
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
            }}
          >
            <div>Code</div>
            <div>Account</div>
            <div>Group</div>
            <div>Category</div>
            <div>Type</div>
            <div>Status</div>
            <div style={{ textAlign: 'right' }}>Actions</div>
          </div>
        )}

        {loading && <div style={{ padding: '18px 20px', fontSize: 13, color: 'var(--muted)' }}>Loading…</div>}
        {!loading && filtered.length === 0 && (
          <div style={{ padding: '18px 20px', fontSize: 13, color: 'var(--muted)' }}>No accounts match your filters.</div>
        )}

        {!loading &&
          filtered.map((a) => (
            <div
              key={a.id}
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr auto' : '110px 1fr 160px 130px 90px 90px 80px',
                columnGap: 16,
                rowGap: 4,
                padding: '13px 20px',
                fontSize: 14,
                alignItems: 'center',
                borderBottom: '1px solid var(--row-border)',
              }}
            >
              <div style={{ fontWeight: 600, fontFamily: 'monospace' }}>
                {a.code}
                {a.is_default && (
                  <span
                    title="System default account"
                    style={{ marginLeft: 6, fontSize: 10, color: 'var(--accent,#6366f1)', fontWeight: 700 }}
                  >
                    ★
                  </span>
                )}
              </div>
              <div style={{ fontWeight: 500 }}>{a.name}</div>
              {!isMobile && <div style={{ color: 'var(--muted)' }}>{a.group_name}</div>}
              {!isMobile && <div style={{ color: 'var(--muted)' }}>{a.category_name}</div>}
              {!isMobile && (
                <div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>{a.type}</span>
                </div>
              )}
              {!isMobile && (
                <div>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 6,
                      color: a.is_active ? 'oklch(0.45 0.13 150)' : 'oklch(0.55 0.02 250)',
                      background: a.is_active ? 'oklch(0.95 0.05 150)' : 'oklch(0.94 0.01 250)',
                    }}
                  >
                    {a.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => openEdit(a)} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}>
                  <EditIcon />
                </button>
                <button onClick={() => handleDelete(a)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'oklch(0.55 0.16 25)', padding: 4 }}>
                  <TrashIcon />
                </button>
              </div>
            </div>
          ))}
      </div>

      <AccountModal
        open={modalOpen}
        editing={editing}
        chart={chart}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
