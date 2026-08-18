import { useEffect, useState } from 'react';
import { api } from '../api/client';
import CategoryModal from '../components/accounting/CategoryModal';
import GroupModal from '../components/accounting/GroupModal';
import { EditIcon, PlusIcon, TrashIcon } from '../components/icons';
import { confirmDelete, toastError, toastSuccess } from '../lib/alerts';
import type { AccountCategory, AccountGroup, NormalBalance, StatementType } from '../types';

export default function AccountGroupsPage() {
  const [categories, setCategories] = useState<AccountCategory[]>([]);
  const [groups, setGroups] = useState<AccountGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<AccountCategory | null>(null);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<AccountGroup | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [catRes, groupRes] = await Promise.all([
        api.get<AccountCategory[]>('/accounting/categories'),
        api.get<AccountGroup[]>('/accounting/groups'),
      ]);
      setCategories(catRes.data);
      setGroups(groupRes.data);
    } catch {
      setCategories([]);
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // ── Categories ──────────────────────────────────────────────────────────
  async function saveCategory(data: {
    code: string;
    name: string;
    normal_balance: NormalBalance;
    statement_type: StatementType;
  }) {
    if (editingCat) {
      await api.put(`/accounting/categories/${editingCat.id}`, data);
      toastSuccess('Category updated');
    } else {
      await api.post('/accounting/categories', data);
      toastSuccess('Category added');
    }
    setCatModalOpen(false);
    await load();
  }

  async function deleteCategory(c: AccountCategory) {
    const ok = await confirmDelete(`Delete category "${c.code} · ${c.name}"?`);
    if (!ok) return;
    try {
      await api.delete(`/accounting/categories/${c.id}`);
      toastSuccess('Category deleted');
      await load();
    } catch (err: unknown) {
      toastError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Could not delete the category.',
      );
    }
  }

  // ── Groups ──────────────────────────────────────────────────────────────
  async function saveGroup(data: { category_id: number; code: string; name: string }) {
    if (editingGroup) {
      await api.put(`/accounting/groups/${editingGroup.id}`, data);
      toastSuccess('Group updated');
    } else {
      await api.post('/accounting/groups', data);
      toastSuccess('Group added');
    }
    setGroupModalOpen(false);
    await load();
  }

  async function deleteGroup(g: AccountGroup) {
    const ok = await confirmDelete(`Delete group "${g.code} · ${g.name}"?`);
    if (!ok) return;
    try {
      await api.delete(`/accounting/groups/${g.id}`);
      toastSuccess('Group deleted');
      await load();
    } catch (err: unknown) {
      toastError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Could not delete the group.',
      );
    }
  }

  const groupsByCategory = (categoryId: number) => groups.filter((g) => g.category_id === categoryId);

  return (
    <div className="fade-in-s" style={{ maxWidth: 860 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 2 }}>Account Groups</div>
          <div style={{ fontSize: 14, color: 'var(--muted)' }}>
            {categories.length} categories · {groups.length} groups
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => {
              setEditingCat(null);
              setCatModalOpen(true);
            }}
            style={{
              padding: '10px 16px',
              borderRadius: 8,
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--row-border, #f3f4f6)',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <PlusIcon />
            Category
          </button>
          <button
            className="sr-btn-primary"
            onClick={() => {
              setEditingGroup(null);
              setGroupModalOpen(true);
            }}
            style={{ padding: '10px 16px', borderRadius: 8, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <PlusIcon />
            Group
          </button>
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
                justifyContent: 'space-between',
                gap: 12,
                padding: '14px 20px',
                borderBottom: '1px solid var(--row-border)',
                background: 'oklch(0.98 0.005 250)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => {
                    setEditingCat(cat);
                    setCatModalOpen(true);
                  }}
                  title="Edit category"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}
                >
                  <EditIcon />
                </button>
                <button
                  onClick={() => deleteCategory(cat)}
                  title="Delete category"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'oklch(0.55 0.16 25)', padding: 4 }}
                >
                  <TrashIcon />
                </button>
              </div>
            </div>

            {groupsByCategory(cat.id).length === 0 && (
              <div style={{ padding: '12px 20px', fontSize: 13, color: 'var(--muted)' }}>No groups in this category.</div>
            )}
            {groupsByCategory(cat.id).map((g) => (
              <div
                key={g.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '90px 1fr 100px 70px',
                  columnGap: 16,
                  padding: '11px 20px',
                  fontSize: 14,
                  alignItems: 'center',
                  borderBottom: '1px solid var(--row-border)',
                }}
              >
                <div style={{ fontFamily: 'monospace', fontWeight: 600 }}>{g.code}</div>
                <div style={{ fontWeight: 500 }}>{g.name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{g.accounts_count ?? 0} accounts</div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => {
                      setEditingGroup(g);
                      setGroupModalOpen(true);
                    }}
                    title="Edit group"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}
                  >
                    <EditIcon />
                  </button>
                  <button
                    onClick={() => deleteGroup(g)}
                    title="Delete group"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'oklch(0.55 0.16 25)', padding: 4 }}
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))}

      <CategoryModal open={catModalOpen} editing={editingCat} onClose={() => setCatModalOpen(false)} onSave={saveCategory} />
      <GroupModal
        open={groupModalOpen}
        editing={editingGroup}
        categories={categories}
        onClose={() => setGroupModalOpen(false)}
        onSave={saveGroup}
      />
    </div>
  );
}
