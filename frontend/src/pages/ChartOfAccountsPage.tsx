import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import AccountModal, { type AccountSaveData } from '../components/accounting/AccountModal';
import { EditIcon, PlusIcon, TrashIcon } from '../components/icons';
import { confirmDelete, toastError, toastSuccess } from '../lib/alerts';
import { useIsMobile } from '../lib/useMediaQuery';
import type { AccountRow, ChartCategory } from '../types';

const inputStyle: React.CSSProperties = { padding: '9px 12px', borderRadius: 7, fontSize: 14 };

/** A chart row plus its nested children (built from the flat parent_id list). */
interface TreeNode extends AccountRow {
  children: TreeNode[];
}

function buildTree(rows: AccountRow[]): TreeNode[] {
  const byId = new Map<number, TreeNode>();
  rows.forEach((r) => byId.set(r.id, { ...r, children: [] }));
  const roots: TreeNode[] = [];
  byId.forEach((node) => {
    if (node.parent_id && byId.has(node.parent_id)) byId.get(node.parent_id)!.children.push(node);
    else roots.push(node);
  });
  const sortByCode = (a: TreeNode, b: TreeNode) => a.code.localeCompare(b.code, undefined, { numeric: true });
  const sortRec = (nodes: TreeNode[]) => {
    nodes.sort(sortByCode);
    nodes.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

export default function ChartOfAccountsPage() {
  const isMobile = useIsMobile();
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [chart, setChart] = useState<ChartCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AccountRow | null>(null);
  const [parentFor, setParentFor] = useState<AccountRow | null>(null);

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

  const filtersActive = Boolean(search.trim() || categoryFilter || typeFilter || statusFilter);

  // Flat, filtered list — used only when a search/filter is active (so matches
  // aren't hidden behind a collapsed branch).
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

  const tree = useMemo(() => buildTree(accounts), [accounts]);

  // Flatten the tree into render rows, honouring collapsed branches.
  const treeRows = useMemo(() => {
    const out: { node: TreeNode; depth: number }[] = [];
    const walk = (nodes: TreeNode[], depth: number) => {
      nodes.forEach((node) => {
        out.push({ node, depth });
        if (node.children.length && !collapsed.has(node.id)) walk(node.children, depth + 1);
      });
    };
    walk(tree, 0);
    return out;
  }, [tree, collapsed]);

  function toggleCollapse(id: number) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openCreate() {
    setEditing(null);
    setParentFor(null);
    setModalOpen(true);
  }

  function openAddChild(row: AccountRow) {
    setEditing(null);
    setParentFor(row);
    setModalOpen(true);
  }

  function openEdit(a: AccountRow) {
    setEditing(a);
    setParentFor(null);
    setModalOpen(true);
  }

  async function handleSave(data: AccountSaveData) {
    if (editing) {
      await api.put(`/accounting/accounts/${editing.id}`, { name: data.name, is_active: data.is_active });
      toastSuccess('Account updated');
    } else {
      await api.post('/accounting/accounts', data);
      toastSuccess(data.parent_id ? 'Sub-account added' : 'Account added');
    }
    setModalOpen(false);
    await load();
  }

  async function handleDelete(a: AccountRow) {
    const ok = await confirmDelete(`Delete account "${a.code} · ${a.name}"?`);
    if (!ok) return;
    try {
      await api.delete(`/accounting/accounts/${a.id}`);
      toastSuccess('Account deleted');
      await load();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Could not delete the account.';
      toastError(msg);
    }
  }

  const gridCols = isMobile ? '1fr auto' : '150px 1fr 160px 130px 90px 90px 110px';

  function renderRow(a: AccountRow, depth: number, hasChildren: boolean) {
    const collapsedHere = collapsed.has(a.id);
    return (
      <div
        key={a.id}
        style={{
          display: 'grid',
          gridTemplateColumns: gridCols,
          columnGap: 16,
          rowGap: 4,
          padding: '13px 20px',
          fontSize: 14,
          alignItems: 'center',
          borderBottom: '1px solid var(--row-border)',
        }}
      >
        <div style={{ fontWeight: 600, fontFamily: 'monospace', display: 'flex', alignItems: 'center' }}>
          <span style={{ display: 'inline-block', width: depth * 18 }} />
          {hasChildren ? (
            <button
              onClick={() => toggleCollapse(a.id)}
              title={collapsedHere ? 'Expand' : 'Collapse'}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--muted)',
                padding: 0,
                marginRight: 6,
                width: 14,
                fontSize: 11,
              }}
            >
              {collapsedHere ? '▶' : '▼'}
            </button>
          ) : (
            <span style={{ display: 'inline-block', width: depth > 0 ? 20 : 0 }} />
          )}
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
        <div style={{ fontWeight: hasChildren ? 700 : 500 }}>
          {a.name}
          {hasChildren && (
            <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>· header</span>
          )}
        </div>
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
          <button
            onClick={() => openAddChild(a)}
            title="Add sub-account"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent,#6366f1)', padding: 4 }}
          >
            <PlusIcon />
          </button>
          <button onClick={() => openEdit(a)} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}>
            <EditIcon />
          </button>
          <button onClick={() => handleDelete(a)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'oklch(0.55 0.16 25)', padding: 4 }}>
            <TrashIcon />
          </button>
        </div>
      </div>
    );
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
              gridTemplateColumns: gridCols,
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

        {/* Filtered view: flat list so nothing is hidden behind a collapsed branch. */}
        {!loading && filtersActive && filtered.length === 0 && (
          <div style={{ padding: '18px 20px', fontSize: 13, color: 'var(--muted)' }}>No accounts match your filters.</div>
        )}
        {!loading &&
          filtersActive &&
          filtered.map((a) => renderRow(a, 0, a.has_children))}

        {/* Tree view: full nested chart. */}
        {!loading && !filtersActive && treeRows.length === 0 && (
          <div style={{ padding: '18px 20px', fontSize: 13, color: 'var(--muted)' }}>No accounts yet.</div>
        )}
        {!loading &&
          !filtersActive &&
          treeRows.map(({ node, depth }) => renderRow(node, depth, node.children.length > 0))}
      </div>

      <AccountModal
        open={modalOpen}
        editing={editing}
        parent={parentFor}
        chart={chart}
        accounts={accounts}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
