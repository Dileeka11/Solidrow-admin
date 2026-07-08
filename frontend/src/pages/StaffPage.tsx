import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { EditIcon, PlusIcon, TrashIcon } from '../components/icons';
import StaffModal from '../components/StaffModal';
import { initialsOf, statusColors } from '../lib/staff';
import { confirmDelete, toastError, toastSuccess } from '../lib/alerts';
import { useAuth } from '../auth/AuthContext';
import { can } from '../lib/permissions';
import type { Role, Staff, StaffInput } from '../types';

const GRID = '2fr 1.3fr 1.3fr 1fr 1.4fr 90px';

export default function StaffPage() {
  const { user } = useAuth();
  const canAdd = can(user, 'staff.add');
  const canEdit = can(user, 'staff.edit');
  const canDelete = can(user, 'staff.delete');

  const [staff, setStaff] = useState<Staff[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);

  async function load() {
    const [staffRes, rolesRes] = await Promise.all([
      api.get<Staff[]>('/staff'),
      api.get<Role[]>('/roles'),
    ]);
    setStaff(staffRes.data);
    setRoles(rolesRes.data.map((r) => r.name));
  }

  useEffect(() => {
    load();
  }, []);

  function openAdd() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(s: Staff) {
    setEditing(s);
    setModalOpen(true);
  }

  async function handleSave(data: StaffInput) {
    if (editing) {
      const res = await api.put<Staff>(`/staff/${editing.id}`, data);
      setStaff((prev) => prev.map((s) => (s.id === editing.id ? res.data : s)));
      toastSuccess('Staff member updated');
    } else {
      const res = await api.post<Staff>('/staff', data);
      setStaff((prev) => [...prev, res.data]);
      toastSuccess('Staff member added');
    }
    setModalOpen(false);
  }

  async function handleDelete(s: Staff) {
    const ok = await confirmDelete(`Remove ${s.name} from staff?`);
    if (!ok) return;
    try {
      await api.delete(`/staff/${s.id}`);
      setStaff((prev) => prev.filter((row) => row.id !== s.id));
      toastSuccess('Staff member deleted');
    } catch {
      toastError('Could not delete staff member.');
    }
  }

  return (
    <div className="fade-in-s">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
        }}
      >
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 2 }}>Staff Management</div>
          <div style={{ fontSize: 14, color: 'var(--muted)' }}>
            {staff.length} staff members
          </div>
        </div>
        {canAdd && (
          <button
            className="sr-btn-primary"
            onClick={openAdd}
            style={{
              padding: '11px 18px',
              borderRadius: 8,
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <PlusIcon />
            Add Staff
          </button>
        )}
      </div>

      <div
        style={{
          background: 'var(--card)',
          borderRadius: 12,
          boxShadow: 'var(--card-shadow)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: GRID,
            columnGap: 16,
            padding: '14px 20px',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--muted)',
            borderBottom: '1px solid var(--border-soft)',
          }}
        >
          <div>Name</div>
          <div>Role</div>
          <div>Department</div>
          <div>Status</div>
          <div>Email</div>
          <div />
        </div>

        {staff.map((s) => {
          const sc = statusColors(s.status);
          return (
            <div
              key={s.id}
              style={{
                display: 'grid',
                gridTemplateColumns: GRID,
                columnGap: 16,
                padding: '14px 20px',
                fontSize: 13,
                alignItems: 'center',
                borderBottom: '1px solid var(--row-border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 999,
                    background: 'oklch(0.9 0.03 250)',
                    color: 'oklch(0.4 0.1 250)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {initialsOf(s.name)}
                </div>
                <span style={{ fontWeight: 500 }}>{s.name}</span>
              </div>
              <div style={{ color: 'var(--label-2)' }}>{s.role}</div>
              <div style={{ color: 'var(--label-2)' }}>{s.department}</div>
              <div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '3px 9px',
                    borderRadius: 999,
                    background: sc.bg,
                    color: sc.color,
                  }}
                >
                  {s.status}
                </span>
              </div>
              <div
                style={{
                  color: 'var(--muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {s.email}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {canEdit && (
                  <button className="sr-icon-btn" onClick={() => openEdit(s)} aria-label="Edit">
                    <EditIcon />
                  </button>
                )}
                {canDelete && (
                  <button className="sr-icon-btn" onClick={() => handleDelete(s)} aria-label="Delete">
                    <TrashIcon />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <StaffModal
        open={modalOpen}
        editing={editing}
        roles={roles}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
