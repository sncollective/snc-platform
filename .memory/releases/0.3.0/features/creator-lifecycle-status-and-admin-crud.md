---
id: feature-creator-lifecycle-status-and-admin-crud
kind: feature
stage: done
tags: [creators]
release_binding: 0.3.0
created: 2026-04-18
updated: 2026-04-18
related_decisions: []
related_designs: []
parent: creator-lifecycle
---

## Sub-units (all done)

- [x] Shared types — creator status + admin schemas
- [x] DB schema + migration
- [x] Public API updates — query filtering + route changes
- [x] Admin creator routes
- [x] Archive service
- [x] App wiring
- [x] Admin UI — creator management page

# Design: Creator Lifecycle (Status + Admin CRUD)

## Overview

Add a `status` column (`active | inactive | archived`) to `creator_profiles`, gate all public queries to active-only, move creator creation to admin-only, and build admin CRUD for creator lifecycle management. Archiving a creator removes their content from channel pools.

## Implementation Units

### Unit 1: Shared Types — Creator Status + Admin Schemas

**File**: `packages/shared/src/creator.ts`

Add the status enum following the Single Source of Truth principle — one constant, all types derived:

```typescript
// ── Creator Status ──

export const CREATOR_STATUSES = ["active", "inactive", "archived"] as const;
/** Lifecycle status of a creator profile. */
export type CreatorStatus = (typeof CREATOR_STATUSES)[number];
export const CreatorStatusSchema = z.enum(CREATOR_STATUSES);
```

Update `CreatorProfileResponseSchema` to include status:

```typescript
export const CreatorProfileResponseSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  bio: z.string().nullable(),
  handle: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  bannerUrl: z.string().nullable(),
  socialLinks: z.array(SocialLinkSchema),
  contentCount: z.number().int().min(0),
  status: CreatorStatusSchema,               // ← NEW
  createdAt: z.string(),
  updatedAt: z.string(),
});
```

`CreatorListItemSchema` inherits status via `.extend()` — no changes needed there.

**File**: `packages/shared/src/admin.ts`

Add admin creator schemas:

```typescript
import { CreatorStatusSchema, CreatorProfileResponseSchema } from "./creator.js";
import { createPaginationQuery } from "./pagination.js";

// ── Admin Creator Schemas ──

export const AdminCreatorsQuerySchema = createPaginationQuery({
  max: 100,
  default: 20,
}).extend({
  status: CreatorStatusSchema.optional(),
});

export const AdminCreatorsResponseSchema = z.object({
  items: z.array(CreatorProfileResponseSchema),
  nextCursor: z.string().nullable(),
});

export const AdminCreateCreatorSchema = z.object({
  displayName: z.string().min(1).max(100),
  handle: z
    .string()
    .regex(/^[a-z0-9_-]{3,30}$/, "Handle must be 3–30 characters: lowercase letters, digits, _ or -")
    .optional(),
});

export const UpdateCreatorStatusSchema = z.object({
  status: CreatorStatusSchema,
});

export const AdminCreatorResponseSchema = z.object({
  creator: CreatorProfileResponseSchema,
});

// ── Admin Creator Types ──

export type AdminCreatorsQuery = z.infer<typeof AdminCreatorsQuerySchema>;
export type AdminCreatorsResponse = z.infer<typeof AdminCreatorsResponseSchema>;
export type AdminCreateCreator = z.infer<typeof AdminCreateCreatorSchema>;
export type UpdateCreatorStatus = z.infer<typeof UpdateCreatorStatusSchema>;
export type AdminCreatorResponse = z.infer<typeof AdminCreatorResponseSchema>;
```

**Implementation Notes**:

- `HANDLE_REGEX` already exists in `creator.ts` but is not exported as a standalone regex for use in admin schemas. Inline the regex literal in `AdminCreateCreatorSchema` rather than importing the regex — the admin create schema is independent validation, and the regex is short.
- `CreatorProfileResponseSchema` now includes `status`, so all existing consumers (public list, public detail, admin) get it automatically.

**Acceptance Criteria**:

- [ ] `CREATOR_STATUSES` is the single source of truth — `CreatorStatus` and `CreatorStatusSchema` derive from it
- [ ] `CreatorProfileResponseSchema` includes `status` field
- [ ] Admin schemas validate query params, create body, and status update body
- [ ] `bun run --filter @snc/shared build` passes

