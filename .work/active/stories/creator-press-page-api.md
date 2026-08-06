---
id: creator-press-page-api
kind: story
stage: done
parent: creator-press-page
depends_on: [creator-press-page-schema]
release_binding: null
gate_origin: null
created: 2026-08-05
updated: 2026-08-05
---

# API routes — public press + authed config + photo upload

Full spec in feature body §"Unit 2".

**Deliverables**: `apps/api/src/routes/press.routes.ts` (new), mounted in `apps/api/src/app.ts` alongside the other creator routers.

**Endpoints**:
- `GET /api/creators/:creatorId/press` — public (`optionalAuth`), handle/id → canonical, returns `PressPagePayload` only if `content.enabled` + creator active; 404 otherwise.
- `GET /api/creators/:creatorId/press/releases/:releaseSlug` — public, one `ReleaseOneSheet`.
- `GET /api/creators/:creatorId/press-config` — authed, `requireCreatorPermission(…, "editProfile")`, full config for editing.
- `PATCH /api/creators/:creatorId/press-config` — authed + editProfile, validates `PressConfigPatchSchema`, upserts.
- `POST /api/creators/:creatorId/press/photos` — multipart clone of `handleImageUpload` (`creator-media.routes.ts`): editProfile, size/MIME checks, key `creators/{id}/press/{sanitized}`, returns the stored key.

**Pattern**: Hono + `describeRoute`/`validator` ceremony per `AGENTS.md`; handle/id resolution + `requireCreatorPermission` per `creator-media.routes.ts`.

**Acceptance evidence**:
- [x] Public endpoints 404 when disabled/inactive; return content when enabled.
- [x] PATCH: 403 non-member, 400 invalid patch; upserts on valid.
- [x] Photo upload stores under `creators/{id}/press/…` and returns the key.
- [x] Happy-path + auth-failure tests per route.

## Implementation notes

- Added JSON-only public press and release routes, protected config GET/PATCH routes,
  and editProfile-protected multipart press-photo upload in
  `apps/api/src/routes/press.routes.ts`.
- Mounted `pressRoutes` at `/api/creators` in `apps/api/src/app.ts`.
- Public payloads resolve handle/id through `findCreatorProfile`, require an active
  creator and enabled config, and source creator location from press content.
- Added route coverage for enabled/disabled/inactive public access, release misses,
  config auth/validation/permission behavior, and sanitized photo storage keys.
- Verification: `bun run --filter @snc/api typecheck` passed; targeted press route
  tests passed (13/13); full API unit suite passed.

**Order**: after schema; unblocks web-public, pdf, and manage-editor.
