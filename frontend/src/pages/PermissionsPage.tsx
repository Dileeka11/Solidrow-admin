import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { toastError } from '../lib/alerts';
import type { PermissionMatrix, PermissionRow } from '../types';

export default function PermissionsPage() {
  const [matrix, setMatrix] = useState<PermissionMatrix | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  useEffect(() => {
    api.get<PermissionMatrix>('/permissions').then((res) => {
      setMatrix(res.data);
      setSelectedUserId(res.data.users[0]?.id ?? null);
    });
  }, []);

  // Quick lookup: `${module}|${action}` → permission row.
  const byCell = useMemo(() => {
    const map = new Map<string, PermissionRow>();
    matrix?.permissions.forEach((p) => map.set(`${p.module}|${p.action}`, p));
    return map;
  }, [matrix]);

  async function toggle(row: PermissionRow) {
    if (selectedUserId == null) return;
    const staffId = selectedUserId;
    const has = row.allowed.includes(staffId);
    const next = !has;

    setMatrix((prev) =>
      prev
        ? {
            ...prev,
            permissions: prev.permissions.map((p) =>
              p.id === row.id
                ? {
                    ...p,
                    allowed: next
                      ? [...p.allowed, staffId]
                      : p.allowed.filter((id) => id !== staffId),
                  }
                : p,
            ),
          }
        : prev,
    );

    try {
      await api.patch(`/permissions/${row.id}`, { staff_id: staffId, allowed: next });
    } catch {
      setMatrix((prev) =>
        prev
          ? {
              ...prev,
              permissions: prev.permissions.map((p) =>
                p.id === row.id
                  ? {
                      ...p,
                      allowed: next
                        ? p.allowed.filter((id) => id !== staffId)
                        : [...p.allowed, staffId],
                    }
                  : p,
              ),
            }
          : prev,
      );
      toastError('Could not update permission. Please try again.');
    }
  }

  if (!matrix) {
    return <div style={{ color: 'var(--muted)' }}>Loading…</div>;
  }

  if (matrix.users.length === 0) {
    return (
      <div className="fade-in-s">
        <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 2 }}>User Permissions</div>
        <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 8 }}>
          No staff members yet. Add staff in Staff Management to configure their permissions.
        </div>
      </div>
    );
  }

  const gridCols = `1.6fr repeat(${matrix.actions.length}, minmax(70px, 1fr))`;

  return (
    <div className="fade-in-s">
      <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 2 }}>User Permissions</div>
      <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 20 }}>
        Select a staff member and control what they can do in each module
      </div>

      {/* User selector */}
      <div style={{ marginBottom: 20, maxWidth: 360 }}>
        <label
          style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--label-2)' }}
        >
          Staff member
        </label>
        <select
          className="sr-input"
          value={selectedUserId ?? ''}
          onChange={(e) => setSelectedUserId(Number(e.target.value))}
          style={{ padding: '11px 14px', fontSize: 14 }}
        >
          {matrix.users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} — {u.role}
            </option>
          ))}
        </select>
      </div>

      {/* Module × action grid */}
      <div
        style={{
          background: 'var(--card)',
          borderRadius: 12,
          boxShadow: 'var(--card-shadow)',
          overflowX: 'auto',
          maxWidth: 640,
        }}
      >
        <div style={{ minWidth: 480 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: gridCols,
              padding: '14px 20px',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--muted)',
              borderBottom: '1px solid var(--border-soft)',
            }}
          >
            <div>Module</div>
            {matrix.actions.map((a) => (
              <div key={a} style={{ textAlign: 'center', textTransform: 'capitalize' }}>
                {a}
              </div>
            ))}
          </div>

          {matrix.modules.map((module) => (
            <div
              key={module}
              style={{
                display: 'grid',
                gridTemplateColumns: gridCols,
                padding: '13px 20px',
                fontSize: 13,
                alignItems: 'center',
                borderBottom: '1px solid var(--row-border)',
              }}
            >
              <div style={{ fontWeight: 500 }}>{module}</div>
              {matrix.actions.map((action) => {
                const row = byCell.get(`${module}|${action}`);
                if (!row) {
                  // This module doesn't support this action (e.g. Dashboard · Delete).
                  return <div key={action} style={{ textAlign: 'center', color: 'var(--muted-2)' }}>—</div>;
                }
                return (
                  <div key={action} style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectedUserId != null && row.allowed.includes(selectedUserId)}
                      onChange={() => toggle(row)}
                      style={{ width: 17, height: 17, accentColor: 'var(--accent)', cursor: 'pointer' }}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
