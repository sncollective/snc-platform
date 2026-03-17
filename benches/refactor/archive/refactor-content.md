> **Archived**: 2026-03-09
> **Validation**: All tests passing, no cross-finding regressions

# Refactor Analysis: Content Domain (Vertical Slice)

> **Generated**: 2026-03-09
> **Scope**: Full content vertical slice — 42 files across shared schema, API (routes, services, DB schema, tests), web (lib, components, routes, tests), and cross-domain consumers (landing page, creator detail, settings)
> **Libraries researched**: Hono v4.12, Drizzle ORM v0.45, Vitest v4, Zod v4.3

---

## Executive Summary

The content domain is the largest vertical slice in the platform, spanning 42 files from shared Zod schemas through API routes and services to 10 web components, 2 web routes, and a settings page with a content creation form. The vertical slice lens surfaced three key findings horizontal analysis would miss: (1) `lib/content.ts` exports `fetchMyContent` which is dead surface — the only consumer (`MyContentList`) uses `useCursorPagination` directly, (2) `ContentForm` uses `zod/mini` with constraints that match the server schema but defines them locally rather than importing shared constants, and (3) the content routes file has three stream-file handlers (`/media`, `/thumbnail`, `/cover-art`) with structurally identical 25-line bodies that differ only in the storage key field, error message, and cache-control header — a clear extraction candidate. No P0 issues found. 7 findings across P1–P3.

---

## P0 — Fix Now

None found.

---

## P1 — High Value

### 1. Three stream-file handlers are near-identical (intra-file duplication)

- **Affected files**: `apps/api/src/routes/content.routes.ts:574-695`
- **Current state**: The three GET handlers for `/:id/media`, `/:id/thumbnail`, and `/:id/cover-art` share the same 5-step structure: (1) find active content, (2) check the relevant key field, (3) optionally run access gating, (4) call `streamFile`. Each handler is ~25 lines. The `thumbnail` and `cover-art` handlers are virtually identical (differ only in `row.thumbnailKey` vs `row.coverArtKey`, the error message, and the `describeRoute` metadata). The `media` handler adds an access-gating block for subscriber content.

  ```typescript
  // /:id/thumbnail (lines 629-661) and /:id/cover-art (lines 663-695) differ only in:
  //   - row.thumbnailKey vs row.coverArtKey
  //   - "No thumbnail uploaded" vs "No cover art uploaded"
  //   - "Thumbnail file not found" vs "Cover art file not found"
  ```

- **Proposed consolidation**: Extract a private `streamContentFile(c, id, field, cacheControl)` helper that encapsulates the find-content + check-key + streamFile sequence. The media handler extends this by adding the access-gating block before calling `streamFile`. This reduces three ~25-line handlers to one ~20-line helper + three 5-line handler stubs.
- **Estimated scope**: 1 file changed, ~35 LOC net reduction
- **Pattern reference**: `route-private-helpers` — logic repeated in 2+ handlers in the same route file should be extracted to a private helper
- **Tests affected**: `apps/api/tests/routes/content.routes.test.ts` — no changes needed (tests call HTTP endpoints, not the helper)
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

### 2. Duplicate subscription-query logic between `checkContentAccess` and `buildContentAccessContext`

- **Affected files**: `apps/api/src/services/content-access.ts:76-113` and `apps/api/src/services/content-access.ts:170-201`
- **Current state**: The subscription lookup query appears twice in the file — once in `buildContentAccessContext` (batch, selects `planType`/`planCreatorId` without `.limit()`) and once in `checkContentAccess` (per-item, selects `id` with `.limit(1)` and an extra `creatorId` filter). Both share the same status filter (`active` OR `canceled` with future period end) and the same join. The core WHERE clause (lines 88-99 vs 180-200) is structurally duplicated.
- **Proposed consolidation**: Extract a private `buildSubscriptionStatusCondition()` helper that returns the shared `or(eq(status, "active"), and(eq(status, "canceled"), gt(periodEnd, now)))` expression. Both functions import and compose it. This is a pure Drizzle expression — no DB call.
- **Estimated scope**: 1 file changed, ~10 LOC net reduction
- **Pattern reference**: `route-private-helpers` — same business concept (subscription status filter) expressed in two places
- **Tests affected**: `apps/api/tests/services/content-access.test.ts` — no changes needed (tests verify behavior, not implementation)
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

