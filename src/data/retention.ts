import type { Session } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Sessions older than `days` days at time `now`. Null days keeps everything. */
export function expiredSessions(sessions: Session[], days: number | null, now: number): Session[] {
  if (days === null) return [];
  return sessions.filter((s) => now - Date.parse(s.createdAt) > days * DAY_MS);
}
