> **Archived**: 2026-03-09
> **Validation**: All tests passing (414 API, 401 shared, 726 web), no cross-finding regressions

# Refactor Analysis: Creator Domain Vertical Slice

> **Generated**: 2026-03-09
> **Scope**: 33 files analyzed across shared schema, API routes/tests, web lib/components/routes/tests, cross-domain consumers
> **Libraries researched**: Hono v4.12, Drizzle v0.45, Vitest v4, Zod v4.3

---

## Executive Summary

The creator vertical slice is well-structured and follows established patterns consistently. Analysis of 33 files found 0 P0 issues, 2 P1 findings (duplicated load-more CSS in creator-detail and a `toProfileResponse` `as` cast on JSONB data), 4 P2 findings, and 5 P3 findings. Cross-layer continuity is strong: shared schemas are the single source of truth, validation constants are imported from `@snc/shared`, and fixture alignment is good. The most impactful improvement is eliminating the duplicated `.loadMoreButton` / `.loadMoreWrapper` CSS in `creator-detail.module.css` by importing from the shared listing-page module.

---

## P0 — Fix Now

None found.

---

## P1 — High Value

### 1. Duplicated load-more CSS in creator-detail.module.css

- **Affected files**: `apps/web/src/routes/creators/creator-detail.module.css:50-76`, `apps/web/src/styles/listing-page.module.css:18-44`
- **Current state**: `creator-detail.module.css` defines `.loadMoreWrapper` and `.loadMoreButton` classes that are character-for-character identical to `listing-page.module.css`. The creator detail page JSX (`$creatorId.tsx:136-148`) references `styles.loadMoreWrapper` and `styles.loadMoreButton` from the local module instead of the shared module.
- **Proposed consolidation**: Import `listingStyles` from `../../styles/listing-page.module.css` in `$creatorId.tsx` (same pattern as `creators/index.tsx:9` and `merch/index.tsx`). Remove `.loadMoreWrapper` and `.loadMoreButton` from `creator-detail.module.css`. Update JSX references from `styles.loadMoreWrapper` / `styles.loadMoreButton` to `listingStyles.loadMoreWrapper` / `listingStyles.loadMoreButton`.
- **Estimated scope**: 2 files changed, ~30 lines removed
- **Pattern reference**: `listing-page-shared-css` pattern — the creators index page already follows this pattern correctly
- **Tests affected**: None (CSS class names are scoped, no test assertions on class names)
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

### 2. JSONB `as` cast in toProfileResponse transformer

- **Affected files**: `apps/api/src/routes/creator.routes.ts:129`
- **Current state**: The transformer contains `socialLinks: (profile.socialLinks as import("@snc/shared").SocialLink[]) ?? []`. This inline `import()` type assertion is unusual and bypasses the Drizzle JSONB type annotation already present on the schema (`.$type<SocialLink[]>()`). Drizzle's `$inferSelect` should already type `socialLinks` as `SocialLink[]`.
- **Proposed consolidation**: The `CreatorProfileRow` type alias (line 38) uses `typeof creatorProfiles.$inferSelect`, which should carry the `.$type<SocialLink[]>()` annotation. The `as` cast is likely unnecessary. Verify that `CreatorProfileRow.socialLinks` is typed as `SocialLink[]` (from the JSONB `.$type` annotation). If so, remove the cast and use `profile.socialLinks ?? []` directly. If Drizzle types JSONB as `unknown` at runtime despite `.$type`, add a single-line comment explaining why the cast is needed.
- **Estimated scope**: 1 file, 1 line
- **Pattern reference**: `row-to-response-transformer` pattern — transformers should reference the shared type via their return type, not inline casts
- **Tests affected**: `apps/api/tests/routes/creator.routes.test.ts` (verify existing tests pass without the cast)
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

---

## P2 — Medium Value

### 1. creator-detail.module.css also duplicates `.status` and `.sectionHeading` styles

