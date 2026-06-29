/**
 * Format a duration in seconds as a clock string.
 *
 * Renders `H:MM:SS` when the duration is at least one hour, otherwise `MM:SS`.
 * Seconds are floored, so fractional input is truncated (e.g. `90.9` → `01:30`).
 */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Backwards-compatible alias for clock-formatting durations in seconds. */
export function formatSeconds(seconds: number): string {
  return formatDuration(seconds);
}