---

## P2 — Medium Value

### 3. Dead API surface in `lib/content.ts` — `fetchMyContent` is unused

- **Location**: `apps/web/src/lib/content.ts:26-35`
- **Affected files**: `apps/web/src/lib/content.ts`
- **Issue**: `fetchMyContent(creatorId, cursor)` wraps `apiGet<FeedResponse>("/api/content", { creatorId, limit: 12, cursor })`. However, `MyContentList` (the only component showing a user's own content) uses `useCursorPagination` with a `buildUrl` callback that constructs the URL directly (lines 23-29 of `my-content-list.tsx`). This matches the same dead-surface pattern found in the booking domain (Finding #1 of `refactor-booking.md`).
- **Suggestion**: Remove `fetchMyContent` from `lib/content.ts`. If a non-paginated "my content" fetch is needed later, re-add it then (YAGNI). Note: there is no corresponding test file for `lib/content.ts` tests, so no test removal is needed.
- **Tests affected**: None — no test file exists for `lib/content.ts`
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

### 4. Validation constants not imported from `@snc/shared` in ContentForm

- **Location**: `apps/web/src/components/content/content-form.tsx:22-28` vs `packages/shared/src/content.ts:13-19`
- **Affected files**: `packages/shared/src/content.ts`, `apps/web/src/components/content/content-form.tsx`
- **Issue**: The server-side `CreateContentSchema` uses `z.string().min(1).max(200)` for title and `z.string().max(2000)` for description. The client-side `FormSchema` uses `z.minLength(1, ...)`, `z.maxLength(200)` for title and `z.maxLength(2000)` for description. The numeric limits match but are defined locally in both places. Per the `shared-validation-constants` pattern, these should be exported as named constants from `@snc/shared` so both sides reference the same values.
- **Suggestion**: Export `MAX_TITLE_LENGTH = 200` and `MAX_DESCRIPTION_LENGTH = 2000` from `packages/shared/src/content.ts`. Import in both `CreateContentSchema`/`UpdateContentSchema` and the client `FormSchema`. Also use these in the HTML `maxLength` attributes on the form inputs (lines 196, 215).
- **Tests affected**: None — values don't change, only where they're defined
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

### 5. `useCursorPagination` drops structured error messages on HTTP errors (cross-domain, shared with booking)

- **Location**: `apps/web/src/hooks/use-cursor-pagination.ts:47-49`
- **Affected files**: `apps/web/src/hooks/use-cursor-pagination.ts`, indirectly `routes/feed.tsx`, `components/content/my-content-list.tsx`
- **Issue**: When the API returns an error HTTP status, the hook sets `setError("Failed to load")` — a hardcoded generic message. The same finding was documented in `refactor-booking.md` (Finding #3). This affects the content feed page (`feed.tsx`) and `MyContentList` — users see "Failed to load" instead of specific messages like "Unauthorized" for session expiry.
- **Suggestion**: Extract the error message from the response body using the same logic as `throwIfNotOk` in `fetch-utils.ts`. This is a cross-domain fix that benefits all consumers.
- **Tests affected**: `apps/web/tests/unit/routes/feed.test.tsx` — add a test for the error HTTP response case
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09 (cross-domain fix applied during booking scope — see `refactor-booking.md` Finding #3)

---

## P3 — Nice-to-Have

- **`content-card.module.css` hardcodes shadow** — `apps/web/src/components/content/content-card.module.css:17` uses `rgba(0, 0, 0, 0.3)` for hover shadow instead of `var(--shadow-dropdown)` design token
- **`content-card.module.css` hardcodes lock overlay background** — `apps/web/src/components/content/content-card.module.css:83` uses `rgba(0, 0, 0, 0.6)` instead of a design token
- **Feed page casts query result** — `apps/api/src/routes/content.routes.ts:247` uses `as FeedRow[]` cast on the Drizzle select result. The cast is needed because the `innerJoin` + custom `select()` returns an inferred type that doesn't include `creatorName` as a property of `ContentRow`. A `FeedRow` Drizzle view or a narrower pick-type would be safer.
- **`WrittenDetail` uses array index as key** — `apps/web/src/components/content/written-detail.tsx:55-57,81-83` uses `key={index}` for paragraphs. Since paragraphs are derived from splitting body text and never reorder, this is safe but flagged as a common React lint issue.
- **`content-form.tsx` uses `as ContentType`/`as Visibility` casts** — `apps/web/src/components/content/content-form.tsx:167,240` uses `e.target.value as ContentType` and `as Visibility` for select onChange handlers. These are safe because the select options are derived from the shared const arrays, but the casts could be eliminated by using a typed onChange utility.
- **Missing test for `ContentForm` component** — `apps/web/tests/unit/components/content-form*` does not exist. The form has client-side validation logic, file upload handling, and multi-step submit that would benefit from unit tests.
- **Missing test for `MyContentList` component** — `apps/web/tests/unit/components/my-content*` does not exist. The component uses `useCursorPagination` which other listing components have tested.

---

## Skip — Intentional Patterns

| Pattern | Location | Why it stays |
|---------|----------|-------------|
| `row.type as ContentType` / `row.visibility as Visibility` casts | `content.routes.ts:64,68` | Known-safe Drizzle enum erasure; return type `ContentResponse` enforces correctness |
| `c.req.valid("query" as never) as FeedQuery` | `content.routes.ts:178` | Known hono-openapi limitation tracked upstream (#145, #192) |
| `c.req.valid("query" as never) as { field: UploadField }` | `content.routes.ts:482` | Same hono-openapi limitation |
| Date vs ISO string in dual-layer fixtures | API/web fixture files | Intentional per `dual-layer-fixtures` pattern — each layer matches its data format |
| Private transformers not shared across files | `content.routes.ts:61-81` | Correct per `row-to-response-transformer` pattern — each route file owns its transformers |
| `feed.tsx` using `fetchApiServer` instead of `lib/content.ts` | `routes/feed.tsx:16-18` | Correct per SSR loader pattern — loaders use server-side fetch with cookie forwarding |
| `useCursorPagination` `as` cast on JSON response | `use-cursor-pagination.ts:51-52` | Generic hook design; type parameter `T` provides the type safety |
| `as Partial<typeof content.$inferInsert>` in upload handler | `content.routes.ts:562` | Computed property key `[keyColumn]` loses Drizzle type narrowing; cast is a workaround |
| Mutating `item.mediaUrl`/`item.body` in feed gating | `content.routes.ts:261-262` | The `resolveContentUrls` returns a fresh object each time; mutation is on the copy, not the DB row |

---

## Cross-Layer Continuity

### Schema-Transformer Alignment

| Shared Schema | Transformer | Status | Notes |
|---------------|-------------|--------|-------|
| `ContentResponseSchema.id` | `resolveContentUrls → id` | **Aligned** | Direct pass-through |
| `ContentResponseSchema.creatorId` | `resolveContentUrls → creatorId` | **Aligned** | Direct pass-through |
| `ContentResponseSchema.type` | `resolveContentUrls → type` | **Aligned** | `row.type as ContentType` cast; safe (Drizzle text → union) |
| `ContentResponseSchema.title` | `resolveContentUrls → title` | **Aligned** | Direct pass-through |
| `ContentResponseSchema.body` | `resolveContentUrls → body` | **Aligned** | `?? null` for nullable field |
| `ContentResponseSchema.description` | `resolveContentUrls → description` | **Aligned** | `?? null` for nullable field |
| `ContentResponseSchema.visibility` | `resolveContentUrls → visibility` | **Aligned** | `row.visibility as Visibility` cast; safe |
| `ContentResponseSchema.thumbnailUrl` | `resolveContentUrls → thumbnailUrl` | **Aligned** | Derived from `thumbnailKey` → URL path |
| `ContentResponseSchema.mediaUrl` | `resolveContentUrls → mediaUrl` | **Aligned** | Derived from `mediaKey` → URL path |
| `ContentResponseSchema.coverArtUrl` | `resolveContentUrls → coverArtUrl` | **Aligned** | Derived from `coverArtKey` → URL path |
| `ContentResponseSchema.publishedAt` | `resolveContentUrls → publishedAt` | **Aligned** | `?.toISOString() ?? null` for nullable date |
| `ContentResponseSchema.createdAt` | `resolveContentUrls → createdAt` | **Aligned** | `.toISOString()` conversion |
| `ContentResponseSchema.updatedAt` | `resolveContentUrls → updatedAt` | **Aligned** | `.toISOString()` conversion |
| `FeedItemSchema.creatorName` | `resolveFeedItem → creatorName` | **Aligned** | Composed from `resolveContentUrls` + `creatorName` from JOIN |

The `resolveContentUrls` return type is explicitly annotated as `ContentResponse` from `@snc/shared`, making this TS-enforced. The `resolveFeedItem` return type is `FeedItem`, also TS-enforced. No drift risk.

### Validation Sync

| Field | Server Rule | Client Rule | Status |
|-------|-------------|-------------|--------|
| `title` | `z.string().min(1).max(200)` | `z.string().check(z.minLength(1, ...), z.maxLength(200))` | **Synced** — same constraints, different syntax (Zod vs zod/mini) |
| `type` | `z.enum(CONTENT_TYPES)` | `z.enum(CONTENT_TYPES)` — imported from `@snc/shared` | **Synced** — shared constant |
| `description` | `z.string().max(2000).optional()` | `z.optional(z.string().check(z.maxLength(2000)))` | **Synced** — same max length |
| `visibility` | `z.enum(VISIBILITY).default("public")` | `z.enum(VISIBILITY)` — imported from `@snc/shared` | **Synced** — shared enum |
| `body` | `z.string().optional()` | `z.optional(z.string())` | **Synced** — server has additional runtime check for written content |
| `MAX_TITLE_LENGTH` constant | Inline `200` | Inline `200` + HTML `maxLength={200}` | **Drift risk** — not imported from `@snc/shared` (Finding #4) |
| `MAX_DESCRIPTION_LENGTH` constant | Inline `2000` | Inline `2000` + HTML `maxLength={2000}` | **Drift risk** — not imported from `@snc/shared` (Finding #4) |
| `CONTENT_TYPES` | Shared const | Imported from `@snc/shared` | **Synced** |
| `VISIBILITY` | Shared const | Imported from `@snc/shared` | **Synced** |
| `ACCEPTED_MIME_TYPES` | Imported from `@snc/shared` in routes | Imported from `@snc/shared` in form | **Synced** |
| Written body required check | `if (body.type === "written" && !body.body)` in route | `if (type === "written" && !body.trim())` in form | **Synced** — client and server both enforce |

### Error Path Coverage

| Error | API Route | Web Consumer | UI Treatment |
|-------|-----------|--------------|--------------|
| `NotFoundError("Content not found")` | `content.routes:106,345,405-407,566-568` | `content/$contentId.tsx` (via loader) | Loader throws → TanStack error boundary shows error |
| `ForbiddenError("Not the content owner")` | `content.routes:110` | `ContentForm` (via `createContent`/`uploadContentFile`) | Shows server error message in `role="alert"` |
| `ValidationError("Body is required for written content")` | `content.routes:297` | `ContentForm` (client validates first) | Client catches before server; server error shows in `role="alert"` |
| `ValidationError("No file provided")` | `content.routes:511` | `ContentForm` (via `uploadContentFile`) | Shows server error message in `role="alert"` |
| `ValidationError("File size exceeds...")` | `content.routes:501,516` | `ContentForm` (via `uploadContentFile`) | Shows server error message in `role="alert"` |
| `ValidationError("Invalid MIME type...")` | `content.routes:523` | `ContentForm` (via `uploadContentFile`) | Shows server error message in `role="alert"` |
| `ValidationError("Written content does not support media uploads")` | `content.routes:148` | `ContentForm` (form UI prevents this) | Form hides media input for written type; server is fallback |
| `UnauthorizedError("Authentication required")` | `content.routes:619` | Direct media URL access in browser | Hono `errorHandler` → JSON; browser shows raw JSON (media stream endpoint, not UI component) |
| `ForbiddenError("Subscription required...")` | `content.routes:621` | Direct media URL access in browser | Same as above — media stream endpoint |
| `NotFoundError("No media/thumbnail/cover-art uploaded")` | `content.routes:603,655,689` | Image/video/audio elements with null `src` | Components handle null URLs gracefully — show placeholders |
| `AppError("UPLOAD_ERROR", ...)` | `content.routes:553` | `ContentForm` (via `uploadContentFile`) | Shows server error message in `role="alert"` |
| `AppError("INSERT_FAILED", ...)` | `content.routes:317` | `ContentForm` (via `createContent`) | Shows server error message in `role="alert"` |
| Feed fetch error (non-OK) | N/A | `useCursorPagination` in `feed.tsx`, `MyContentList` | **Generic "Failed to load"** — Finding #5 |

### Type Chain

| Step | Type | Mechanism | Status |
|------|------|-----------|--------|
| Shared | `ContentResponse` / `FeedItem` / `FeedResponse` | Zod `.infer` | Source of truth |
| DB Schema | `typeof content.$inferSelect` | Drizzle `$inferSelect` | DB-level type |
| Transformer | `resolveContentUrls` → `ContentResponse` | Explicit return type annotation | **TS-enforced** |
| Transformer | `resolveFeedItem` → `FeedItem` | Explicit return type annotation | **TS-enforced** |
| Web lib | `apiMutate<ContentResponse>`, `apiUpload<ContentResponse>`, `apiGet<FeedResponse>` | Generic parameter | Matches shared types |
| SSR loader | `fetchApiServer(...)` cast `as FeedResponse` / `as Promise<FeedItem>` | Runtime cast on server fn return | **Weak** — `fetchApiServer` returns `unknown`; cast is needed but not verified at compile time |
| Component | `ContentCardProps.item: FeedItem`, `ContentDetailProps.item: FeedItem` | Props interface importing from `@snc/shared` | **Inferred from shared** |
| No `any` types | — | — | **Clean** (except `route-test-factory.ts` middleware mocks use `any` for Hono context — test-only) |
| No manual re-definitions | — | — | **Clean** — all components import types from `@snc/shared` |

Note: The `fetchApiServer` return type is `unknown` (it's a generic server function). The cast in `feed.tsx:17` (`as FeedResponse`) and `content/$contentId.tsx:14` (`as Promise<FeedItem>`) are necessary but not compile-time safe. This is a systemic pattern across all SSR loaders and not content-specific.

### Fixture Sync

| Entity | API Factory | Web Factory | Status | Notes |
|--------|-------------|-------------|--------|-------|
| ContentResponse | `makeMockContent` | N/A (web uses `makeMockFeedItem` instead) | **N/A** | API has a response-shaped fixture; web uses the feed-item shape directly |
| DbContentRow | `makeMockDbContent` | N/A | **N/A** | DB-layer only |
| FeedItem | (constructed inline via `makeFeedRow` in tests) | `makeMockFeedItem` | **Check** | See below |

Detailed fixture field comparison for `FeedItem`:

| Field | API `makeFeedRow` default | Web `makeMockFeedItem` default | Status |
|-------|---------------------------|--------------------------------|--------|
| `id` | `"content-test-1"` | `"content-1"` | **Minor mismatch** — different default IDs |
| `creatorId` | `"user_test123"` | `"user-1"` | **Minor mismatch** — different default creator IDs |
| `creatorName` | `"Test Creator"` | `"Test Creator"` | **Synced** |
| `type` | `"written"` | `"written"` | **Synced** |
| `title` | `"Test Post"` | `"Test Post"` | **Synced** |
| `body` | `"Test body content"` | `"Test body content"` | **Synced** |
| `description` | `"A test post"` | `"A test post"` | **Synced** |
| `visibility` | `"public"` | `"public"` | **Synced** |
| `thumbnailUrl`/`thumbnailKey` | `null` (key) | `null` (url) | **Synced** — format differs correctly |
| `mediaUrl`/`mediaKey` | `null` (key) | `null` (url) | **Synced** — format differs correctly |
| `coverArtUrl`/`coverArtKey` | `null` (key) | `null` (url) | **Synced** — format differs correctly |
| `publishedAt` | `Date("2026-01-01...")` | `"2026-02-26..."` | **Date mismatch** — different default dates |
| `createdAt` | `Date("2026-01-01...")` | `"2026-02-26..."` | **Date mismatch** — different default dates |
| `updatedAt` | `Date("2026-01-01...")` | `"2026-02-26..."` | **Date mismatch** — different default dates |

The ID and date default mismatches are cosmetic — they don't affect test correctness since both factories accept overrides. The Date vs ISO string format difference is intentional per `dual-layer-fixtures`.

Note: The API tests construct feed rows inline via `makeFeedRow` (local to the test file at `content.routes.test.ts:147`) which composes `makeMockDbContent` + `creatorName`. This is a proper pattern — the test-local helper adapts the DB fixture to the feed query shape.

### Dead API Surface

| Function | Defined In | Consumed By | Status |
|----------|-----------|-------------|--------|
| `createContent(data)` | `lib/content.ts:7` | `ContentForm` component | **Live** |
| `uploadContentFile(id, field, file)` | `lib/content.ts:13` | `ContentForm` component | **Live** |
| `fetchMyContent(creatorId, cursor?)` | `lib/content.ts:26` | **None** (MyContentList uses `useCursorPagination`) | **Dead** — Finding #3 |

Note: The `feed.tsx` route uses `fetchApiServer` for its loader and `useCursorPagination` for client-side pagination — neither goes through `lib/content.ts`. The `content/$contentId.tsx` route also uses `fetchApiServer` for its loader.

Cross-domain consumers of content data:
- `RecentContent` landing component — receives `FeedResponse["items"]` as props from the landing page loader
- Creator detail page (`creators/$creatorId.tsx`) — uses `useCursorPagination` to fetch content filtered by creator, consuming `FeedItem` type
- `MyContentList` component — uses `useCursorPagination` to fetch content filtered by creator
- None of these use `lib/content.ts` functions for reading content

---

## Best Practices Research

### Hono v4.12

| Current Approach | Recommended | Migration Effort |
|------------------|-------------|------------------|
| `describeRoute()` + `validator()` + `resolver()` from hono-openapi | Current approach is correct for hono-openapi integration | None needed |
| `as never` cast for `c.req.valid()` inside `describeRoute` | Tracked upstream (hono-openapi #145, #192); no better workaround available yet | Wait for upstream fix |

### Drizzle ORM v0.45

| Current Approach | Recommended | Migration Effort |
|------------------|-------------|------------------|
| `$inferSelect` for row types, manual chain mocking | Current approach is standard; no API changes in v0.45 affecting content routes | None needed |
| `as FeedRow[]` cast on joined select result | Drizzle v0.45 improves type inference for `.select({})` with explicit columns, but `innerJoin` + custom select still returns inferred types that don't match a named type. The cast is the standard workaround. | None needed |

### Vitest v4.0

| Current Approach | Recommended | Migration Effort |
|------------------|-------------|------------------|
| `vi.restoreAllMocks()` in `afterEach` | **Behavior changed in v4**: `restoreAllMocks()` now only restores `vi.spyOn()` mocks. Content route tests use `setupRouteTest` which handles this correctly (calls `vi.clearAllMocks()` in `beforeEach` + `vi.resetModules()` in `afterEach`). Web component tests use `vi.restoreAllMocks()` in `afterEach` with `vi.hoisted()` mocks — these may need `vi.resetAllMocks()` added. | Medium — affects web component tests |
| Content-access tests use `vi.clearAllMocks()` + `vi.restoreAllMocks()` + `vi.resetModules()` | Correct lifecycle for `vi.doMock` pattern | None needed |

### Zod v4.3

| Current Approach | Recommended | Migration Effort |
|------------------|-------------|------------------|
| `zod/mini` with `.check()` in ContentForm | Correct — `zod/mini` is the recommended tree-shakeable import for frontend | None needed |
| `z.string().min(1).max(200)` in shared schemas | Correct for Zod 4 standard API | None needed |

---

## OSS Alternatives

No candidates identified. The content domain uses standard patterns (Hono routes, Drizzle queries, React components with CSS Modules) with no hand-rolled infrastructure that a library would replace. The `streamFile` utility is thin enough that a streaming library would add unnecessary dependency.

---

## Pattern Compliance

| Pattern | Status | Notes |
|---------|--------|-------|
| `row-to-response-transformer` | **Compliant** | `resolveContentUrls` and `resolveFeedItem` have explicit shared return types |
| `route-private-helpers` | **Fixed** | Stream handlers consolidated via `streamContentFile`/`requireContentFile` helpers (Finding #1) |
| `upload-replace-workflow` | **Compliant** | Content upload handler follows all 10 steps: ownership → pre-check → parse → MIME → sanitize → delete-old → upload → DB update |
| `cursor-encode-decode` | **Compliant** | `buildPaginatedResponse` used for feed pagination |
| `hono-typed-env` | **Compliant** | `Hono<AuthEnv>` on route; `as never` workaround documented |
| `content-type-dispatch` | **Compliant** | `ContentCard` uses `Record<FeedItem["type"], string>` for badges; `ContentDetail` uses conditional rendering to dispatch to variant components |
| `listing-page-shared-css` | **Compliant** | `feed.tsx` and `MyContentList` import from `listing-page.module.css` |
| `css-modules-design-tokens` | **Minor drift** | Two hardcoded `rgba()` values in `content-card.module.css` (P3) |
| `react-context-reducer-provider` | **N/A** | Content domain doesn't define its own context; audio player context is consumed but owned by media domain |
| `drizzle-chainable-mock` | **Compliant** | Content route tests use full chain mocking with `chainablePromise` utility |
| `hono-test-app-factory` | **Compliant** | Uses `setupRouteTest` factory |
| `dual-layer-fixtures` | **Compliant** | API: `makeMockDbContent` with Date objects + storage keys; Web: `makeMockFeedItem` with ISO strings + URLs |
| `shared-validation-constants` | **Fixed** | `MAX_TITLE_LENGTH` and `MAX_DESCRIPTION_LENGTH` exported from `@snc/shared` and imported in both server schemas and client form (Finding #4) |
| `web-fetch-client` | **Compliant** | `apiGet`/`apiMutate`/`apiUpload` used correctly in `lib/content.ts` |
| `vi-doMock-dynamic-import` | **Compliant** | Content access tests and route tests use `vi.doMock` + dynamic `import()` |
| `vi-hoisted-module-mock` | **Compliant** | All web component tests follow hoisted mock pattern |
| `vi-import-original-partial-mock` | **N/A** | Not used in content tests — all mocks are full replacements |
| `app-error-hierarchy` | **Compliant** | Uses `NotFoundError`, `ForbiddenError`, `ValidationError`, `UnauthorizedError` — never plain `Error` |
| `result-type` | **Compliant** | Storage operations return `Result<T, AppError>`; upload handler checks `.ok` before proceeding |
| `content-access-gate` | **Compliant** | Both per-item (`checkContentAccess`) and batch (`buildContentAccessContext` + `hasContentAccess`) patterns implemented with correct priority rules |

---

## Suggested Implementation Order

1. **Finding #1 (P1)** — Extract `streamContentFile` private helper in `content.routes.ts` to deduplicate the three stream handlers. Low risk, contained to one file.
2. **Finding #4 (P2)** — Export `MAX_TITLE_LENGTH` and `MAX_DESCRIPTION_LENGTH` from `@snc/shared/content.ts`. Import in both server schemas and client `ContentForm`.
3. **Finding #3 (P2)** — Remove dead `fetchMyContent` from `lib/content.ts`. Zero risk — no consumers.
4. **Finding #5 (P2)** — Improve `useCursorPagination` error extraction (cross-domain, shared with booking report). This should be done once for all consumers.
5. **Finding #2 (P1)** — Extract shared subscription status condition in `content-access.ts`. Low risk, contained to one service file.
6. **P3 items** — Address opportunistically when touching affected files. Missing tests for `ContentForm` and `MyContentList` should be prioritized when those components are next modified.

Order by: contained single-file improvements first → shared constant extraction → cross-cutting hook improvement → service refactor.
