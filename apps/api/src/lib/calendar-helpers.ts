import type { CalendarEvent } from "@snc/shared";

import type { calendarEvents } from "../db/schema/calendar.schema.js";

import { toISO, toISOOrNull } from "./response-helpers.js";

type CalendarEventRow = typeof calendarEvents.$inferSelect;

/** Map a calendar event DB row to an API response with resolved project and creator names. */
export const toEventResponse = (
  row: CalendarEventRow,
  projectName: string | null,
  creatorName: string | null,
): CalendarEvent => ({
  id: row.id,
  title: row.title,
  description: row.description,
  startAt: toISO(row.startAt),
  endAt: toISOOrNull(row.endAt),
  allDay: row.allDay,
  eventType: row.eventType,
  location: row.location,
  createdBy: row.createdBy,
  creatorId: row.creatorId ?? null,
  creatorName: creatorName ?? null,
  projectId: row.projectId ?? null,
  projectName: projectName ?? null,
  completedAt: toISOOrNull(row.completedAt),
  createdAt: toISO(row.createdAt),
  updatedAt: toISO(row.updatedAt),
});
