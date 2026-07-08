import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { can } from '../lib/permissions';
import {
  CandidatesIcon,
  DashboardIcon,
  LogoMark,
  LogoutIcon,
  PermissionsIcon,
  StaffIcon,
} from '../components/icons';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: <DashboardIcon />, permission: 'dashboard.view' },
  { to: '/candidates', label: 'Candidates', icon: <CandidatesIcon />, permission: 'candidates.view' },
  { to: '/staff', label: 'Staff Management', icon: <StaffIcon />, permission: 'staff.view' },
  { to: '/section-assignments', label: 'Section Assignment', icon: <CandidatesIcon />, permission: 'sections.view' },
  { to: '/roles', label: 'Roles', icon: <PermissionsIcon />, permission: 'roles.view' },
  { to: '/permissions', label: 'User Permissions', icon: <PermissionsIcon />, permission: 'permissions.view' },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Only show nav items the current user is allowed to access.
  const nav = NAV.filter((item) => can(user, item.permission));

  const username = user?.username ?? 'admin';
  const userInitial = username.charAt(0).toUpperCase();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', minHeight: '100vh' }}>
      {/* Sidebar */}
      <div
        style={{
          background: 'var(--panel)',
          color: 'white',
          padding: '24px 16px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px 28px 8px' }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: 'var(--logo)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <LogoMark size={18} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Overseas Careers</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className="sr-nav-btn"
              style={({ isActive }) => ({
                background: isActive ? 'var(--nav-active)' : 'transparent',
                textDecoration: 'none',
              })}
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </div>

        <div
          style={{
            marginTop: 'auto',
            paddingTop: 20,
            borderTop: '1px solid var(--panel-border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, marginBottom: 6 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 999,
                background: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {userInitial}
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {username}
              </div>
              <div style={{ fontSize: 11, color: 'oklch(0.75 0.02 250)' }}>
                {user?.role ?? 'Administrator'}
              </div>
            </div>
          </div>
          <button
            className="sr-nav-btn sr-logout-btn"
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: '9px 8px',
              gap: 10,
              color: 'oklch(0.85 0.02 250)',
              fontSize: 13,
              fontWeight: 400,
            }}
          >
            <LogoutIcon />
            Log Out
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '32px 40px', overflowY: 'auto' }}>
        <Outlet />
      </div>
    </div>
  );
}
