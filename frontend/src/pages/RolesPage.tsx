import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api/client';
import { EditIcon, PlusIcon, TrashIcon } from '../components/icons';
import { confirmDelete, promptText, toastError, toastSuccess } from '../lib/alerts';
import { useAuth } from '../auth/AuthContext';
import { can } from '../lib/permissions';
import type { Role } from '../types';

export default function RolesPage() {
  const { user } = useAuth();
  const canAdd = can(user, 'roles.add');
  const canEdit = can(user, 'roles.edit');
  const canDelete = can(user, 'roles.delete');

  const [roles, setRoles] = useState<Role[]>([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await api.get<Role[]>('/roles');
    setRoles(res.data);
  }

  useEffect(() => {
    load();
  }, []);

  function errorMessage(err: unknown, fallback: string): string {
    return (
      (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback
    );
  }

  function sortRoles(list: Role[]): Role[] {
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const res = await api.post<Role>('/roles', { name: trimmed });
      setRoles((prev) => sortRoles([...prev, res.data]));
      setName('');
      toastSuccess(`Role “${res.data.name}” added`);
    } catch (err: unknown) {
      toastError(errorMessage(err, 'Could not add role. It may already exist.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleEdit(role: Role) {
    const next = await promptText('Rename role', role.name, 'Role name');
    if (next === null || next === role.name) return;
    try {
      const res = await api.put<Role>(`/roles/${role.id}`, { name: next });
      setRoles((prev) => sortRoles(prev.map((r) => (r.id === role.id ? res.data : r))));
      toastSuccess('Role renamed');
    } catch (err: unknown) {
      toastError(errorMessage(err, 'Could not rename role. The name may already exist.'));
    }
  }

  async function handleDelete(role: Role) {
    const ok = await confirmDelete(`Delete the role “${role.name}”?`);
    if (!ok) return;
    try {
      await api.delete(`/roles/${role.id}`);
      setRoles((prev) => prev.filter((r) => r.id !== role.id));
      toastSuccess('Role deleted');
    } catch (err: unknown) {
      toastError(errorMessage(err, 'Could not delete role.'));
    }
  }

  return (
    <div className="fade-in-s">
      <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 2 }}>Roles</div>
      <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 24 }}>
        Create the roles you can assign to staff and configure in User Permissions
      </div>

      {/* Add role */}
      {canAdd && (
        <form
          onSubmit={handleAdd}
          style={{ display: 'flex', gap: 10, marginBottom: 18, maxWidth: 480 }}
        >
          <input
            className="sr-input"
            type="text"
            placeholder="New role name — e.g. Accounts Officer"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ padding: '11px 14px', flex: 1 }}
          />
          <button
            className="sr-btn-primary"
            type="submit"
            disabled={busy}
            style={{
              padding: '11px 18px',
              borderRadius: 8,
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              whiteSpace: 'nowrap',
            }}
          >
            <PlusIcon />
            Add Role
          </button>
        </form>
      )}

      {/* Role list */}
      <div
        style={{
          background: 'var(--card)',
          borderRadius: 12,
          boxShadow: 'var(--card-shadow)',
          overflow: 'hidden',
          maxWidth: 480,
        }}
      >
        {roles.length === 0 && (
          <div style={{ padding: '16px 20px', fontSize: 13, color: 'var(--muted)' }}>
            No roles yet. Add one above.
          </div>
        )}
        {roles.map((r) => (
          <div
            key={r.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '13px 20px',
              fontSize: 14,
              borderBottom: '1px solid var(--row-border)',
            }}
          >
            <span style={{ fontWeight: 500 }}>{r.name}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {canEdit && (
                <button className="sr-icon-btn" onClick={() => handleEdit(r)} aria-label={`Edit ${r.name}`}>
                  <EditIcon />
                </button>
              )}
              {canDelete && (
                <button
                  className="sr-icon-btn"
                  onClick={() => handleDelete(r)}
                  aria-label={`Delete ${r.name}`}
                >
                  <TrashIcon />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
