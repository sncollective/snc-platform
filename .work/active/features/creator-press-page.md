---
id: creator-press-page
kind: feature
stage: done
tags: [creators, content, ui]
parent: null
depends_on: []
release_binding: 0.4.0
gate_origin: null
created: 2026-08-04
updated: 2026-08-06
---

# Creator press / EPK page (public)

## Brief

A public, unauthenticated creator press page (electronic press kit) on the
platform — the hosted home for a creator's EPK that press, radio, and
playlisters link to from pitches. **v1 is Animal Future**, timed to single #1
("The Illusionist", SNCR-001, 2026-08-06) on the pending site release, and
built to generalize to any creator as the platform's creator-press capability.

This is the platform-side page feature. The **content** is supplied by the
campaign side — the Animal Future EPK copy, per-release one-sheet, and assets in
`records/animal-future/.work/active/stories/story-publicity-campaign-epk-kit-v1.md`
(one-pager copy, short/long bio, credits, links, standout track). The platform
builds the page; the campaign supplies what fills it.

Supersedes the "parked platform-side `band-epk-press-page`" placeholder
referenced from the campaign's kit-v1 story — that item was never created; this
is it.

## Why

The campaign's EPK kit-v1 originally planned a PDF one-pager + shared folder as
a zero-dependency bridge, migrating to a platform page "when it lands." The
pending site release makes the platform page viable now, and single-1's Aug 6
drop makes it the **primary surface**, not the bridge. A hosted page is stronger
for press/radio than a PDF+folder (deep-linkable, indexable, always current), and
it generalizes to every S/NC creator — a platform capability, not a one-off.

## Scope (v1 — Animal Future, single-1)

