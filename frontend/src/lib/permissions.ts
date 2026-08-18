import type { User } from '../types';

/** Route path → the permission label required to access it. */
export const ROUTE_PERMISSION: Record<string, string> = {
  '/dashboard': 'dashboard.view',
  '/candidates': 'candidates.view',
  '/baddegama': 'baddegama.view',
  '/staff': 'staff.view',
  '/accounting/accounts': 'accounting.view',
  '/accounting/groups': 'accounting.view',
  '/accounting/journal': 'accounting.view',
  '/accounting/ledger': 'accounting.view',
  '/accounting/trial-balance': 'accounting.view',
  '/accounting/departments': 'accounting.view',
  '/accounting/suppliers': 'accounting.view',
  '/accounting/item-categories': 'accounting.view',
  '/accounting/banks': 'accounting.view',
  '/accounting/pr': 'accounting.view',
  '/accounting/po': 'accounting.view',
  '/accounting/grn': 'accounting.view',
  '/accounting/payment': 'accounting.view',
  '/job-categories': 'staff.view',
  '/agents': 'staff.view',
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
