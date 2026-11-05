import type { Session } from './types';

const DAY_MS = 86_400_000;

export const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** What was recorded today. Counts only, from real sessions. */
export function todaySummary(sessions: Session[], now: Date): { sessions: number; deliveries: number } {
  const today = sessions.filter((s) => sameDay(new Date(s.createdAt), now));
  return { sessions: today.length, deliveries: today.reduce((n, s) => n + s.deliveries.length, 0) };
}

/**
 * Deliveries marked in each of the last `weeks` weeks, oldest first. A week is 7 days counted
 * back from `now`, not a calendar week, so the last bar is always the most recent 7 days.
 */
export function weeklyDeliveries(sessions: Session[], now: number, weeks: number): number[] {
  const bars = new Array<number>(weeks).fill(0);
  for (const s of sessions) {
    const age = now - Date.parse(s.createdAt);
    if (age < 0) continue;
    const index = Math.floor(age / (7 * DAY_MS));
    if (index < weeks) bars[weeks - 1 - index]! += s.deliveries.length;
  }
  return bars;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) +
    ', ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
