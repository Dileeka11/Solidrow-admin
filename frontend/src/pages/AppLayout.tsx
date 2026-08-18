import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { can } from '../lib/permissions';
import { useIsMobile } from '../lib/useMediaQuery';
import {
  AccountingIcon,
  CandidatesIcon,
  DashboardIcon,
  LogoMark,
  LogoutIcon,
  PermissionsIcon,
} from '../components/icons';

type NavLeaf = { to: string; label: string; permission?: string };
type NavSubGroup = { label: string; children: NavLeaf[] };
type NavChild = NavLeaf | NavSubGroup;
type NavGroup = { label: string; icon: ReactNode; permission?: string; children: NavChild[] };
type NavTop = { to: string; label: string; icon: ReactNode; permission: string };
type NavItem = NavTop | NavGroup;

const NAV: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: <DashboardIcon />, permission: 'dashboard.view' },
  {
    label: 'Registration',
    icon: <CandidatesIcon />,
    children: [
      { to: '/candidates', label: 'Candidates', permission: 'candidates.view' },
      { to: '/baddegama', label: 'Baddegama Registrations', permission: 'baddegama.view' },
      { to: '/reports', label: 'Reports', permission: 'candidates.view' },
      { to: '/staff', label: 'Staff Management', permission: 'staff.view' },
      { to: '/section-assignments', label: 'Section Assignment', permission: 'sections.view' },
      { to: '/job-categories', label: 'Job Categories', permission: 'staff.view' },
      { to: '/demands', label: 'Demands', permission: 'staff.view' },
      { to: '/agents', label: 'Agents', permission: 'staff.view' },
      { to: '/locations', label: 'Locations', permission: 'staff.view' },
    ],
  },
  {
    label: 'Accounting',
    icon: <AccountingIcon />,
    permission: 'accounting.view',
    children: [
      { to: '/accounting/accounts', label: 'Chart of Accounts' },
      { to: '/accounting/groups', label: 'Account Groups' },
      { to: '/accounting/journal', label: 'Journal Entries' },
      { to: '/accounting/ledger', label: 'General Ledger' },
      { to: '/accounting/trial-balance', label: 'Trial Balance' },
      {
        label: 'Master',
        children: [
          { to: '/accounting/departments', label: 'Department Master' },
          { to: '/accounting/suppliers', label: 'Supplier Master' },
          { to: '/accounting/item-categories', label: 'Category Master' },
          { to: '/accounting/banks', label: 'Bank & Branch Master' },
        ],
      },
      {
        label: 'Data Capture',
        children: [
          { to: '/accounting/pr', label: 'Purchase Requisition' },
          { to: '/accounting/po', label: 'Purchase Order' },
          { to: '/accounting/grn', label: 'Goods Received Note' },
          { to: '/accounting/payment', label: 'Supplier Payment' },
        ],
      },
    ],
  },
  { to: '/roles', label: 'Roles', icon: <PermissionsIcon />, permission: 'roles.view' },
  { to: '/permissions', label: 'User Permissions', icon: <PermissionsIcon />, permission: 'permissions.view' },
];

function hasChildren(item: NavItem): item is NavGroup {
  return 'children' in item;
}