---

### Unit 2: DB Schema + Migration

**File**: `apps/api/src/db/schema/creator.schema.ts`

Add `status` column to `creatorProfiles`:

```typescript
import type { SocialLink, CreatorMemberRole, CreatorStatus } from "@snc/shared";

export const creatorProfiles = pgTable(
  "creator_profiles",
  {
    id: text("id").primaryKey(),
    displayName: text("display_name").notNull(),
    bio: text("bio"),
    avatarKey: text("avatar_key"),
    bannerKey: text("banner_key"),
    socialLinks: jsonb("social_links")
      .$type<SocialLink[]>()
      .notNull()
      .default([]),
    handle: text("handle").unique(),
    status: text("status")                       // ← NEW
      .$type<CreatorStatus>()
      .notNull()
      .default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("creator_profiles_status_idx").on(table.status),   // ← NEW
  ],
);
```

**Implementation Notes**:

- Default `"active"` ensures backward compatibility — existing rows get `active` status.
- The table currently has no index function argument (no custom indexes). Add the `(table) => [...]` third argument with the status index.
- After editing the schema, run: `bun run --filter @snc/api db:generate` then `bun run --filter @snc/api db:migrate`. Never hand-write migration SQL.

**Acceptance Criteria**:

- [ ] `status` column exists on `creator_profiles` with NOT NULL + default `'active'`
- [ ] Index `creator_profiles_status_idx` exists
- [ ] Migration generated by drizzle-kit and applied cleanly
- [ ] Existing rows have `status = 'active'`

---

### Unit 3: Public API Updates — Query Filtering + Route Changes

**File**: `apps/api/src/lib/creator-helpers.ts`

Add optional `activeOnly` parameter to `findCreatorProfile`:

```typescript
/** Find a creator profile by UUID or handle, returning undefined when not found. */
export const findCreatorProfile = async (
  identifier: string,
  opts?: { activeOnly?: boolean },
): Promise<CreatorProfileRow | undefined> => {
  const conditions: SQL[] = [
    or(
      eq(creatorProfiles.id, identifier),
      eq(creatorProfiles.handle, identifier),
    ) as SQL,
  ];
  if (opts?.activeOnly) {
    conditions.push(eq(creatorProfiles.status, "active"));
  }
  const rows = await db
    .select()
    .from(creatorProfiles)
    .where(and(...conditions));
  return rows[0];
};
```

Update `toProfileResponse` to include `status`:

```typescript
export const toProfileResponse = (
  profile: CreatorProfileRow,
  contentCount: number,
): CreatorProfileResponse => {
  const urls = resolveCreatorUrls(profile);
  return {
    id: profile.id,
    displayName: profile.displayName,
    bio: profile.bio ?? null,
    handle: profile.handle ?? null,
    avatarUrl: urls.avatarUrl,
    bannerUrl: urls.bannerUrl,
    socialLinks: profile.socialLinks ?? [],
    contentCount,
    status: profile.status,                    // ← NEW
    createdAt: toISO(profile.createdAt),
    updatedAt: toISO(profile.updatedAt),
  };
};
```

Add new import for `and`, `SQL` and `eq` (for status column):

```typescript
import { eq, or, and, isNull, isNotNull, count, type SQL } from "drizzle-orm";
```

**File**: `apps/api/src/routes/creator.routes.ts`

1. **Remove `POST /` route entirely** — creator creation moves to admin routes.
2. **Remove** the `requireRole` import and `CreateCreatorSchema` import (no longer needed here).
3. **Remove** the `generateUniqueSlug` import (no longer needed here).
4. **GET `/`** (list) — add `eq(creatorProfiles.status, "active")` to the query WHERE clause:

```typescript
// In the list handler, before cursor conditions:
const conditions: SQL[] = [eq(creatorProfiles.status, "active")];

if (cursor) {
  const decoded = decodeCursor(cursor, {
    timestampField: "createdAt",
    idField: "id",
  });
  conditions.push(
    buildCursorCondition(creatorProfiles.createdAt, creatorProfiles.id, decoded, "desc"),
  );
}

const rows = await db
  .select()
  .from(creatorProfiles)
  .where(and(...conditions))
  .orderBy(desc(creatorProfiles.createdAt), desc(creatorProfiles.id))
  .limit(limit + 1);
```

