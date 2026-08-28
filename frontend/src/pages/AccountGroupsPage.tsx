import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import type { AccountCategory, AccountGroup, AccountRow } from '../types';

/**
 * Read-only view of the chart's fixed skeleton. Categories (Assets…) and groups
 * (Current Assets…) are seeded and locked — users build their tree with
 * accounts/sub-accounts on the Chart of Accounts screen. Here each group can be
 * expanded to preview the (nested) accounts that roll up into it.
 */

interface TreeNode extends AccountRow {
  children: TreeNode[];
}

/** Build the nested tree for one group's accounts (roots = no parent). */
function buildGroupTree(rows: AccountRow[]): TreeNode[] {
  const byId = new Map<number, TreeNode>();
  rows.forEach((r) => byId.set(r.id, { ...r, children: [] }));
  const roots: TreeNode[] = [];
  byId.forEach((node) => {
    if (node.parent_id && byId.has(node.parent_id)) byId.get(node.parent_id)!.children.push(node);
    else roots.push(node);
  });
  const sortRec = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
    nodes.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

export default function AccountGroupsPage() {
  const [categories, setCategories] = useState<AccountCategory[]>([]);
  const [groups, setGroups] = useState<AccountGroup[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [catRes, groupRes, accRes] = await Promise.all([
          api.get<AccountCategory[]>('/accounting/categories'),
          api.get<AccountGroup[]>('/accounting/groups'),
          api.get<AccountRow[]>('/accounting/accounts'),
        ]);
        setCategories(catRes.data);
        setGroups(groupRes.data);
        setAccounts(accRes.data);
      } catch {
        setCategories([]);
        setGroups([]);
        setAccounts([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const groupsByCategory = (categoryId: number) => groups.filter((g) => g.category_id === categoryId);

  // group_id -> nested account tree, computed once.
  const treeByGroup = useMemo(() => {
    const map = new Map<number, TreeNode[]>();
    groups.forEach((g) => {
      map.set(g.id, buildGroupTree(accounts.filter((a) => a.group_id === g.id)));
    });
    return map;
  }, [groups, accounts]);

  function toggle(groupId: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  function renderNodes(nodes: TreeNode[], depth: number): React.ReactNode {
    return nodes.map((n) => (
      <div key={n.id}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '110px 1fr 80px',
            columnGap: 16,
            padding: '9px 20px 9px 40px',
            fontSize: 13,
            alignItems: 'center',
            borderBottom: '1px solid var(--row-border)',
            background: 'oklch(0.99 0.003 250)',
          }}
        >
          <div style={{ fontFamily: 'monospace', fontWeight: 600, display: 'flex', alignItems: 'center' }}>
            <span style={{ display: 'inline-block', width: depth * 18 }} />
            {n.children.length > 0 && <span style={{ marginRight: 6, color: 'var(--muted)' }}>└</span>}
            {n.code}
          </div>
          <div style={{ fontWeight: n.children.length > 0 ? 700 : 500 }}>
            {n.name}
            {n.children.length > 0 && (
              <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>· header</span>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '1px 7px',
                borderRadius: 6,
                color: n.is_active ? 'oklch(0.45 0.13 150)' : 'oklch(0.55 0.02 250)',
                background: n.is_active ? 'oklch(0.95 0.05 150)' : 'oklch(0.94 0.01 250)',
              }}
            >
              {n.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
        {n.children.length > 0 && renderNodes(n.children, depth + 1)}
      </div>
    ));
  }

  return (
    <div className="fade-in-s" style={{ maxWidth: 860 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 2 }}>Account Groups</div>
        <div style={{ fontSize: 14, color: 'var(--muted)' }}>
          {categories.length} categories · {groups.length} groups — click a group to see its accounts
        </div>
      </div>

      {loading && <div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading…</div>}

      {!loading &&
        categories.map((cat) => (
          <div
            key={cat.id}
            style={{ background: 'var(--card)', borderRadius: 12, boxShadow: 'var(--card-shadow)', marginBottom: 16, overflow: 'hidden' }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 20px',
                borderBottom: '1px solid var(--row-border)',
                background: 'oklch(0.98 0.005 250)',
              }}
            >
              <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 15 }}>{cat.code}</span>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{cat.name}</span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 6,
                  color: 'var(--muted)',
                  background: 'oklch(0.94 0.01 250)',
                }}
              >
                {cat.normal_balance === 'debit' ? 'Debit' : 'Credit'} · {cat.statement_type}
              </span>
            </div>

            {groupsByCategory(cat.id).length === 0 && (
              <div style={{ padding: '12px 20px', fontSize: 13, color: 'var(--muted)' }}>No groups in this category.</div>
            )}
            {groupsByCategory(cat.id).map((g) => {
              const isOpen = expanded.has(g.id);
              const roots = treeByGroup.get(g.id) ?? [];
              return (
                <div key={g.id}>
                  <div
                    onClick={() => toggle(g.id)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '90px 1fr 120px',
                      columnGap: 16,
                      padding: '11px 20px',
                      fontSize: 14,
                      alignItems: 'center',
                      borderBottom: '1px solid var(--row-border)',
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                  >
                    <div style={{ fontFamily: 'monospace', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 12, fontSize: 11, color: 'var(--muted)' }}>{isOpen ? '▼' : '▶'}</span>
                      {g.code}
                    </div>
                    <div style={{ fontWeight: 500 }}>{g.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'right' }}>{g.accounts_count ?? 0} accounts</div>
                  </div>
                  {isOpen &&
                    (roots.length === 0 ? (
                      <div style={{ padding: '10px 20px 10px 40px', fontSize: 13, color: 'var(--muted)', borderBottom: '1px solid var(--row-border)' }}>
                        No accounts in this group yet.
                      </div>
                    ) : (
                      renderNodes(roots, 0)
                    ))}
                </div>
              );
            })}
          </div>
        ))}
    </div>
  );
}
