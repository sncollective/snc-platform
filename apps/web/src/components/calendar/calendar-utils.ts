import type { CalendarEvent } from "@snc/shared";

import { toLocalDateKey } from "../../lib/format.js";

/** Group calendar events by their local date key (YYYY-MM-DD). */
export function groupEventsByDate(
  events: readonly CalendarEvent[],
): Map<string, CalendarEvent[]> {
  const groups = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const dateKey = toLocalDateKey(event.startAt);
    const existing = groups.get(dateKey);
    if (existing) {
      existing.push(event);
    } else {
      groups.set(dateKey, [event]);
    }
  }
  return groups;
}
