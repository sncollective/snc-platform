import { and, eq, like, ne } from "drizzle-orm";
import type { PgTableWithColumns, TableConfig } from "drizzle-orm/pg-core";

import { db } from "../db/connection.js";

// ── Public Helpers ──

export const toSlug = (name: string, maxLength = 80): string =>
  name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, maxLength);

export const generateUniqueSlug = async (
  name: string,
  options: {
    table: PgTableWithColumns<TableConfig>;
    slugColumn: any;
    scopeColumn?: any;
    scopeValue?: string;
    excludeId?: string;
    idColumn?: any;
    maxLength?: number;
    fallbackPrefix?: string;
  },
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

  const taken = new Set(existing.map((r: { slug: string }) => r.slug));
  if (!taken.has(base)) return base;

  for (let i = 2; ; i++) {
    const candidate = `${base}-${i}`.slice(0, maxLength);
    if (!taken.has(candidate)) return candidate;
  }
};
