export const toISO = (date: Date): string => date.toISOString();
export const toISOOrNull = (date: Date | null): string | null =>
  date?.toISOString() ?? null;