- **Location**: `apps/web/src/routes/creators/creator-detail.module.css:11-32`
- **Affected files**: `creator-detail.module.css`, `social-links-section.module.css`
- **Issue**: The `.sectionHeading` class in `creator-detail.module.css` (lines 17-22) is identical to `.sectionHeading` in `social-links-section.module.css` (lines 9-14). The `.status` class (lines 27-32) is identical to `listing-page.module.css:9-14`. While these are used in different layout contexts (section heading vs page heading), the duplication creates drift risk.
- **Suggestion**: Extract a `section-heading` token or shared class. However, this crosses the boundary between "page section heading" and "component section heading", so may be intentional. Consider at least a comment noting the parallel.
- **Tests affected**: None
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

### 2. `CreatorHeader` accepts `CreatorProfileResponse` prop but tests use `makeMockCreatorListItem`

- **Location**: `apps/web/tests/unit/components/creator-header.test.tsx:54-55`
- **Affected files**: `apps/web/src/components/creator/creator-header.tsx:14-16`, `apps/web/tests/unit/components/creator-header.test.tsx`
- **Issue**: `CreatorHeaderProps.creator` is typed as `CreatorProfileResponse`. However, all test cases construct test data using `makeMockCreatorListItem()`. Since `CreatorListItem = CreatorProfileResponse` (line 124 of shared/creator.ts: `CreatorListItemSchema = CreatorProfileResponseSchema`), this works at runtime but is semantically misleading — header tests should use `makeMockCreatorProfileResponse()` which is already exported from the web fixture file.
- **Suggestion**: Replace `makeMockCreatorListItem` with `makeMockCreatorProfileResponse` in `creator-header.test.tsx` for semantic clarity. No functional change since the types are identical.
- **Tests affected**: `apps/web/tests/unit/components/creator-header.test.tsx`
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

### 3. `creatorName` / `creatorId` fields on `FeedItem` are consumed cross-domain but not defined in creator shared schema

- **Location**: `packages/shared/src/content.ts` (FeedItemSchema), `apps/web/src/components/content/content-card.tsx:71`
- **Issue**: Content components reference `item.creatorName` and `item.creatorId` from `FeedItem` — these are content-domain fields that embed creator identity. There is no formal coupling back to the creator schema. If the creator `displayName` field were renamed, content feed items would silently drift. This is a known cross-domain boundary, not a bug, but worth documenting.
- **Suggestion**: Add a comment in `FeedItemSchema` noting the creator identity fields mirror `CreatorProfileResponse.displayName` and `.userId` to aid future refactoring.
- **Tests affected**: None
- **Verify**: [ ] Tests pass / [ ] No new public APIs / [ ] Behavior unchanged

### 4. Dead API surface: `bannerUrl` field returned by list endpoint but unused in `CreatorCard`

- **Location**: `apps/api/src/routes/creator.routes.ts:313` (list response), `apps/web/src/components/creator/creator-card.tsx:16-44`
- **Issue**: The creators list API returns `bannerUrl` for each item (via `toProfileResponse`), but `CreatorCard` only reads `avatarUrl`, `displayName`, `bio`, `contentCount`, and `userId`. The `bannerUrl` field is dead surface in the list context. It IS used by `CreatorHeader` (detail page), so the field is not globally dead.
- **Suggestion**: This is low priority since the same `toProfileResponse` transformer serves both list and detail endpoints, and splitting into two transformers would add complexity without meaningful benefit. Consider adding `bannerUrl` to the "intentional" column in the skip list.
- **Tests affected**: None
- **Verify**: [ ] Tests pass / [ ] No new public APIs / [ ] Behavior unchanged

---

## P3 — Nice-to-Have

