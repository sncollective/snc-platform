# Session: press-page v2 + content-library — W1 foundations + W2 press-page pair built & reviewed

**Date:** 2026-08-08 (extended)
**Scope:** platform W1 (foundations) + W2 press-page-v2 pair.

## What landed (both at `stage: done`, thorough-reviewed over 2 passes, unbound to a release)

- **`content-library-core`** — content-addressable media library, evolved during the session into a **3-table sharing model** (operator refinement):
  - `content_blobs` (global bytes inventory; sha256-keyed; no creator FK → the dedup + deferred-GC primitive).
  - `content_assets` (registration: `creatorId` NULLABLE, `sharing` enum `private|requestable|open`, tombstone `deletedAt`).
  - `content_asset_grants` (per-creator use grants for `requestable` assets).
  - Permission: **browse** = own + others' `requestable`/`open` (private hidden); **use** = owner OR admin OR `open` OR (`requestable` + grant). `canUseAsset` primitive + grant/revoke endpoints. Admin bypasses for editorial. Request-UI deferred to `content-library-ui` (W2).
  - Key-addressed public raw route (`/api/library/raw/{ab}/{hash}.{ext}`, immutable cache); soft-delete tombstones; re-upload reactivates; ms-precision pagination; format detected from bytes via `image-size` (content-addressability invariant).
- **`creator-press-page-v2-content-model`** — additive v2 superset of the live v1 `PressContent` JSONB: `PressImage {key,alt(required),credit?}`, `members[]`, `gallery[]`, merged `highlights[]`, `template` selector. **`service` OPTIONAL, `label` primary** (+ `website` enum fallback for custom sites) so the live v1 web stays untouched. **Lazy read-time v1→v2 normalization** (presence-aware: explicit empty writes win; absent keys derive from `photos`/`standoutTrack`/`releases`). No DDL, no stored backfill.

## Decisions settled this session (operator)
- **A — sharing model:** browse/use split; per-upload `sharing` (private/requestable/open); global=open blanket, else per-creator grant; admin editorial bypass; nullable creatorId (admin/platform content). Request-UI in W2.
- **B — streaming links:** `service` optional (label primary) — enables custom websites; v2 templates infer the icon from `service` or URL.

## Process lesson (carried forward)
- **"commit ONLY the story/feature file" was read literally → workers committed only the `.md`, leaving all implementation code uncommitted.** A thorough review caught it. Fix in future worker briefs: *"commit the item's stage transition together with its implementation code, scoped to that item (no bundling other items)."* Verify `git status` is clean after each wave.

