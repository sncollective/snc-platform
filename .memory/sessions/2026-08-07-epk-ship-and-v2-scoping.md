# Session: EPK ship, 0.4.0 release, press-page v2 + content-library scoping

**Date:** 2026-08-05 → 2026-08-07
**Scope:** platform (@snc/api, @snc/web, @snc/shared) + cross-repo (parent SNC via the SNC agent)

## What shipped
- **`creator-press-page` (EPK)** — designed, built (5 stories: schema/api/pdf/web-public/manage-editor), independently reviewed (standard pass; 2 blockers fixed — a cross-tenant photo-key disclosure + soft-404s), bound to 0.4.0, a11y/scan-fixed, **shipped** (live for the AF single, SNCR-001 "The Illusionist", Aug 6). v1 is a single hardcoded layout — it shipped *without* a design pass.
- **Release 0.4.0 → `released`.** Late-bound the EPK; gate posture = the original 6-gate loop (converged 2026-06-29) + the EPK's feature review + targeted scan. **Not collapsed** (delete-refs deferred until the operator fully verifies in prod).

## Dep / infra work this session
- **Audit-gate clearance:** the demo-deploy CI `bun audit` gate failed on 1 critical (seroval) + 3 high (undici, js-yaml ×2). Cleared via the project's `resolutions` field (undici ^8.9.0, seroval ^1.6.2, js-yaml ^5 — the omap fix wasn't backported to 4.x, hono ^4.12.34) + drained most moderates (hono-node-server→2.x, srvx, @tanstack/start-server-core attempted then reverted, esbuild, postcss, fast-xml-parser, opentelemetry). Down to 1 low (@babel/core — no fix released). **Build break:** a `@tanstack/start-server-core` resolution desynced the family + crashed `createVirtualModule` in CI's clean install — reverted. **Lesson:** the `@tanstack/start-*` family is NOT co-versioned (react-router 1.170.x vs react-start 1.168.x) — never pin individual sub-packages.
- **Dev env degraded → partly recovered:** postgres/garage/srs were down (postgres has no restart policy); brought postgres+garage up. **Fixed the `snc-liquidsoap` crash-loop** — stale bind-mount path (container created from `/home/agent/SNC/platform` pre-relocation; repo now at `…/projects/SNC/platform`) → empty config → "syntax error line 1 char 0." Force-recreated from the correct dir; healthy. **Not a 2.4.5 regression** (de-risks the 0.4.0 streaming story). Residual: RTMP-to-SRS retry error until the API (pm2) is up + channels provisioned.
- **Demo "no admin" trap:** the demo env isn't auto-seeded → no guaranteed admin → operator couldn't reach `/admin/creators`. The SNC agent built an idempotent auto-seed in the parent repo's `.forgejo/workflows/platform-deploy-demo.yml` (commits `12bf3a3d` + `b007a51d`). One miss: committed-but-not-pushed initially → the operator's demo deploy ran the old workflow (no seed); now pushed. Live-demo idempotency verification is the operator's (next demo deploy). Parked platform-side refinements (`seed-demo-hardening`): a `--check` smoke + guard-hardening (the `seed:demo` script hardcodes `ALLOW_DEMO_SEED`).

## Press-page design pass (the gap the v1 shipped with)
- Ran the `ux-ui-design` mockup iteration. Iterated options → option-4 (image-led) → magazine riffs → **locked two templates**: **Template A (clean editorial)** + **Template B (two-column zone)** at `.mockups/screens/creator-press-page/final-{1,3}.html` (+ `final-index.html`, `../../design-system/tokens.css`). Committed.
- **Key learning:** the orchestrator model isn't multimodal — mockups need a vision-capable subagent (openai-codex/gpt-5.6-sol) to screenshot + verify (centering/overflow caught this way). Now mandatory in mockup briefs. Pair with a code-check on exact strings (emails/domains) — the visual pass missed an `snc.org`/`s-nc.org` hyphen the code-check caught.
- Folded into the design: streaming-service icons, Bandsintown live-dates list (researched; separate epic), carousel gallery, photo credits (burn-in), an image crop/section picker (accept size range, crop per slot).

## v2 + content-library scoping (the next build)
- **`creator-press-page-v2` epic** (5 features): content-model, image-management (crop picker + credits + photo-editor fix), templates (A+B+selector), editor, pdf. Templates' mockups locked; **editor UI mockup deferred** (the one unmocked surface).
- **`content-library` epic** (3 features: core/ui/migration) — the operator chose a platform-wide **content-addressable media library** (dedup by hash; one asset copy referenced across avatar/banner/content/press) over a press-scoped dedup. **`creator-press-page-v2-image-management` depends on `content-library-core`.**
- **`bandsintown-integration`** parked as its own epic (reusable: press + creator pages).
- Build waves (not started): **W1** `content-library-core` + `creator-press-page-v2-content-model` (parallel) → **W2** (image-management, library-ui, library-migration, templates) → **W3** (editor, pdf).

## Open
- **0.4.0 prod verification** (operator) — then the delete-refs collapse.
- **The v2 build** (8 features across 2 epics) — start with `feature-design` on the two foundations.
- **Shoot photos** for the AF press page (operator; ships empty, slots in via the editor).
- **Editor mockup** when the editor feature is designed.
- **Demo auto-seed live verification** on the next demo deploy (operator).