5. **GET `/:creatorId`** (detail) — pass `{ activeOnly: true }`:

```typescript
const profile = await findCreatorProfile(creatorId, { activeOnly: true });
```

6. **PATCH `/:creatorId`** (update) — keep finding without `activeOnly` so admins/members can edit inactive creators:

```typescript
const profile = await findCreatorProfile(creatorId);
```

**File**: `apps/api/src/routes/content.routes.ts`

Add status filter to content feed queries. Where the feed list query does `innerJoin(creatorProfiles, ...)`:

```typescript
// Add to the conditions array before the query:
conditions.push(eq(creatorProfiles.status, "active"));
```

This applies to:
- The public feed endpoint (`GET /api/content` feed query, ~line 157)
- The draft content endpoint already requires auth + creator permission, so no status filter needed there

For the content detail endpoint (`GET /api/content/:id`), add a post-fetch check:

```typescript
// After fetching the joined content+creator row:
if (row.creatorStatus !== "active") {
  throw new NotFoundError("Content not found");
}
```

This requires adding `creatorStatus: creatorProfiles.status` to `CONTENT_FEED_COLUMNS` (around line 49). The type `FeedRow` will pick this up automatically.

**Implementation Notes**:

- The `batchGetContentCounts()`, `batchGetSubscriberCounts()`, and `batchGetLastPublished()` in `creator-list.ts` don't need changes — they receive pre-filtered creator IDs from the list handler.
- The `searchAvailableContent()` raw SQL in `playout-orchestrator.ts` uses `LEFT JOIN creator_profiles`. It searches by title and doesn't filter by creator status — this is admin-facing, so showing archived creator content in search is correct (admins may re-add it).

**Acceptance Criteria**:

- [ ] `POST /api/creators` route removed from `creator.routes.ts`
- [ ] `GET /api/creators` returns only active creators
- [ ] `GET /api/creators/:creatorId` returns 404 for inactive/archived creators
- [ ] `PATCH /api/creators/:creatorId` works for any status (admin/member can edit)
- [ ] Content feed excludes content from non-active creators
- [ ] Content detail returns 404 for content from non-active creators
- [ ] `toProfileResponse` includes `status` in output

---

### Unit 4: Admin Creator Routes

**File**: `apps/api/src/routes/admin-creators.routes.ts` (new file)

Create a dedicated route file for admin creator management. Mount via `app.route("/api/admin/creators", adminCreatorRoutes)` in `app.ts`.

```typescript
import { randomUUID } from "node:crypto";

import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { eq, desc, and, type SQL } from "drizzle-orm";

import {
  AdminCreatorsQuerySchema,
  AdminCreatorsResponseSchema,
  AdminCreatorResponseSchema,
  AdminCreateCreatorSchema,
  UpdateCreatorStatusSchema,
  NotFoundError,
  ValidationError,
  AppError,
} from "@snc/shared";
import type {
  AdminCreatorsQuery,
  AdminCreateCreator,
  UpdateCreatorStatus,
  CreatorStatus,
} from "@snc/shared";

import { db } from "../db/connection.js";
import { creatorProfiles } from "../db/schema/creator.schema.js";
import { requireAuth } from "../middleware/require-auth.js";
import { requireRole } from "../middleware/require-role.js";
import type { AuthEnv } from "../middleware/auth-env.js";
import { ERROR_400, ERROR_401, ERROR_403, ERROR_404 } from "../lib/openapi-errors.js";
import {
  buildCursorCondition,
  buildPaginatedResponse,
  decodeCursor,
} from "../lib/cursor.js";
import { toISO } from "../lib/response-helpers.js";
import { getClientIp } from "../lib/request-helpers.js";
import { generateUniqueSlug } from "../services/slug.js";
import { toProfileResponse, getContentCount } from "../lib/creator-helpers.js";
import { archiveCreator } from "../services/creator-lifecycle.js";
import { rootLogger } from "../logging/logger.js";
import { CreatorIdParam } from "./route-params.js";
import {
  batchGetContentCounts,
} from "../services/creator-list.js";

/** Admin creator lifecycle management: list, create, change status. */
export const adminCreatorRoutes = new Hono<AuthEnv>();
```

