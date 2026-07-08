import type { StaffStatus } from '../types';

/** First-two initials, uppercased — ported from initialsOf() in the design. */
export function initialsOf(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/** Status pill background + text colors — ported from statusColors() in the design. */
export function statusColors(status: StaffStatus): { bg: string; color: string } {
  if (status === 'Active') return { bg: 'oklch(0.93 0.06 150)', color: 'oklch(0.4 0.1 150)' };
  if (status === 'On Leave') return { bg: 'oklch(0.93 0.07 80)', color: 'oklch(0.45 0.12 80)' };
  return { bg: 'oklch(0.93 0.02 30)', color: 'oklch(0.45 0.05 30)' };
}

/** Accent hues used for the donut chart — ported from ACCENT_HUES in the design. */
export const ACCENT_HUES = [250, 200, 150, 30, 300];