function isSubGroup(child: NavChild): child is NavSubGroup {
  return 'children' in child;
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const contentRef = useRef<HTMLDivElement>(null);

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // Scroll the content area (and window, for mobile) back to the top whenever
  // the route changes, so every page opens at its top.
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, left: 0 });
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Auto-expand the group (and nested sub-group) that owns the current route.
  useEffect(() => {
    const toOpen: string[] = [];
    for (const item of NAV) {
      if (!hasChildren(item)) continue;
      for (const child of item.children) {
        if (isSubGroup(child)) {
          if (child.children.some((l) => location.pathname.startsWith(l.to))) {
            toOpen.push(item.label, child.label);
          }
        } else if (location.pathname.startsWith(child.to)) {
          toOpen.push(item.label);
        }
      }
    }
    if (toOpen.length) {
      setOpenGroups((prev) => Array.from(new Set([...prev, ...toOpen])));
    }
  }, [location.pathname]);

  function toggleGroup(label: string) {
    setOpenGroups((prev) => (prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]));
  }

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    if (isMobile && drawerOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [isMobile, drawerOpen]);

  // A leaf is visible when it carries no permission, or the user holds it.
  const isLeafVisible = (leaf: NavLeaf) => !leaf.permission || can(user, leaf.permission);
  // A group is visible when its own permission (if any) passes and at least one
  // child leaf is visible to this user.
  const isGroupVisible = (group: NavGroup) => {
    if (group.permission && !can(user, group.permission)) return false;
    return group.children.some((c) => (isSubGroup(c) ? c.children.some(isLeafVisible) : isLeafVisible(c)));
  };

  // Only show nav items the current user is allowed to access.
  const nav = NAV.filter((item) => (hasChildren(item) ? isGroupVisible(item) : can(user, item.permission)));

  const username = user?.username ?? 'admin';
  const userInitial = username.charAt(0).toUpperCase();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  const sidebar = (
    <div
      style={{
        background: 'var(--panel)',
        color: 'white',
        padding: '24px 16px',
        display: 'flex',
        flexDirection: 'column',
        height: isMobile ? '100%' : 'auto',
        width: isMobile ? 260 : 'auto',
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
        {nav.map((item) => {
          if (hasChildren(item)) {
            const isOpen = openGroups.includes(item.label);
            const anyChildActive = item.children.some((c) =>
              isSubGroup(c)
                ? c.children.some((l) => location.pathname.startsWith(l.to))
                : location.pathname.startsWith(c.to),
            );
            return (
              <div key={item.label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <button
                  className="sr-nav-btn"
                  onClick={() => toggleGroup(item.label)}
                  style={{
                    width: '100%',
                    justifyContent: 'space-between',
                    // Highlight the header only when collapsed but a child is active.
                    background: anyChildActive && !isOpen ? 'var(--nav-active)' : 'transparent',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {item.icon}
                    {item.label}
                  </span>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s ease', opacity: 0.8 }}
                  >
                    <polyline points="9 6 15 12 9 18" />
                  </svg>
                </button>
                {isOpen && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 2 }}>
                    {item.children
                      .filter((child) => (isSubGroup(child) ? child.children.some(isLeafVisible) : isLeafVisible(child)))
                      .map((child) => {
                      if (isSubGroup(child)) {
                        const visibleLeaves = child.children.filter(isLeafVisible);
                        const subOpen = openGroups.includes(child.label);
                        const subActive = visibleLeaves.some((l) => location.pathname.startsWith(l.to));
                        return (
                          <div key={child.label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <button
                              className="sr-nav-btn"
                              onClick={() => toggleGroup(child.label)}
                              style={{
                                width: '100%',
                                justifyContent: 'space-between',
                                paddingLeft: 28,
                                fontSize: 13,
                                fontWeight: 600,
                                background: subActive && !subOpen ? 'var(--nav-active)' : 'transparent',
                              }}
                            >
                              <span>{child.label}</span>
                              <svg
                                width="13"
                                height="13"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.4"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={{ transform: subOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s ease', opacity: 0.7 }}
                              >
                                <polyline points="9 6 15 12 9 18" />
                              </svg>
                            </button>
                            {subOpen &&
                              visibleLeaves.map((leaf) => (
                                <NavLink
                                  key={leaf.to}
                                  to={leaf.to}
                                  className="sr-nav-btn"
                                  style={({ isActive }) => ({
                                    background: isActive ? 'var(--nav-active)' : 'transparent',
                                    textDecoration: 'none',
                                    paddingLeft: 60,
                                    fontSize: 13,
                                    fontWeight: 400,
                                  })}
                                >
                                  {leaf.label}
                                </NavLink>
                              ))}
                          </div>
                        );
                      }
                      return (
                        <NavLink
                          key={child.to}
                          to={child.to}
                          className="sr-nav-btn"
                          style={({ isActive }) => ({
                            background: isActive ? 'var(--nav-active)' : 'transparent',
                            textDecoration: 'none',
                            paddingLeft: 44,
                            fontSize: 13,
                            fontWeight: 400,
                          })}
                        >
                          {child.label}
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }
          return (
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
          );
        })}
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
  );

  // ── Mobile: top bar + slide-in drawer ──────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 14px',
            background: 'var(--card)',
            borderBottom: '1px solid var(--border)',
            position: 'sticky',
            top: 0,
            zIndex: 30,
          }}
        >
          <button
            className="sr-hamburger"
            aria-label="Open menu"
            onClick={() => setDrawerOpen(true)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                background: 'var(--logo)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <LogoMark size={15} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Overseas Careers</div>
          </div>
        </header>

        {drawerOpen && (
          <>
            <button
              className="sr-drawer-overlay"
              aria-label="Close menu"
              onClick={() => setDrawerOpen(false)}
            />
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                bottom: 0,
                zIndex: 50,
                boxShadow: '2px 0 16px oklch(0 0 0 / 0.25)',
                animation: 'fadeIn 0.2s ease',
              }}
            >
              {sidebar}
            </div>
          </>
        )}

        <main style={{ flex: 1, padding: '18px 16px', overflowX: 'hidden' }}>
          <Outlet />
        </main>
      </div>
    );
  }

  // ── Desktop: fixed sidebar + content ───────────────────────────────────
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', minHeight: '100vh' }}>
      {sidebar}
      <div ref={contentRef} style={{ padding: '32px 40px', overflowY: 'auto' }}>
        <Outlet />
      </div>
    </div>
  );
}
