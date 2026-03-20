import { formatDistanceToNow, format, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

// ── Constants ──

const DEFAULT_TIMEZONE = "America/Denver";

// ── Public API ──

/**
 * Converts an ISO 8601 date string into a human-readable relative time string.
 *
 * Rules (evaluated in order):
 *   < 60 seconds  → "just now"
 *   < 30 days     → natural language relative ("5 minutes ago", "3 days ago")
 *   >= 30 days    → formatted date (e.g. "Feb 26, 2026")
 */
export function formatRelativeDate(isoDateString: string): string {
  const date = parseISO(isoDateString);
  const diffMs = Date.now() - date.getTime();

  if (diffMs < 0 || diffMs < 60_000) {
    return "just now";
  }

  // Under 30 days: use relative ("5 minutes ago", "3 days ago")
  if (diffMs < 30 * 24 * 60 * 60 * 1000) {
    return formatDistanceToNow(date, { addSuffix: true });
  }

  // 30+ days: absolute date
  return format(date, "MMM d, yyyy");
}

export function formatDate(isoDateString: string): string {
  // Date-only strings (YYYY-MM-DD) need UTC to avoid timezone shift
  return formatInTimeZone(parseISO(isoDateString), "UTC", "MMM d, yyyy");
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

export function truncateToWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) {
    return text;
  }
  return words.slice(0, maxWords).join(" ");
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Formats a CO2 kilogram value for summary/card display.
 * Auto-scales between g (< 1 kg) and kg (>= 1 kg).
 *
 * For chart axis labels that always display in kg with variable precision,
 * see `formatCo2AxisLabel` in `chart-math.ts`.
 */
export function formatCo2(kg: number): string {
  if (kg === 0) return "0 g";
  if (Math.abs(kg) < 1) return `${(kg * 1000).toFixed(1)} g`;
  return `${kg.toFixed(1)} kg`;
}

// ── Timezone Helpers ──

/** Resolve the user's IANA timezone, falling back to Denver. */
export function getUserTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz || DEFAULT_TIMEZONE;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

/** Extract a YYYY-MM-DD date key from an ISO string in the user's local timezone. */
export function toLocalDateKey(isoString: string): string {
  return formatInTimeZone(parseISO(isoString), getUserTimezone(), "yyyy-MM-dd");
}

/** Format a YYYY-MM-DD date key in the user's local timezone. */
export function formatLocalDate(dateKey: string): string {
  return formatInTimeZone(parseISO(dateKey + "T12:00:00"), getUserTimezone(), "MMM d, yyyy");
}