#### GET `/` — List all creators (admin)

```typescript
adminCreatorRoutes.get(
  "/",
  requireAuth,
  requireRole("admin"),
  describeRoute({
    description: "List all creators with status (admin only, cursor-paginated)",
    tags: ["admin"],
    responses: {
      200: {
        description: "Paginated creator list",
        content: {
          "application/json": { schema: resolver(AdminCreatorsResponseSchema) },
        },
      },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
    },
  }),
  validator("query", AdminCreatorsQuerySchema),
  async (c) => {
    const { limit, cursor, status } =
      c.req.valid("query" as never) as AdminCreatorsQuery;

    const conditions: SQL[] = [];

    if (status) {
      conditions.push(eq(creatorProfiles.status, status));
    }

    if (cursor) {
      const decoded = decodeCursor(cursor, {
        timestampField: "createdAt",
        idField: "id",
      });
      conditions.push(
        buildCursorCondition(
          creatorProfiles.createdAt,
          creatorProfiles.id,
          decoded,
          "desc",
        ),
      );
    }

    const rows = await db
      .select()
      .from(creatorProfiles)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(creatorProfiles.createdAt), desc(creatorProfiles.id))
      .limit(limit + 1);

    const { items: rawRows, nextCursor } = buildPaginatedResponse(
      rows,
      limit,
      (last) => ({
        createdAt: last.createdAt.toISOString(),
        id: last.id,
      }),
    );

    const countMap = await batchGetContentCounts(rawRows.map((r) => r.id));
    const items = rawRows.map((row) =>
      toProfileResponse(row, countMap.get(row.id) ?? 0),
    );

    return c.json({ items, nextCursor });
  },
);
```

#### POST `/` — Create creator (admin)

```typescript
adminCreatorRoutes.post(
  "/",
  requireAuth,
  requireRole("admin"),
  describeRoute({
    description: "Create a new creator as inactive (admin only)",
    tags: ["admin"],
    responses: {
      201: {
        description: "Creator created",
        content: {
          "application/json": { schema: resolver(AdminCreatorResponseSchema) },
        },
      },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
    },
  }),
  validator("json", AdminCreateCreatorSchema),
  async (c) => {
    const body = c.req.valid("json") as AdminCreateCreator;

    if (body.handle) {
      const existing = await db
        .select({ id: creatorProfiles.id })
        .from(creatorProfiles)
        .where(eq(creatorProfiles.handle, body.handle));
      if (existing.length > 0) {
        throw new ValidationError(`Handle '${body.handle}' is already taken`);
      }
    }

    const id = randomUUID();
    const now = new Date();

    const [inserted] = await db
      .insert(creatorProfiles)
      .values({
        id,
        displayName: body.displayName,
        handle:
          body.handle ??
          (await generateUniqueSlug(body.displayName, {
            table: creatorProfiles,
            slugColumn: creatorProfiles.handle,
            maxLength: 30,
            fallbackPrefix: "creator",
          })),
        status: "inactive",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (!inserted) {
      throw new AppError("INSERT_FAILED", "Failed to create creator profile", 500);
    }

    const logger = c.var?.logger ?? rootLogger;
    logger.info(
      {
        event: "creator_created",
        actorId: c.get("user").id,
        creatorId: id,
        ip: getClientIp(c),
      },
      "Admin created creator",
    );

    return c.json({ creator: toProfileResponse(inserted, 0) }, 201);
  },
);
```

#### PATCH `/:creatorId/status` — Change creator status

