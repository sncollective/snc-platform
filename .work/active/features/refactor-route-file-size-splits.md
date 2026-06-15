---
id: refactor-route-file-size-splits
kind: feature
stage: review
tags: [refactor, structural]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-04-20
updated: 2026-06-15
parent: null
---

Four API route files have grown past the 500 LOC threshold, making them harder to navigate and test in isolation. The extraction strategy for each is a logical sub-group of routes (feed queries, multipart upload, stream lifecycle orchestration) moved to a sibling file — keeping the original file as the entry point for its remaining routes. This is a structural split, not a behavioral change.

## Scope

Route files in `apps/api/src/routes/` at or over the 500 LOC threshold. Each task is a distinct file with its own extraction target.

## Tasks

- [x] `apps/api/src/routes/content.routes.ts` (709 LOC → 487 LOC) — extracted feed query logic into `content-feed.routes.ts` + shared helpers into `lib/content-feed-columns.ts`; feed queries form a natural cohesive group distinct from upload/metadata operations. **Done 2026-06-15** (see Implementation below)
- [~] `apps/api/src/routes/upload.routes.ts` — **dropped**: now 378 LOC, well under the 500 threshold; the split no longer earns its process cost
- [x] `apps/api/src/routes/streaming.routes.ts` (575 LOC) — **helper-extraction done**: `services/stream-lifecycle.ts` exists with `ensureLiveChannelWithChat` + `teardownLiveChannel`, landed via the streaming-lifecycle story this task flagged as overlapping. (The route file itself remains >500 — the task's scoped deliverable was lifting the orchestration helpers to a service, which is complete; a further route-body split was not in this task's extraction target.)
- [~] `apps/api/src/routes/booking.routes.ts` (531 LOC, optional) — **deferred**: the explicitly-optional borderline split; nothing touched it incidentally this pass, so the added process cost isn't warranted

## Notes

`streaming.routes.ts` extraction to `services/stream-lifecycle.ts` overlaps with the streaming-lifecycle story in active stories — coordinate to avoid duplicate work or divergent extraction targets. The `booking.routes.ts` task is explicitly optional; the borderline LOC count means the split adds process cost that may not be warranted unless the file is being touched for other reasons.

## Implementation (2026-06-15)

`content.routes.ts` split: **709 → 487 LOC**. Two new files plus the source trim.

**Files created:**

- `apps/api/src/lib/content-feed-columns.ts` — lifted the shared feed primitives as JSDoc'd named exports: `CONTENT_FEED_COLUMNS` (the joined content+creator column map), the `FeedRow` type, and the `resolveFeedItem` helper. Shared by the feed routes (new file) and the single-item `GET /:id` route (which stayed in `content.routes.ts`).
- `apps/api/src/routes/content-feed.routes.ts` — `export const contentFeedRoutes` carrying the two feed routes moved verbatim: `GET /` (published feed) and `GET /drafts` (draft listing).

**Files trimmed/changed:**

- `content.routes.ts` — retains POST /, GET /by-creator, GET /:id, PATCH /:id, DELETE /:id, publish, unpublish. Pruned now-unused imports (`isNotNull`, `desc`, `buildCursorCondition`, `buildPaginatedResponse`, `decodeCursor`, `FeedQuerySchema`, `FeedResponseSchema`, `DraftQuerySchema`, the `FeedItem`/`FeedQuery`/`DraftQuery`/`ContentResponse`/`ContentRow` types, and the `buildContentAccessContext`/`hasContentAccess` service imports). Verified each remaining drizzle operator (`eq`, `and`, `or`, `isNull`) is still in use.
- `app.ts` — imported `contentFeedRoutes` and mounted it on `/api/content`.
- `tests/routes/content.routes.test.ts` `mountRoute` — added the `contentFeedRoutes` import + co-mount alongside the existing `contentRoutes` + `contentMediaRoutes` mounts (the **one authorized test edit**). The harness mounts route modules individually, mirroring how `app.ts` assembles the `/api/content` prefix from multiple sub-apps; extracting a route into a new module means the harness's mount list must gain that module, exactly as it already co-mounts `contentMediaRoutes`. No assertions or other test logic touched.

**Mount-order finding (load-bearing, behavior-preserving):** the original `content.routes.ts` had `GET /drafts` (static) and `GET /:id` (param) in the **same** Hono app, where RegExpRouter prioritizes static-over-param within one registration set, so `/drafts` won. After the split they live in **separate** co-mounted sub-apps, and Hono's static-over-param tiebreak does **not** cross the sub-app merge boundary — whichever sub-app registers first wins for the overlapping segment. With the naïve "feed mounted after content" order, `/api/content/drafts` was captured by `contentRoutes`' `/:id` (which then 400'd on the non-UUID param "drafts") — a real production regression, reproduced both in the unit suite (4 failing draft tests) and against the live dev API. Fix: mount `contentFeedRoutes` **before** `contentRoutes` (and `contentMediaRoutes`) in both `app.ts` and the test harness, so the static `/drafts` registers ahead of the param `/:id`. This restores byte-identical routing; the ordering is documented inline at both mount sites.

**Verification:**

- `bunx tsc --noEmit` (apps/api) — 0 errors.
- `bun run --filter @snc/api test:unit` — 1610/1610 passing (matches baseline); the 25 feed/draft tests in `content.routes.test.ts` all green.
- **Live dev stack** (pm2 `api` restarted onto the split): `GET /api/content` → 200 with working cursor pagination; `GET /api/content/drafts` (unauth) → 401 (hits the drafts route's `requireAuth`, not a 400 from `/:id`); `GET /api/content/<bad-uuid>` → 400 (`/:id` UUID validator still fires); `GET /api/content/<missing-uuid>` → 404; `GET /api/content/by-creator/..` → 404. Matches pre-split behavior exactly.

The other three scope tasks: `upload.routes.ts` dropped (378 LOC, under threshold), `streaming.routes.ts` helper-extraction already landed via the streaming-lifecycle story, `booking.routes.ts` deferred (optional, untouched this pass).