- **Public, unauthenticated route** (no auth wall — press/radio need open access).
- Page surfaces: who the band is (short bio), the current single ("The
  Illusionist", out Aug 6) + the traction track ("Get to You", ~14k streams),
  streaming/video links, "for fans of", live dates, press contact
  (press@s-nc.org), and a downloadable per-release one-sheet + press photos.
- Content from the kit-v1 EPK copy (campaign side).
- **Open Graph / meta tags** for clean link previews when press/radio share the
  URL (load-bearing for the pitch use case).
- Ship on the pending site release, live for single-1's Aug 6 cycle-1 pitches.

## Open design questions (feature-design resolves)

1. **Data source — generic creator-profile-driven vs static v1.** Build
   data-driven off the creator entity/profile (the reusable platform capability;
   more work) or ship v1 as near-static Animal Future content for Aug 6 and
   generalize behind it? **Urgency (Aug 6) leans static-first; platform value
   leans data-driven** — feature-design sizes this (recommend static-first v1 on
   a generic skeleton, generalize behind it).
2. **Route.** Separate route (e.g. `/creators/<slug>/press`) vs an extension of
   the existing creator page (`s-nc.org/creators/animalfuture`). A distinct
   `/press` route is cleaner for pitching; extending the creator page is less
   new surface.
3. **Asset hosting.** Press photos + one-sheet PDF — Garage S3 (platform) vs the
   campaign's Seafile library. Affects download URLs and freshness cadence.

## Dependencies

- Likely the creator entity/model (the `unified-channel-model-creator-*`
  family) **if v1 is data-driven**; no hard dependency if v1 is static content.
- Ships on the **pending site release** (`release_binding` set at review-pass,
  not at scope).
- Content dependency (soft): the campaign's kit-v1 copy + one-sheet + photos.

## Not in scope (v1)

- A reusable admin/editor for creators to self-edit their EPK (generalize later).
- Full credit/ISRC/lyrics metadata surface on the page (lives in the one-sheet
  download; the page stays lean).
- Paid-publicist tooling (that's the Jan–Mar 2027 window, separate).

## Cross-project link

- **Campaign side (content):** `records/animal-future/.work/active/stories/story-publicity-campaign-epk-kit-v1.md`
- **This item (platform side, page):** the hosted surface that content fills.

## Simplification opportunity

The kit-v1 PDF one-pager + shared-folder bridge was the zero-dependency
fallback; if this page ships on the site release in time for Aug 6, the PDF /
folder drop to a fallback/shareable artifact rather than the primary surface —
less to maintain in parallel.

---

## Design decisions

Resolves the three open design questions above (Q1–Q3) plus the operator's
2026-08-05 direction (primitive editability + both PDFs + tool validation).

- **Data source (Q1):** DB-backed per-creator press config on a generic
  skeleton, with a *primitive* creator-manage editor — not hardcoded, not full
  data-driven. Operator asked for "editable, at least primitively." Config is a
  JSONB document (band EPK fields + a `releases[]` array), seeded with Animal
  Future content so the page is correct on go-live before anyone touches the
  editor. Generalizing to other creators is a seams-only change (one table,
  handle-keyed).
- **Route (Q2):** distinct public routes — `/creators/:handle/press` (band
  EPK) and `/creators/:handle/press/releases/:releaseSlug` (per-release
  one-sheet) — cleaner for pitching than extending the creator page. Editor at
  `/creators/:handle/manage/press`.
- **Asset hosting (Q3):** Garage S3 (platform), delivered via imgproxy (stored
  object key → responsive descriptors, same contract as avatar/banner),
  uploaded via an avatar-style direct-multipart route. Press photos stored under
  `creators/{id}/press/{filename}`.
- **PDF renderer:** `@react-pdf/renderer@^4.5.1` (validated — see
  §Architectural choice). Server-rendered to a buffer in the API (Node/tsx
  runtime); images resolved from Garage object keys → buffers via `storage`.
- **PDFs (operator):** both — per-release one-sheet PDF + per-creator (band)
  one-pager PDF. One-click downloads at dedicated `.pdf` endpoints, generated
  from the same editable content source (no static file that drifts).
- **Content (operator, 2026-08-05):** Get-to-You figure = **14.5k**; TikTok
  line **dropped**; shoot photos **available** (ingest to Garage on delivery);
  `press@s-nc.org` inbox **live**.

## Architectural choice

**DB-backed press config + `@react-pdf/renderer` server-side PDF generation,
all behind existing platform patterns.**

The config lives in a new `creator_press_configs` side-table cloned from
`creator_join_configs` (one row per creator, PK+FK `creator_id`, cascade delete,
defaults-on-absence, upsert-on-conflict) — reusing the proven config-table
shape rather than adding columns to `creator_profiles` (press is its own
concern; keeps the profile table lean). Content is a single JSONB document
holding band-level EPK fields plus a `releases[]` array (generalizes to the
EP/LP one-sheets later). Schema-first Zod contract in
`packages/shared/src/press.ts`, mirroring `join.ts`.

PDFs are generated server-side by `@react-pdf/renderer` (`renderToBuffer`) in
dedicated API endpoints returning `application/pdf`. Chosen over **pdfkit**
(manual coordinate layout — too laborious for two *designed* docs),
**Chromium/puppeteer** (ships a ~300MB browser into the prod API — against the
platform's simplicity posture), and **external PDF APIs** (external
gress/dep). The one react-pdf caveat (Bun runtime) is moot — the API runs on
Node via tsx (`deploy/snc-api.service.example`: `node --import tsx`). Images
embed by resolving the Garage object key → buffer through the existing
`storage` abstraction (same path avatar streaming uses).

## Implementation Units

### Unit 1 — Schema + shared contract + seed (`creator-press-page-schema`)

**Files**:
- `apps/api/src/db/schema/creator.schema.ts` — add `creatorPressConfigs`.
- `apps/api/drizzle/` — migration generated via `drizzle-kit generate` (never hand-written).
- `packages/shared/src/press.ts` (new) — Zod schemas + inferred types + defaults; re-export from `packages/shared/src/index.ts`.
- `apps/api/src/services/press.ts` (new) — `getPressConfig` (defaults on absence), `upsertPressConfig` (upsert on conflict), mirroring `services/join.ts`.

**Table** (clone of `creator_join_configs`):
```ts
export const creatorPressConfigs = pgTable("creator_press_configs", {
  creatorId: text("creator_id").notNull().primaryKey()
    .references(() => creatorProfiles.id, { onDelete: "cascade" }),
  content: jsonb("content").$type<PressContent>().notNull().default(DEFAULT_PRESS_CONTENT),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

**Shared contract** (`packages/shared/src/press.ts`, schema-first like `join.ts`):
```ts
export const PressContentSchema = z.object({
  enabled: z.boolean().default(false),
  shortBio: z.string().nullable(),
  longBio: z.string().nullable(),
  forFansOf: z.array(z.string()).default([]),
  streamingLinks: z.array(z.object({ label: z.string(), url: z.string().url() })).default([]),
  liveDatesUrl: z.string().url().nullable(),
  standoutTrack: z.object({
    title: z.string(), url: z.string().url().nullable(), streamsLabel: z.string().nullable(),
  }).nullable(),
  pressContactEmail: z.string().email().nullable(),
  location: z.string().nullable(),
  photos: z.array(z.string()).default([]),           // Garage object keys
  releases: z.array(ReleaseOneSheetSchema).default([]),
});
// ReleaseOneSheetSchema: slug, title, catalogNumber, releaseDate, format, genre,
//   isrc, upc, duration, personnel[], writtenBy, producedBy, mixedMasteredBy,
//   copyrightLine, publisherLine, label, fcc ("clean"|"explicit"), artKey?
export const PressConfigPatchSchema = PressContentSchema.partial();
export const PressPagePayloadSchema = z.object({
  creator: z.object({ id, handle, displayName, location }),
  content: PressContentSchema,
});
export const DEFAULT_PRESS_CONTENT: PressContent = { enabled: false, /* …all-null/empty */ };
```

**Seed**: the Animal Future row (band EPK @ 14.5k standout, no TikTok; one
release SNCR-001 "The Illusionist" per the kit-v1 one-sheet) — via the upsert
service / a seed script, content sourced from
`records/animal-future/.work/active/stories/story-publicity-campaign-epk-kit-v1.md`.

**Acceptance**:
- [ ] migration generates + applies cleanly; table has PK+FK cascade.
- [ ] `getPressConfig` returns defaults on absence; `upsertPressConfig` round-trips.
- [ ] AF row seeded (verifiable once Unit 2's GET lands).

### Unit 2 — API routes (`creator-press-page-api`)

**Files**: `apps/api/src/routes/press.routes.ts` (new); mount in `apps/api/src/app.ts` alongside the other creator routers.

**Endpoints**:
- `GET /api/creators/:creatorId/press` — public (`optionalAuth`), resolves handle/id → canonical, returns `PressPagePayload` only if `content.enabled` and creator active; 404 otherwise.
- `GET /api/creators/:creatorId/press/releases/:releaseSlug` — public, returns one `ReleaseOneSheet`.
- `GET /api/creators/:creatorId/press-config` — authed, `requireCreatorPermission(…, "editProfile")`, returns full config for editing.
- `PATCH /api/creators/:creatorId/press-config` — authed + editProfile, validates `PressConfigPatchSchema`, upserts.
- `POST /api/creators/:creatorId/press/photos` — multipart (clone of `handleImageUpload`): editProfile, size/MIME checks, key `creators/{id}/press/{sanitized}`, returns the stored key.

**Pattern**: Hono + `describeRoute`/`validator` ceremony per `AGENTS.md`; handle/id resolution + `requireCreatorPermission` per `creator-media.routes.ts`.

**Acceptance**:
- [ ] public endpoints 404 when disabled/inactive; return content when enabled.
- [ ] PATCH: 403 non-member, 400 invalid patch; upserts on valid.
- [ ] photo upload stores under `creators/{id}/press/…`, returns key.
- [ ] happy-path + auth-failure tests per route.

### Unit 3 — Public web pages (`creator-press-page-web-public`)

**Files**: `apps/web/src/routes/creators/$creatorId/press.tsx` (new);
`apps/web/src/routes/creators/$creatorId/press/releases/$releaseSlug.tsx` (new);
`apps/web/src/lib/press.ts` (new client fetchers); CSS module.

**Behavior**:
- EPK page: short bio, for-fans-of, standout track (14.5k), streaming/video links, live dates, press photos (imgproxy responsive), press contact, link to release one-sheet(s), download-one-pager button → `…/press/one-pager.pdf`.
- One-sheet page: release metadata (catalog/ISRC/UPC/duration/personnel/FCC), download-one-sheet button → `…/press/releases/:slug/one-sheet.pdf`.
- Both: OG/twitter meta tags for clean link previews (load-bearing for pitches).
- Client fetchers in `lib/press.ts` (`apiGet`) mirroring `lib/creator.ts`.

**Acceptance**:
- [ ] both pages render seeded AF content; OG tags present in `<head>`.
- [ ] download buttons target the PDF endpoint URLs.
- [ ] 404 handling when press disabled.

### Unit 4 — PDF generation (`creator-press-page-pdf`)

**Files**: `apps/api/src/services/press-pdf.ts` (new) — `renderOneSheetPdf(release)`, `renderOnePagerPdf(payload)` via `@react-pdf/renderer` `renderToBuffer`; PDF document components; image-resolution helper (Garage key → buffer via `storage`). PDF endpoints added to `press.routes.ts`: `GET …/press/one-pager.pdf`, `GET …/press/releases/:slug/one-sheet.pdf` (public, `Content-Type: application/pdf`, buffer body).

**Dep**: add `@react-pdf/renderer@^4.5.1` to `apps/api`; pin. Add a CI render smoke-test (new prod dep).

**Acceptance**:
- [ ] both endpoints return valid `application/pdf` buffers from seeded content.
- [ ] one-pager PDF embeds the hero press photo (resolved from Garage).
- [ ] CI smoke-test renders a one-sheet from fixture content without error.

### Unit 5 — Primitive manage editor (`creator-press-page-manage-editor`)

**Files**: `apps/web/src/routes/creators/$creatorId/manage/press.tsx` (new) + CSS; nav entry (editProfile) in `manage.tsx`.

**Behavior**: mirrors `manage/join.tsx` — GET/PATCH `/api/creators/:id/press-config` via `apiGet`/`apiMutate`. Primitive form: textareas for bio/for-fans-of/contact, link-list editor, standout-track fields, photo upload (multipart → key → `photos[]`), a releases sub-editor (add/edit one release), and an `enabled` toggle to take the page live.

**Acceptance**:
- [ ] owner/editor edits + saves all fields; viewer gets 403 on PATCH.
- [ ] photo upload adds a key to `photos[]`; `enabled` toggles the public page live/off.

## Implementation Order

1. `creator-press-page-schema` — foundation; everything depends on the contract.
2. `creator-press-page-api` — depends: schema.
3. In parallel after api: `creator-press-page-web-public`, `creator-press-page-pdf`, `creator-press-page-manage-editor` (each depends: schema+api, except manage-editor: api).

Critical-path note: web-public ships the live page for the single; pdf adds the
downloads; manage-editor adds editability. If the deadline bites, trim order is
pdf → manage-editor (seed stays correct) — never web-public or the one-sheet.

## Simplification

- Reuses `creator_join_configs` config-table pattern + `manage/join.tsx` editor
  pattern + `handleImageUpload` photo pattern + imgproxy delivery contract — no
  new infrastructure, no new upload-purpose enum entry (direct multipart, like avatar).
- The generated PDF one-sheet/one-pager supersedes the campaign's stalled PDF
  one-pager + shared-folder plan (per kit-v1 status) — the platform page IS the
  primary surface; the PDF is generated from it, so there's one content source.

## Testing

- **Schema**: migration applies; get/upsert service round-trip (Unit 1).
- **API**: per-route happy-path + auth-failure (403/400/404) — AGENTS route-test convention (Unit 2).
- **PDF**: CI render smoke-test from fixture content — new prod dep (Unit 4).
- **Web**: render seeded content + OG tags present (Unit 3).
- Defer: exhaustive field-validation matrix (patch schema validates); visual PDF regression (fast-follow).

## Risks

- **`@react-pdf/renderer` in the Node/tsx API** — new prod dep. Mitigations: pin
  version, CI render smoke-test; render-in-request is CPU-bound but the docs are
  tiny single-pagers (low cost); cache the rendered buffer keyed by config
  `updated_at` if latency ever matters.
- **Image embed path** — resolving a Garage key → buffer for the renderer needs a
  buffer-returning read on `storage` (the codebase streams via `streamFile`).
  Confirm the exact method on `storage/index.js` in Unit 4 (fallback: stream → Buffer).
- **Deadline vs scope** — five units is ambitious for one drop; trim order is
  pdf → manage-editor (seed stays correct), never web-public or the one-sheet.

---

## Implementation summary

All five child stories advanced `implementing → done` (one commit each);
integrated verification green across all packages.

| Story | Commit | Delivered |
|---|---|---|
| creator-press-page-schema | `183d1fe` | `creator_press_configs` table + migration `0033`; `packages/shared/src/press.ts` Zod contract; `services/press.ts` (get/upsert); AF seed (`animalfuture`, 14.5k standout, SNCR-001 one-sheet) |
| creator-press-page-api | `a6315df` | public press/release GET, authed press-config GET/PATCH, multipart photo upload; mounted at `/api/creators`; 13 route tests |
| creator-press-page-pdf | `c11ee8b` | `@react-pdf/renderer` 4.5.1; `services/press-pdf.ts` (one-sheet + one-pager via `renderToBuffer`); `.pdf` endpoints + public photo-stream endpoint; CI render smoke-test |
| creator-press-page-web-public | `1b32af9` | SSR band-EPK + release one-sheet routes; OG/Twitter meta from loader data (hero photo); photos via indexed stream endpoint; PDF download links |
| creator-press-page-manage-editor | `b842b51` | primitive manage editor (bios, links, standout, photos, releases sub-editor, `enabled` toggle); permission-gated nav |

### Notable
- **Design-flaw catch (schema):** the worker flagged that `PressContentSchema.partial()` retains Zod `.default()` in v4, so a partial PATCH would inject `enabled:false` + empty arrays and corrupt the merge. Resolved with a default-free `PressConfigPatchSchema` (explicit `.optional()`, mirroring `join.ts`) + a regression test.
- **Renderer validated:** `@react-pdf/renderer` 4.5.1 confirmed server-rendering under the Node/tsx API runtime (`renderToBuffer`, `%PDF`); images resolved via `storage.download()` → `Buffer.concat`. The Bun-runtime caveat is moot (API runs on Node).
- **Separate (not this feature):** the dev `snc-liquidsoap` crash-loop was diagnosed + fixed (stale bind-mount path pre-relocation → empty config); confirmed NOT a 2.4.5 regression.

### Integrated verification (2026-08-06)
- `bun run --filter '*' typecheck` — green (shared, api, web, e2e).
- `test-all` — green: shared ✓, api unit ✓ (1922 tests / 120 files), web ✓ (1819 tests / 172 files).
- Working tree clean except pre-existing unrelated `CHANGELOG.md` (untracked) + `.work/bin/work-view` (modified).

### Known follow-ups (not blocking review)
- **Press photos not yet ingested** — seed ships with `photos: []`; operator has shoot photos pending a location. Page renders gracefully without them; upload + display work end-to-end once delivered.
- **imgproxy optimization for press photos** is a fast-follow — v1 serves photos via a raw stream endpoint (matching the avatar-stream pattern); responsive imgproxy descriptors are the platform-consistent upgrade.
- **Per-release one-sheet PDF art/branding** is minimal v1 (Helvetica, plain layout); visual polish is a fast-follow.

---

## Review

**Effective weight:** standard — one independent fresh-context pass (cross-model: `openai-codex/gpt-5.6-sol` vs. the zai orchestrator). **Pass:** 1, verdict Request changes. **Closure:** blockers fixed in `267c692` + verified green; advanced `review → done` under standard closure (no second pass).

### Fixed (`267c692`)
- **Blocker — cross-tenant photo/`artKey` disclosure:** `isOwnedPressKey` helper; PATCH rejects foreign keys (400); the public photo-stream endpoint and the PDF renderer each defensively re-check ownership before serving/buffering (defense-in-depth at write + stream + render). Closes the path where an `editProfile` member could expose other creators' Garage objects (incl. subscriber-only media) via the public press surface.
- **Blocker — soft-404s:** both public loaders now `throw notFound()` on API 404 and propagate non-404 errors (status preserved in `lib/api-server`); graceful `notFoundComponent`s. Real HTTP 404s for disabled/missing creators/releases.
- **Important — release slug uniqueness:** non-empty slug regex + array-level uniqueness refine (duplicates previously resolved to the first match).
- **Important — test gaps:** foreign-key PATCH rejection, owned-stream MIME, foreign-key stream 404, PDF foreign-key refusal, real 404 status, release-page metadata + PDF link.

### Parked (fast-follow)
- Editor pre-save photo preview renders the public indexed URL before save/enable → broken preview for new/draft photos (internal UX; photos not yet delivered). Noted in `creator-press-page-manage-editor.md`.
- imgproxy optimization for press photos (v1 uses the raw stream endpoint).
- One-sheet / one-pager PDF visual polish (v1 Helvetica, plain layout).

### Rejected proposals (reviewer-correct, receiver-confirmed)
Partial-PATCH wipes `enabled`/lists (regression test proves otherwise), PDF/photo route shadowing, `:index` traversal, handle-resolution authz bypass — all verified non-issues.
