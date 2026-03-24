import type { Column, SQL } from "drizzle-orm";
import { and, eq, gt, lt, or } from "drizzle-orm";

import { ValidationError } from "@snc/shared";

export const encodeCursor = (data: Readonly<Record<string, string>>): string =>
  Buffer.from(JSON.stringify(data)).toString("base64url");

/**
 * Decodes a base64url cursor and returns the raw JSON object.
 * Throws `ValidationError` on parse failure or if the decoded value is not a plain object.
 * Use this for cursors whose fields are opaque strings (e.g., Shopify endCursor)
 * rather than the typed keyset `{ timestamp, id }` expected by `decodeCursor`.
 */
export const decodeRawCursor = (cursor: string): Record<string, string> => {
  try {
    const decoded: unknown = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf-8"),
    );
    if (typeof decoded !== "object" || decoded === null || Array.isArray(decoded)) {
      throw new ValidationError("Invalid cursor format");
    }
    return decoded as Record<string, string>;
  } catch (e) {
    if (e instanceof ValidationError) throw e;
    throw new ValidationError("Invalid cursor");
  }
};

export const decodeCursor = (
  cursor: string,
  fields: { timestampField: string; idField: string },
): { timestamp: Date; id: string } => {
  try {
    const decoded = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf-8"),
    );
    if (
      typeof decoded[fields.timestampField] !== "string" ||
      typeof decoded[fields.idField] !== "string"
    ) {
      throw new ValidationError("Invalid cursor format");
    }
    const timestamp = new Date(decoded[fields.timestampField] as string);
    if (isNaN(timestamp.getTime())) {
      throw new ValidationError("Invalid cursor date");
    }
    return { timestamp, id: decoded[fields.idField] as string };
  } catch (e) {
    if (e instanceof ValidationError) throw e;
    throw new ValidationError("Invalid cursor");
  }
};

/**
 * Builds the keyset pagination WHERE condition for a timestamp + id cursor.
 *
 * DESC order (newest-first): rows where timestamp < decoded OR (timestamp = decoded AND id < decoded)
 * ASC order (oldest-first):  rows where timestamp > decoded OR (timestamp = decoded AND id > decoded)
 */
export function buildCursorCondition(
  timestampCol: Column,
  idCol: Column,
  decoded: { timestamp: Date; id: string },
  direction: "asc" | "desc",
): SQL {
  const cmp = direction === "desc" ? lt : gt;
  return or(
    cmp(timestampCol, decoded.timestamp),
    and(eq(timestampCol, decoded.timestamp), cmp(idCol, decoded.id)),
  ) as SQL;
}

/**
 * Given rows fetched with limit+1, determine if there's a next page,
 * slice to limit (non-mutating), and encode the cursor from the last item.
 * Returns { items: T[], nextCursor: string | null }.
 */
export function buildPaginatedResponse<T>(
  rows: T[],
  limit: number,
  cursorFields: (lastItem: T) => Record<string, string>,
): { items: T[]; nextCursor: string | null } {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  let nextCursor: string | null = null;
  if (hasMore) {
    const lastItem = items[items.length - 1]!;
    nextCursor = encodeCursor(cursorFields(lastItem));
  }
  return { items, nextCursor };
}
