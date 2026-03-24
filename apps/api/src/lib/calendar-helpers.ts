import type { CalendarEvent } from "@snc/shared";

import type { calendarEvents } from "../db/schema/calendar.schema.js";

type CalendarEventRow = typeof calendarEvents.$inferSelect;

export const toEventResponse = (
  row: CalendarEventRow,
  projectName: string | null,
  creatorName: string | null,
): CalendarEvent => ({
  id: row.id,
  title: row.title,
  description: row.description,
  startAt: row.startAt.toISOString(),
  endAt: row.endAt?.toISOString() ?? null,
  allDay: row.allDay,
  eventType: row.eventType,
  location: row.location,
  createdBy: row.createdBy,
  creatorId: row.creatorId ?? null,
  creatorName: creatorName ?? null,
  projectId: row.projectId ?? null,
  projectName: projectName ?? null,
  completedAt: row.completedAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});
