import type { User } from '../types';

/** Route path → the permission label required to access it. */
export const ROUTE_PERMISSION: Record<string, string> = {
  '/dashboard': 'dashboard.view',
  '/candidates': 'candidates.view',
  '/staff': 'staff.view',
  '/job-categories': 'staff.view',
  '/section-assignments': 'sections.view',
  '/roles': 'roles.view',
  '/permissions': 'permissions.view',
};

/** Does this user hold the given permission label? */
export function can(user: User | null, permission: string): boolean {
  return !!user?.permissions?.includes(permission);
}

/** The first route the user is allowed to see (used for redirects). */
export function firstAllowedRoute(user: User | null): string | null {
  for (const [path, perm] of Object.entries(ROUTE_PERMISSION)) {
    if (can(user, perm)) return path;
  }
  return null;
}
