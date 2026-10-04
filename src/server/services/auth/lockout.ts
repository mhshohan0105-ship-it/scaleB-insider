// Login rate limiting: too many recent failures for one agency + username locks
// further attempts for a window. Pure so it can be unit tested.

export const LOCKOUT_MAX_FAILURES = 5;
export const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

/**
 * `recent` is the newest-first list of attempts inside the lockout window.
 * Only consecutive failures since the last success count.
 */
export function isLockedOut(recent: { success: boolean }[]): boolean {
  let failures = 0;
  for (const attempt of recent) {
    if (attempt.success) break;
    failures += 1;
  }
  return failures >= LOCKOUT_MAX_FAILURES;
}
