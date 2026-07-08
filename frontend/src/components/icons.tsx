// SVG icons ported 1:1 from Admin Panel.dc.html

export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="8" height="8" rx="2" fill="white" />
      <rect x="13" y="3" width="8" height="8" rx="2" fill="white" opacity="0.6" />
      <rect x="3" y="13" width="8" height="8" rx="2" fill="white" opacity="0.6" />
      <rect x="13" y="13" width="8" height="8" rx="2" fill="white" />
    </svg>
  );
}

export function DashboardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="7" height="7" rx="1.5" fill="white" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" fill="white" opacity="0.65" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" fill="white" opacity="0.65" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" fill="white" />
    </svg>
  );
}

export function StaffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="7" r="3.2" fill="white" />
      <path
        d="M2.5 20c0-3.6 3-6 6.5-6s6.5 2.4 6.5 6"
        stroke="white"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="18" cy="8" r="2.4" fill="white" opacity="0.6" />
      <path
        d="M15.5 20c0.3-2.8 2-4.8 4.5-5"
        stroke="white"
        strokeWidth="2"
        opacity="0.6"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CandidatesIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="3" width="16" height="18" rx="2" fill="white" opacity="0.85" />
      <circle cx="12" cy="9" r="2.4" fill="var(--panel)" />
      <path
        d="M8 16c0-2.2 1.8-3.6 4-3.6s4 1.4 4 3.6"
        stroke="var(--panel)"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PermissionsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="5" y="10" width="14" height="10" rx="2" fill="white" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="white" strokeWidth="2" fill="none" />
    </svg>
  );
}

export function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M16 17l5-5-5-5M21 12H9"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"
        stroke="oklch(0.4 0.01 250)"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"
        stroke="oklch(0.5 0.15 30)"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
