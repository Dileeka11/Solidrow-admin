import type { JourneyStatus } from '../types';

/**
 * Colour set for each journey status. `bg`/`color` style the badge,
 * `tint`/`border` colour the form & preview background (translucent so they
 * sit on both light and dark themes).
 */
export const JOURNEY_STATUS_META: Record<
  JourneyStatus,
  { label: string; hint: string; bg: string; color: string; tint: string; border: string }
> = {
  in_process: {
    label: 'In Process',
    hint: 'Agreement signed — awaiting departure.',
    bg: 'oklch(0.94 0.08 90)',
    color: 'oklch(0.48 0.12 75)',
    tint: 'oklch(0.85 0.15 90 / 0.18)',
    border: 'oklch(0.75 0.15 85 / 0.6)',
  },
  departed: {
    label: 'Departed',
    hint: 'Candidate has gone abroad.',
    bg: 'oklch(0.92 0.07 150)',
    color: 'oklch(0.42 0.13 150)',
    tint: 'oklch(0.72 0.15 150 / 0.14)',
    border: 'oklch(0.62 0.15 150 / 0.55)',
  },
  cancelled: {
    label: 'Cancelled',
    hint: 'Process cancelled / passport returned — not departing.',
    bg: 'oklch(0.93 0.06 25)',
    color: 'oklch(0.48 0.17 25)',
    tint: 'oklch(0.65 0.18 25 / 0.13)',
    border: 'oklch(0.6 0.18 25 / 0.55)',
  },
};

export const JOURNEY_STATUSES = Object.keys(JOURNEY_STATUS_META) as JourneyStatus[];

export function journeyMeta(status: string | null | undefined) {
  return status ? JOURNEY_STATUS_META[status as JourneyStatus] ?? null : null;
}