- `apps/web/src/routes/creators/$creatorId.tsx:33` — `handleLoadMore` is an unnecessary alias for `loadMore` (line 107: `const handleLoadMore = loadMore;`). Same pattern in `creators/index.tsx:33`.
- `apps/web/src/routes/creators/$creatorId.tsx:27` — Loader return type casts through `as Promise<CreatorProfileResponse>` from `fetchApiServer`. The `fetchApiServer` function returns `Promise<unknown>`, so this cast is load-bearing but undocumented.
- `apps/web/src/routes/settings/creator.tsx:199` — Platform `<select>` casts `e.target.value as SocialPlatform` without runtime validation. Since the `<option>` values are sourced from `SOCIAL_PLATFORMS`, the cast is safe but could use a type guard.
- `apps/web/src/routes/settings/creator.tsx:53-54` — `userId` is initialized as empty string and set later via `useEffect`. The route's `beforeLoad` already resolves `userId` — consider accessing it via route context instead of re-fetching `fetchAuthState` in the component.
- `apps/api/src/routes/creator.routes.ts:508` — `c.req.valid("json")` is cast as `UpdateCreatorProfile` without the `"json" as never` workaround used elsewhere for `describeRoute()`. This suggests `validator("json")` correctly propagates types when used without `describeRoute()` wrapping the query validator. Verify this is intentional — it appears correct since the `as never` workaround is only needed for `c.req.valid("query")` inside `describeRoute()`.

---

## Skip — Intentional Patterns

