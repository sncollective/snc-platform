import { z } from "zod";

// ── Pagination Query Factory ──

/**
 * Creates a pagination query schema with cursor + limit fields.
 * The `limit` field uses `z.coerce.number()` to handle string query params.
 */
export function createPaginationQuery({
  max = 50,
  default: defaultLimit = 20,
}: {
  max?: number;
  default?: number;
} = {}) {
  return z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(max).default(defaultLimit),
  });
}

// ── Public Types ──

export type PaginationQuery = z.infer<ReturnType<typeof createPaginationQuery>>;