## Other fixes / research captured
- **`s3-storage.head()` latent contract bug fixed** (commit `640ce21`): HeadObject 404 is error.name `NotFound` (not `NoSuchKey`); generalized to `NotFound`|`NoSuchKey`|HTTP-404. Brought the S3 adapter into compliance with its own `storage-contract.ts`; verified on real Garage. (Surfaced by content-library's dedup.)
- **Research → in-repo skills:** `.claude/skills/image-size/SKILL.md` (format-detection/dims seams incl. throw-on-unparseable); deepened `.claude/skills/imgproxy-v3/SKILL.md` with the **crop/section-picker seam** (render-time crop `c:..:fp:../rs:fill`, no derived asset, per-use crop metadata on the reference; `crop_ar` is Pro-only; current `buildImgproxyUrl` is width-only → image-management needs a slot-aware variant).
- **4 pre-existing integration failures parked** (`.work/backlog/integration-channel-lifecycle-fk-fixture.md`): channel-lifecycle FK fixture + test-control-gating — test-isolation/env debt, unrelated to this wave.

## Rigor policy (set this session)
- **Foundations → thorough** (converge to clean). **Standard** for most W2/W3. **Thorough** for templates + editor (size/risk/UI). Orchestrator is NOT multimodal — vision subagent (`gpt-5.6-sol`) mandatory for any UI/mockup verification; pair with a code grep on exact strings (emails/domains).

## Carry-forwards (updated)
- **DONE this session (all thorough-reviewed, `stage: done`, unbound to a release):**
  - W1: `content-library-core` (3-table sharing model), `creator-press-page-v2-content-model` (service-optional + lazy normalization).
  - W2 press-page pair: `creator-press-page-v2-templates` (Template A+B + selector + streaming icons + carousel, **mockup-fidelity independently verified**), `creator-press-page-v2-image-management` (crop/section picker via the imgproxy seam + credits + the **live photo-editor fix** + the content-library permission integration). Keystone seam (`PressImage.crop` + `PressImageSlot` + `buildPressImageUrl`) committed.
- **W2 (4 features, all unblocked now):** `content-library-ui` (browse/reuse picker + request-access flow), `content-library-migration` ([refactor] — migrate existing per-surface images onto the library; touches live surfaces), `creator-press-page-v2-image-management` (crop/section picker via the imgproxy seam + credits + the live photo-editor fix; consumes `canUseAsset`), `creator-press-page-v2-templates` (Template A+B+selector+icons+carousel; **mockups LOCKED** at `.mockups/screens/creator-press-page/final-{1,3}.html`).
- **W3:** `creator-press-page-v2-editor` (the **one unmocked surface** — mock via ux-ui-design:screens when designed), `creator-press-page-v2-pdf` (one template render → web + PDF).
- **AF shoot photos not delivered** → press page ships empty; slots in via the v2 editor.
- **0.4.0 is `released` but NOT collapsed** (delete-refs deferred until operator verifies in prod) — don't collapse it.
- **Demo auto-seed lives in the PARENT SNC repo** (`.forgejo/workflows/platform-deploy-demo.yml`); coordinate cross-repo via the mesh (peer: `/home/agent/projects/SNC@SNC`).
- **@tanstack/start-* is NOT co-versioned** — never pin individual sub-packages via `resolutions`.
- **Foundations unbound to a release** — operator picks the version when scoping the next release (0.5.0?).

## Update 2026-08-09 — all W3 mocks locked (design phase complete for press-page-v2)

Both remaining mock surfaces are locked (operator sign-off), so every press-page-v2
surface is now mocked before implementation:
- **PDF** (`creator-press-page-v2-pdf`): MVP = clean web-matching **full** PDF
  (the locked templates' `@media print` output) + a distinctly-designed **1-sheet**
  in two parallel layouts — horizontal-lead (`option-1`) + vertical-lead (`option-2`,
  calmer/condensed) — at `.mockups/screens/creator-press-page-v2-pdf-onesheet/`.
  **Color scheme** is creator-pickable (Editorial Light / Dark default / Creator
  Brand Accent). **Brand color lives on the profile** (`creatorProfiles.brandColor`)
  for site-wide reuse. **QR → customizable URL** (default = creator's linktree).
  **Zine/edgy direction parked** (`.mockups/screens/creator-press-page-v2-pdf/zine-stretch/`)
  as a stretch goal. **Per-release one-sheet** is a near-term reuse of this template.
- **Editor** (`creator-press-page-v2-editor`): tabbed workbench (About / Members /
  Highlights / Links & contact / Appearance & media) with a **draft/publish model**
  (draft vs published — implies a `draftContent` schema field), cross-tab error
  summary, image ownership fixed, aspect-correct crop preview, WAI-ARIA tabs.

## New infra/skills this leg
- **`.claude/skills/print-design/SKILL.md`** — the enforcement layer for print/PDF
  mocks (Letter geometry, grid/baseline, print type floors, spacing scale, QR sizing).
  Born from an adversarial review that diagnosed "knows the vocabulary, doesn't
  enforce it." Generalizes to per-release one-sheets + future print work.
- **Disk hygiene:** the mock-validation passes pile up firefox profile/screenshot
  dirs in `/tmp` (~1.5G here → ENOSPC mid-subagent). Periodically
  `rm -rf /tmp/ffp-* /tmp/ff-* /tmp/<screenshot-prefix>-*`.

## Next (not started): feature-design + implement W3 (pdf + editor) — the editor
feature-design scopes the draft/publish content-model change + the
`creatorProfiles.brandColor` field. Then W2 remaining: `content-library-ui`,
`content-library-migration`. Everything still unbound to a release.

## Update 2026-08-10 — DRAIN COMPLETE (autopilot)

The full press-page-v2 + content-library build drained via autopilot. All 11 features
DONE across both epics; both epics at `review` (all children done — ready for the
operator's aggregate epic review). Final verification: shared ✓, api unit 2006 ✓,
api typecheck 0, web 1905 ✓, web typecheck 0.

**Shipped this drain:** content-library-page (Notion-like image library), content-media-picker
(app-wide picker), creator-press-page-v2-editor (tabbed workbench + draft/publish),
creator-press-page-v2-pdf (Chromium-print full + 1-sheets + color schemes), the
brand-color + draft-publish foundations, content-library-migration (re-point onto library).
Plus earlier: content-library-core, content-model, templates, image-management.

**Follow-ups (not blocking):**
- `pdfTheme` persistence (editor previews but doesn't save — needs a content-model field).
- Chromium provisioning in prod/devcontainer (deploy follow-up; the e2e-only installer doesn't cover the API PDF path).
- SSR `fetch failed` (unrelated, pre-existing) blocks the live full-PDF e2e proof.
- The 4 pre-existing parked integration failures (channel-lifecycle FK + test-control gating).
- Parked: the unified-media-library vision (video/audio + manage consolidation), per-release one-sheets, the zine/edgy PDF + web template stretch goal, Bandsintown live-dates.
- Everything unbound to a release.