| Pattern | Location | Why it stays |
|---------|----------|-------------|
| `as never` cast on `c.req.valid("query")` | `creator.routes.ts:272` | Known hono-openapi limitation tracked upstream (rhinobase/hono-openapi#145). Removed when fix lands. |
| `row.status as BookingStatus` style cast | Not present in creator routes | N/A — creator domain has no enum columns requiring this pattern |
| Date vs ISO string fixture differences | API `makeMockDbCreatorProfile` (Date) vs web `makeMockCreatorListItem` (string) | Intentional per `dual-layer-fixtures` pattern |
| `apiGet<CreatorProfileResponse>` generic cast | `apps/web/src/lib/creator.ts:14` | Safe — return type matches shared schema. Known pattern per `web-fetch-client`. |
| `CreatorListItemSchema = CreatorProfileResponseSchema` | `packages/shared/src/creator.ts:124` | Intentional — list items currently have the same shape as detail responses. Separate schemas will diverge only when list items need fewer fields. |
| `bannerUrl` in list response | `creator.routes.ts:313` (via toProfileResponse) | Single transformer serves both list and detail. Splitting would add complexity for minimal gain. |

---

## Best Practices Research

### Hono v4.12

| Current Approach | Recommended | Migration Effort |
|------------------|-------------|------------------|
| `as never` workaround for hono-openapi | No changes needed — tracked upstream | None |

### Drizzle v0.45

| Current Approach | Recommended | Migration Effort |
|------------------|-------------|------------------|
| JSONB with `.$type<T>()` annotation | Correct pattern | None |

### Vitest v4

| Current Approach | Recommended | Migration Effort |
|------------------|-------------|------------------|
| `vi.restoreAllMocks()` in `afterEach` | Audit: only restores `vi.spyOn()` mocks now. Route test factory uses `vi.clearAllMocks()` in beforeEach (correct) + `vi.restoreAllMocks()` in afterEach. Web tests use `vi.restoreAllMocks()` in afterEach. | Low — verify 6 creator test files use correct mock reset strategy |

### Zod v4.3

| Current Approach | Recommended | Migration Effort |
|------------------|-------------|------------------|
| `zod/mini` for client-side | Correct pattern | None |
| `zod` for shared schemas | Correct pattern | None |

---

## OSS Alternatives

No candidates identified. The creator domain uses standard platform patterns without hand-rolled utilities that would benefit from a library replacement.

---

## Pattern Compliance

| Pattern | Status | Notes |
|---------|--------|-------|
| `row-to-response-transformer` | Compliant | `toProfileResponse` uses `profile.socialLinks ?? []` — JSONB `.$type<SocialLink[]>()` annotation provides correct typing |
| `route-private-helpers` | Compliant | Private helpers (`findCreatorProfile`, `ensureCreatorProfile`, `handleImageUpload`, etc.) correctly unexported |
| `upload-replace-workflow` | Compliant | Full 10-step sequence followed for both avatar and banner uploads |
| `cursor-encode-decode` | Compliant | Uses `buildPaginatedResponse` and `decodeCursor` from shared cursor module |
| `hono-typed-env` | Compliant | Routes typed with `Hono<AuthEnv>`, handlers access `c.get("user")` typed |
| `css-modules-design-tokens` | Compliant | All CSS modules use `var(--token)` exclusively; no hardcoded values |
| `listing-page-shared-css` | Fixed | Load-more styles removed from `creator-detail.module.css`; `$creatorId.tsx` now imports from shared `listing-page.module.css` — P1 #1 |
| `vi-doMock-dynamic-import` | Compliant | API tests use `setupRouteTest` factory which encapsulates `vi.doMock` + dynamic import |
| `hono-test-app-factory` | Compliant | Uses `setupRouteTest` factory (evolved from raw `createTestApp`) |
| `drizzle-chainable-mock` | Compliant | Mock chains re-wired in `beforeEach` callback via factory options |
| `dual-layer-fixtures` | Compliant | API fixtures use Date/keys, web fixtures use strings/URLs. Both typed against shared types. |
| `vi-hoisted-module-mock` | Compliant | All web component tests use `vi.hoisted()` + `vi.mock()` correctly |
| `web-fetch-client` | Compliant | `lib/creator.ts` uses `apiGet` and `apiMutate` from `fetch-utils.ts` |
| `app-error-hierarchy` | Compliant | Routes throw `NotFoundError`, `ForbiddenError`, `ValidationError`, `AppError` correctly |
| `shared-validation-constants` | Compliant | `PLATFORM_CONFIG`, `SOCIAL_PLATFORMS`, `MAX_SOCIAL_LINKS` all imported from `@snc/shared` on both server and client |
| `result-type` | Compliant | Storage operations checked via `.ok` discriminant |
| `storage-provider-singleton` | Compliant | `storage` imported from singleton; tests mock via `vi.doMock` |
| `storage-contract-test` | N/A | No new storage provider in creator domain |

---

## Cross-Layer Continuity

### Schema-Transformer Alignment

| Shared Schema Field | Transformer Output | Status | Notes |
|--------------------|--------------------|--------|-------|
| `CreatorProfileResponseSchema.userId` | `toProfileResponse → userId` | Aligned | Direct pass-through from DB row |
| `CreatorProfileResponseSchema.displayName` | `toProfileResponse → displayName` | Aligned | Direct pass-through |
| `CreatorProfileResponseSchema.bio` | `toProfileResponse → bio ?? null` | Aligned | Nullable handling correct |
| `CreatorProfileResponseSchema.avatarUrl` | `toProfileResponse → resolveCreatorUrls().avatarUrl` | Aligned | URL derived from storage key |
| `CreatorProfileResponseSchema.bannerUrl` | `toProfileResponse → resolveCreatorUrls().bannerUrl` | Aligned | URL derived from storage key |
| `CreatorProfileResponseSchema.socialLinks` | `toProfileResponse → socialLinks` | Aligned | JSONB `.$type<SocialLink[]>()` provides correct typing; `?? []` fallback for safety |
| `CreatorProfileResponseSchema.contentCount` | `toProfileResponse → contentCount` | Aligned | Passed as separate parameter |
| `CreatorProfileResponseSchema.createdAt` | `toProfileResponse → createdAt.toISOString()` | Aligned | Date-to-ISO conversion |
| `CreatorProfileResponseSchema.updatedAt` | `toProfileResponse → updatedAt.toISOString()` | Aligned | Date-to-ISO conversion |

Return type: `toProfileResponse` explicitly returns `CreatorProfileResponse` (line 121). TS-enforced — any schema-transformer drift would be a compile error.

### Validation Sync

| Field | Server Rule | Client Rule | Status |
|-------|-------------|-------------|--------|
| `socialLinks[].platform` | `z.enum(SOCIAL_PLATFORMS)` via `SocialLinkSchema` | `SOCIAL_PLATFORMS.map()` populates `<select>` options | Synced — both import from `@snc/shared` |
| `socialLinks[].url` | `z.string().url()` + `PLATFORM_CONFIG.urlPattern` refine | `zod/mini` `z.url()` + `PLATFORM_CONFIG.urlPattern` check | Synced — both import `PLATFORM_CONFIG` from `@snc/shared` |
| `socialLinks[].label` | `z.string().max(100).optional()` | No client-side label validation (label input exists but no max check) | **Minor gap** — client allows labels > 100 chars; server rejects. UX is a server-side 400 error. |
| `socialLinks` array max | `.max(MAX_SOCIAL_LINKS)` (20) server-side | `disabled={socialLinks.length >= MAX_SOCIAL_LINKS}` disables Add button | Synced — both import `MAX_SOCIAL_LINKS` from `@snc/shared` |
| `socialLinks` duplicate platform | `.refine()` checks Set size === array length | `socialLinks.some(l => l.platform === newPlatform)` check | Synced — different implementations but equivalent logic |
| `displayName` | `z.string().min(1).max(100).optional()` | Not validated on client (settings page only manages social links) | **N/A** — display name editing not yet in settings UI |
| `bio` | `z.string().max(2000).optional()` | Not validated on client | **N/A** — bio editing not yet in settings UI |

### Error Path Coverage

| Error | API Route | Web Component | UI Treatment |
|-------|-----------|---------------|--------------|
| `NotFoundError("Creator not found")` | `creator.routes.ts:464,469,88` | `creator-detail` loader, `settings/creator` profile fetch | Loader throws → TanStack error boundary. Settings page shows "Failed to load profile" via catch block. |
| `NotFoundError("Avatar not found")` | `creator.routes.ts:394` | Direct image `<img>` tag | Browser shows broken image or `OptionalImage` placeholder — no explicit error handling needed. |
| `NotFoundError("Banner not found")` | `creator.routes.ts:424` | Direct image `<img>` tag | Same as avatar — handled by `OptionalImage` placeholder. |
| `ForbiddenError("Cannot upload to another creator's profile")` | `creator.routes.ts:163` | Not directly consumed (upload not in web UI yet) | **No UI treatment** — but upload endpoints are not yet wired to any web component, so this is expected. |
| `ForbiddenError("Cannot update another creator's profile")` | `creator.routes.ts:512` | `settings/creator` submit handler | Caught by generic `catch (err)` → `setServerError(err.message)` → shows in `role="alert"` div. Covered. |
| `ValidationError` (file upload) | `creator.routes.ts:170-195` | Not directly consumed (upload not in web UI yet) | **No UI treatment** — upload UI not yet implemented. |
| `ValidationError` (social links) | `zValidator("json")` 400 response | `settings/creator` submit handler | Caught by generic `catch (err)` → shows error message. Covered. |
| `AppError("UPLOAD_ERROR", ...)` 500 | `creator.routes.ts:228` | Not consumed | **No UI treatment** — upload not yet in web UI. |

### Type Chain

| Step | Type | Mechanism | Status |
|------|------|-----------|--------|
| Shared | `CreatorProfileResponse` | `z.infer<typeof CreatorProfileResponseSchema>` | Source of truth |
| Transformer | `toProfileResponse` return | Explicit `: CreatorProfileResponse` return type | TS-enforced |
| Web lib | `apiGet<CreatorProfileResponse>` | Generic parameter in `lib/creator.ts:14` | Matches shared |
| Web lib | `apiMutate<CreatorProfileResponse>` | Generic parameter in `lib/creator.ts:27` | Matches shared |
| CreatorCard props | `CreatorListItem` | Via `CreatorCardProps.creator` typed as `CreatorListItem` | Matches shared (`CreatorListItem = CreatorProfileResponse`) |
| CreatorHeader props | `CreatorProfileResponse` | Via `CreatorHeaderProps.creator` | Matches shared |
| Creators index loader | `CreatorListResponse` | Via `fetchApiServer` + cast | Cast at boundary (see P3) |
| Creator detail loader | `CreatorProfileResponse` | Via `fetchApiServer` + cast | Cast at boundary (see P3) |
| Settings/creator page | `CreatorProfileResponse` | Via `fetchCreatorProfile` (typed) → `setSocialLinks` | Indirect — extracts `socialLinks` field |

No `any` types found. No manual re-definitions of shared types. Casts at the `fetchApiServer` boundary are load-bearing (server fn returns `unknown`).

### Fixture Sync

| Entity | API Factory | Web Factory | Status | Notes |
|--------|-------------|-------------|--------|-------|
| Creator Profile | `makeMockDbCreatorProfile` | `makeMockCreatorProfileResponse` | Synced | API uses Date objects + storage keys; web uses ISO strings + URLs. Default values match: userId=`user_test123`, displayName=`Test Creator`, bio=`A test creator bio`. |
| Creator List Item | (same transformer) | `makeMockCreatorListItem` | Synced | Identical to profile response (schema aliased). |
| Fixture field: `avatarKey`/`avatarUrl` | `avatarKey: null` | `avatarUrl: "/api/creators/user_test123/avatar"` | **Minor mismatch** | API default has `null` avatarKey; web default has a non-null URL. This means web tests default to "has avatar" while API tests default to "no avatar". Not a bug — just different default assumptions. |
| Fixture field: `bannerKey`/`bannerUrl` | `bannerKey: null` | `bannerUrl: null` | Synced | Both default to null. |
| Fixture field: `contentCount` | Not in API fixture (calculated separately) | `contentCount: 5` | **Expected gap** | API layer calculates content count separately; web fixture includes it as a pre-calculated field. |
| Fixture field: `socialLinks` | `socialLinks: []` | `socialLinks: []` | Synced | Both default to empty array. |

### Dead API Surface

| API Response Field | Web Consumer(s) | Status |
|-------------------|-----------------|--------|
| `userId` | `CreatorCard` (key, link param), `CreatorHeader` (unused directly), `$creatorId.tsx` (content/merch/plan fetch) | Active |
| `displayName` | `CreatorCard`, `CreatorHeader`, `FeaturedCreators` | Active |
| `bio` | `CreatorCard`, `CreatorHeader` | Active |
| `avatarUrl` | `CreatorCard`, `CreatorHeader` | Active |
| `bannerUrl` | `CreatorHeader` only. **Not used by** `CreatorCard` or `FeaturedCreators`. | Active (detail page) / Dead in list context |
| `socialLinks` | `SocialLinksSection` (via `$creatorId.tsx`), `settings/creator.tsx` | Active |
| `contentCount` | `CreatorCard` (post count display) | Active |
| `createdAt` | Not consumed by any web component | **Dead surface** — returned but never displayed |
| `updatedAt` | Not consumed by any web component | **Dead surface** — returned but never displayed |

`createdAt` and `updatedAt` are used internally by the cursor pagination system (encoded into cursors) but are never rendered in the UI. They serve a structural purpose. Not worth removing.

---

## Suggested Implementation Order

1. **P1 #1 — Deduplicate load-more CSS** in `creator-detail.module.css` → import from `listing-page.module.css`. Quick win, clear pattern compliance improvement. No test changes needed.
2. **P1 #2 — Remove JSONB `as` cast** in `toProfileResponse`. Verify Drizzle types `socialLinks` correctly via `.$type<SocialLink[]>()`, then simplify to `profile.socialLinks ?? []`.
3. **P2 #2 — Fix fixture semantics** in `creator-header.test.tsx` — use `makeMockCreatorProfileResponse` instead of `makeMockCreatorListItem`.
4. **P2 #1 — Evaluate section heading dedup** — lower priority, may be intentional.
5. **P3 items** — handle as opportunistic cleanup during related work.

Order by: dependencies first (none) -> highest value -> least risk.
