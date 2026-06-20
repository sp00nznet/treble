/** Small time helpers shared by the player surfaces. */

/** "3:58" / "1:02:30" → seconds. Returns 0 for unparseable input. */
export function parseDuration(s: string): number {
  if (!s) return 0;
  const parts = s.split(":").map((p) => parseInt(p, 10));
  if (parts.some((n) => Number.isNaN(n))) return 0;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

/** seconds → "m:ss" (or "h:mm:ss" past an hour). */
export function fmtTime(secs: number): string {
  if (!Number.isFinite(secs) || secs < 0) secs = 0;
  const s = Math.floor(secs % 60);
  const m = Math.floor((secs / 60) % 60);
  const h = Math.floor(secs / 3600);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** Duration of a track in seconds, preferring the numeric field, falling back to the display string. */
export function trackDuration(t: { duration_secs?: number; duration: string }): number {
  return t.duration_secs && t.duration_secs > 0 ? t.duration_secs : parseDuration(t.duration);
}
