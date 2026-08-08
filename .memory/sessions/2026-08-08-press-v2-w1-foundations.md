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
