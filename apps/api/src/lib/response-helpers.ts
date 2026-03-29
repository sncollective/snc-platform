/** Convert a Date to an ISO 8601 string. */
export const toISO = (date: Date): string => date.toISOString();
/** Convert a Date to an ISO 8601 string, or null if the date is null. */
export const toISOOrNull = (date: Date | null): string | null =>
  date?.toISOString() ?? null;