```typescript
adminCreatorRoutes.patch(
  "/:creatorId/status",
  requireAuth,
  requireRole("admin"),
  describeRoute({
    description: "Change creator status (admin only). Archiving removes content from channel pools.",
    tags: ["admin"],
    responses: {
      200: {
        description: "Creator with updated status",
        content: {
          "application/json": { schema: resolver(AdminCreatorResponseSchema) },
        },
      },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
    },
  }),
  validator("param", CreatorIdParam),
  validator("json", UpdateCreatorStatusSchema),
  async (c) => {
    const { creatorId } = c.req.valid("param" as never) as { creatorId: string };
    const { status } = c.req.valid("json") as UpdateCreatorStatus;

    const [existing] = await db
      .select()
      .from(creatorProfiles)
      .where(eq(creatorProfiles.id, creatorId));

    if (!existing) {
      throw new NotFoundError("Creator not found");
    }

    // Archive side effects
    if (status === "archived" && existing.status !== "archived") {
      await archiveCreator(creatorId);
    }

    const [updated] = await db
      .update(creatorProfiles)
      .set({ status, updatedAt: new Date() })
      .where(eq(creatorProfiles.id, creatorId))
      .returning();

    const logger = c.var?.logger ?? rootLogger;
    logger.info(
      {
        event: "creator_status_changed",
        actorId: c.get("user").id,
        creatorId,
        previousStatus: existing.status,
        newStatus: status,
        ip: getClientIp(c),
      },
      "Admin changed creator status",
    );

    const contentCount = await getContentCount(creatorId);
    return c.json({ creator: toProfileResponse(updated!, contentCount) });
  },
);
```

**Implementation Notes**:

- Status change looks up by `creatorProfiles.id` only (not handle). The `CreatorIdParam` route param validates the UUID.
- Archive side effects run BEFORE the status update so `archiveCreator()` can query content while the creator is still in its previous state.
- No hard deletes — the most destructive operation is archive, which removes pool entries but preserves all content rows.

**Acceptance Criteria**:

- [ ] `GET /api/admin/creators` lists all creators with optional status filter
- [ ] `GET /api/admin/creators?status=inactive` filters to inactive only
- [ ] `POST /api/admin/creators` creates with `status: "inactive"`, no member row
- [ ] `PATCH /api/admin/creators/:creatorId/status` changes status
- [ ] Archiving triggers content pool cleanup
- [ ] All admin routes require auth + admin role
- [ ] All mutations log audit events

---

### Unit 5: Archive Service

**File**: `apps/api/src/services/creator-lifecycle.ts` (new file)

```typescript
import { eq, and, inArray } from "drizzle-orm";

import { db } from "../db/connection.js";
import { content } from "../db/schema/content.schema.js";
import { channelContent } from "../db/schema/playout-queue.schema.js";
import { rootLogger } from "../logging/logger.js";

/**
 * Remove a creator's content from all channel content pools.
 *
 * Deletes `channel_content` rows where `contentId` belongs to the given creator.
 * Content rows themselves are preserved — only pool associations are removed.
 * Playout items (which have no creator FK) are not affected.
 */
export async function archiveCreator(creatorId: string): Promise<void> {
  // Find all content IDs owned by this creator
  const contentRows = await db
    .select({ id: content.id })
    .from(content)
    .where(eq(content.creatorId, creatorId));

  const contentIds = contentRows.map((r) => r.id);

  if (contentIds.length === 0) return;

  // Remove from channel pools
  const result = await db
    .delete(channelContent)
    .where(inArray(channelContent.contentId, contentIds));

  rootLogger.info(
    { event: "creator_archived_pool_cleanup", creatorId, contentCount: contentIds.length },
    "Removed creator content from channel pools",
  );
}
```

**Implementation Notes**:

