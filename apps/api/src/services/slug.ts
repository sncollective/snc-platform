import { and, eq, like, ne } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

import { db } from "../db/connection.js";

// ── Public Helpers ──

/** Convert a display name to a URL-safe kebab-case slug, truncated to maxLength. */
export const toSlug = (name: string, maxLength = 80): string =>
  name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, maxLength);

/**
 * Generate a collision-safe slug by querying the DB for existing matches and appending a numeric suffix if needed.
 *
 * If the base slug produced from `name` is fewer than 3 characters, falls back to
 * `{fallbackPrefix}-{8-char UUID}` to guarantee a usable slug for very short names.
 *
 * Collision detection uses a LIKE `base%` query to fetch all slugs sharing the same
 * prefix, then iterates `-2`, `-3`, … until a free candidate is found. Results are
 * scoped to an optional `(scopeColumn, scopeValue)` pair — for example, scoping slugs
 * per-creator so the same slug may be reused across different scopes. Pass `excludeId`
 * + `idColumn` to allow the current row's own slug to be reused during updates.
 */
export const generateUniqueSlug = async (
  name: string,
  options: Readonly<{
    table: PgTable;
    slugColumn: PgColumn;
    scopeColumn?: PgColumn;
    scopeValue?: string;
    excludeId?: string;
    idColumn?: PgColumn;
    maxLength?: number;
    fallbackPrefix?: string;
  }>,
): Promise<string> => {
  const maxLength = options.maxLength ?? 80;
  const fallbackPrefix = options.fallbackPrefix ?? "item";
  const base = toSlug(name, maxLength);

  if (base.length < 3) {
    const { randomUUID } = await import("node:crypto");
    return `${fallbackPrefix}-${randomUUID().slice(0, 8)}`;
  }

  const conditions = [like(options.slugColumn, `${base}%`)];
  if (options.scopeColumn && options.scopeValue) {
    conditions.push(eq(options.scopeColumn, options.scopeValue));
  }
  if (options.excludeId && options.idColumn) {
    conditions.push(ne(options.idColumn, options.excludeId));
  }

  const existing = await db
    .select({ slug: options.slugColumn })
    .from(options.table)
    .where(and(...conditions));

  const taken = new Set(existing.map((r) => r.slug as string));
  if (!taken.has(base)) return base;

  for (let i = 2; ; i++) {
    const candidate = `${base}-${i}`.slice(0, maxLength);
    if (!taken.has(candidate)) return candidate;
  }
};
