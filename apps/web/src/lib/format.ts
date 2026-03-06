// ── Constants ──

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;

// ── Public API ──

/**
 * Converts an ISO 8601 date string into a human-readable relative time string.
 *
 * Rules (evaluated in order):
 *   < 60 seconds  → "just now"
 *   < 60 minutes  → "{n}m ago"
 *   < 24 hours    → "{n}h ago"
 *   < 7 days      → "{n}d ago"
 *   < 30 days     → "{n}w ago"
 *   >= 30 days    → formatted date (e.g. "Feb 26, 2026")
 */
export function formatRelativeDate(isoDateString: string): string {
  const diffMs = Date.now() - new Date(isoDateString).getTime();

  if (diffMs < 0) {
    return "just now";
  }

  const seconds = Math.floor(diffMs / 1000);

  if (seconds < MINUTE) {
    return "just now";
  }

  if (seconds < HOUR) {
    return `${Math.floor(seconds / MINUTE)}m ago`;
  }

  if (seconds < DAY) {
    return `${Math.floor(seconds / HOUR)}h ago`;
  }

  if (seconds < WEEK) {
    return `${Math.floor(seconds / DAY)}d ago`;
  }

  if (seconds < MONTH) {
    return `${Math.floor(seconds / WEEK)}w ago`;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(isoDateString));
}

export function formatDate(isoDateString: string): string {
  // Date-only strings (YYYY-MM-DD) are parsed as UTC midnight by the Date
  // constructor.  Intl.DateTimeFormat then formats in the local timezone,
  // which shifts the displayed day backwards for western-hemisphere users.
  // Forcing timeZone: "UTC" keeps the calendar date stable.
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(isoDateString));
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatInterval(interval: "month" | "year"): string {
  return `/ ${interval}`;
}

export function formatIntervalShort(interval: "month" | "year"): string {
  return interval === "month" ? "mo" : "yr";
}

export function formatCo2(kg: number): string {
  if (kg === 0) return "0 g";
  if (Math.abs(kg) < 1) return `${(kg * 1000).toFixed(1)} g`;
  return `${kg.toFixed(1)} kg`;
}