- Two queries: first find content IDs, then delete pool entries. A single subquery DELETE would be more efficient but less readable and harder to log counts.
- Only `channelContent` rows with `contentId` are affected — `playoutItemId` entries are standalone admin media and have no creator relationship.
- Content rows are preserved. Manually re-adding content to a pool (via the orchestrator's `assignContent`) works after restoring the creator.

**Acceptance Criteria**:

- [ ] Archiving a creator with 3 content items in 2 channel pools removes all pool entries
- [ ] Archiving a creator with no content is a no-op
- [ ] Content rows remain after archive
- [ ] Playout item pool entries are untouched

---

### Unit 6: App Wiring

**File**: `apps/api/src/app.ts`

Add the new admin creator routes:

```typescript
import { adminCreatorRoutes } from "./routes/admin-creators.routes.js";

// Mount after existing admin routes:
app.route("/api/admin/creators", adminCreatorRoutes);
```

**Acceptance Criteria**:

- [ ] Admin creator routes accessible at `/api/admin/creators`
- [ ] No conflicts with existing `/api/admin` routes

---

### Unit 7: Admin UI — Creator Management Page

**File**: `apps/web/src/lib/admin.ts`

Add admin creator client functions:

```typescript
import type {
  AdminCreatorsResponse,
  AdminCreatorsQuery,
  AdminCreatorResponse,
  AdminCreateCreator,
  UpdateCreatorStatus,
} from "@snc/shared";

import { apiGet, apiMutate } from "./fetch-utils.js";

/** Fetch paginated admin creator list. */
export async function listAdminCreators(
  params?: Partial<AdminCreatorsQuery>,
): Promise<AdminCreatorsResponse> {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.cursor) searchParams.set("cursor", params.cursor);
  if (params?.status) searchParams.set("status", params.status);
  const qs = searchParams.toString();
  return apiGet<AdminCreatorsResponse>(`/api/admin/creators${qs ? `?${qs}` : ""}`);
}

/** Create a new creator profile (admin only). */
export async function createCreator(
  data: AdminCreateCreator,
): Promise<AdminCreatorResponse> {
  return apiMutate<AdminCreatorResponse>("/api/admin/creators", {
    method: "POST",
    body: data,
  });
}

/** Change a creator's lifecycle status (admin only). */
export async function updateCreatorStatus(
  creatorId: string,
  data: UpdateCreatorStatus,
): Promise<AdminCreatorResponse> {
  return apiMutate<AdminCreatorResponse>(
    `/api/admin/creators/${encodeURIComponent(creatorId)}/status`,
    { method: "PATCH", body: data },
  );
}
```

**File**: `apps/web/src/routes/admin/creators.tsx`

Rewrite the admin creators page with status display, filtering, creation form, and status actions.

```typescript
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import type React from "react";

import type { CreatorProfileResponse, CreatorStatus } from "@snc/shared";
import { CREATOR_STATUSES } from "@snc/shared";

import { RouteErrorBoundary } from "../../components/error/route-error-boundary.js";
import { fetchApiServer } from "../../lib/api-server.js";
import { listAdminCreators, createCreator, updateCreatorStatus } from "../../lib/admin.js";
import listingStyles from "../../styles/listing-page.module.css";
```

**Loader**: Fetch creators from admin endpoint (server-side):

```typescript
interface AdminCreatorsLoaderData {
  readonly creators: readonly CreatorProfileResponse[];
}

export const Route = createFileRoute("/admin/creators")({
  head: () => ({ meta: [{ title: "Creators — Admin — S/NC" }] }),
  errorComponent: RouteErrorBoundary,
  loader: async (): Promise<AdminCreatorsLoaderData> => {
    const data = await fetchApiServer({ data: "/api/admin/creators?limit=100" });
    return { creators: (data as { items: CreatorProfileResponse[] }).items };
  },
  component: AdminCreatorsPage,
});
```

**Component**: Status badges, filter, create form, status actions:

```typescript
function AdminCreatorsPage(): React.ReactElement {
  const { creators: initialCreators } = Route.useLoaderData();
  const [creators, setCreators] = useState<readonly CreatorProfileResponse[]>(initialCreators);
  const [statusFilter, setStatusFilter] = useState<CreatorStatus | "all">("all");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = statusFilter === "all"
    ? creators
    : creators.filter((c) => c.status === statusFilter);

  // handleCreate: POST to admin API, prepend to local list
  // handleStatusChange: PATCH status, update local list
  // Status badge: colored chip per status (active=green, inactive=gray, archived=red)
  // Status actions: dropdown or buttons per row

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 className={listingStyles.heading}>Creators</h1>
        <button onClick={() => setShowCreateForm(true)}>Create Creator</button>
      </div>

      {/* Status filter tabs */}
      <div>
        {(["all", ...CREATOR_STATUSES] as const).map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            data-active={statusFilter === s}>
            {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Create form (inline, toggleable) */}
      {showCreateForm && (
        <form onSubmit={handleCreate}>
          <input value={newName} onChange={(e) => setNewName(e.target.value)}
            placeholder="Display name" required />
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create"}
          </button>
          <button type="button" onClick={() => setShowCreateForm(false)}>Cancel</button>
        </form>
      )}

      {/* Creator list with status badges and actions */}
      {filtered.length === 0 ? (
        <p className={listingStyles.status}>No creators found.</p>
      ) : (
        <ul>
          {filtered.map((c) => (
            <li key={c.id}>
              <Link to="/creators/$creatorId/manage" params={{ creatorId: c.handle ?? c.id }}>
                {c.displayName}
              </Link>
              <StatusBadge status={c.status} />
              <StatusActions creator={c} onStatusChange={handleStatusChange} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

**Implementation Notes**:

- `StatusBadge` is a small inline component rendering a colored chip.
- `StatusActions` renders contextual buttons: "Activate" for inactive, "Deactivate" / "Archive" for active, "Restore" for archived.
- Archive action should show a browser `confirm()` dialog before proceeding.
- `handleCreate` calls `createCreator()`, adds to local state, clears form.
- `handleStatusChange` calls `updateCreatorStatus()`, updates local state.
- Full CSS module styling is deferred — use inline styles for the initial implementation, then extract to a CSS module in a polish pass.

**Acceptance Criteria**:

- [ ] Admin creators page loads all creators (not just active)
- [ ] Status filter tabs work (All / Active / Inactive / Archived)
- [ ] Create form creates an inactive creator and adds it to the list
- [ ] Status change buttons update the creator's status
- [ ] Archive shows confirmation dialog
- [ ] Status badges display correct color per state

---

## Implementation Order

1. **Unit 1**: Shared types — builds first since all other units import from `@snc/shared`
2. **Unit 2**: DB schema + migration — schema must exist before queries reference `status`
3. **Unit 3**: Public API updates — `findCreatorProfile`, `toProfileResponse`, query filtering, remove POST
4. **Unit 5**: Archive service — needed by Unit 4
5. **Unit 4**: Admin creator routes — depends on shared types, schema, helpers, archive service
6. **Unit 6**: App wiring — mount the new routes
7. **Unit 7**: Admin UI + client — depends on admin routes being available

## Testing

### Unit Tests: `apps/api/tests/routes/admin-creators.routes.test.ts` (new file)

Follow the `setupRouteTest()` pattern from existing admin tests. Use `vi.doMock()` for db, middleware. Use `chainablePromise()` from `db-mock-utils.ts`.

**Key test cases:**

```
describe("GET /api/admin/creators")
  it("returns paginated creator list with status")
  it("filters by status query param")
  it("returns 401 without auth")
  it("returns 403 without admin role")

describe("POST /api/admin/creators")
  it("creates creator with inactive status and no member row")
  it("auto-generates handle from displayName")
  it("rejects duplicate handles")
  it("returns 401/403 for non-admin")
  it("logs audit event")

describe("PATCH /api/admin/creators/:creatorId/status")
  it("changes status from inactive to active")
  it("changes status from active to archived and runs cleanup")
  it("changes status from archived to active (restore)")
  it("returns 404 for unknown creator")
  it("logs audit event with previous and new status")
```

### Unit Tests: `apps/api/tests/services/creator-lifecycle.test.ts` (new file)

Test the `archiveCreator()` function with mock DB:

```
describe("archiveCreator")
  it("deletes channel_content rows for creator's content")
  it("no-ops when creator has no content")
  it("does not delete playout item pool entries")
  it("logs cleanup event")
```

### Existing Test Updates

- `apps/api/tests/routes/creator.routes.test.ts` — Remove tests for `POST /api/creators`. Update `GET` tests to verify active-only filtering. Update response shape assertions to include `status`.
- `apps/api/tests/routes/content.routes.test.ts` — Add mock creator status to feed query mocks. Verify content from non-active creators is excluded.
- `apps/api/tests/helpers/creator-fixtures.ts` — Add `status: "active"` to `makeMockDbCreatorProfile` defaults.

## Verification Checklist

```bash
# 1. Build shared package (types must compile)
bun run --filter @snc/shared build

# 2. Generate and run migration
bun run --filter @snc/api db:generate
bun run --filter @snc/api db:migrate

# 3. Run all tests
bun run --filter @snc/shared test
bun run --filter @snc/api test:unit
bun run --filter @snc/web test

# 4. Restart dev servers and verify
pm2 restart all

# 5. Manual verification
# - GET /api/creators returns only active creators
# - GET /api/admin/creators returns all creators with status
# - POST /api/admin/creators creates inactive creator
# - PATCH /api/admin/creators/:id/status changes status
# - Archiving removes content from channel pools
# - Admin UI shows status badges, filter, create form
```
