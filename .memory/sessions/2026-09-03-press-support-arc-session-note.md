# Session note — press-support arc through debrief (2026-09-02/03)

For the next session's agent. This was an exceptionally long arc: the full
animal-future press cycle (EPKs, one-sheets, single-release companion) built
on `campaign/press-support`, through to the operator debrief and forward
platform scoping. The deep lessons live in the retrospective (below); this
note is the operational state.

## Where everything is

**Branch:** `campaign/press-support` (from main @ 58521d0), ~164 commits,
**merge-not-rebase held throughout** (root submodule pointers record branch-
tip SHAs; campaign bumps several). The merge is the operator's call, pending.

**Live artifacts** (dev stack, API on :3000, web on :3080):
- Band one-sheet: `GET /api/creators/:id/press/one-sheet.pdf?orientation=vertical|horizontal&theme=dark|light` — pinned deterministic templates (vertical compact / horizontal normal), space-between slack distribution, bounded row sections
- Release one-sheet: `GET .../releases/:slug/one-sheet.pdf?theme=`
- Release EPK companion: `GET .../releases/:slug/epk.pdf?theme=` — half-Letter 5.5×8.5, story-led, solo/triptych hero modes, pre-save callout when preSaveUrl set
- One-pager: `GET .../one-pager.pdf?theme=` (prints live web page — still carries 7 luminosity masks, PARKED for operator taste pass; see backlog)

**The retrospective (the debrief record):** `.memory/sessions/press-kit-retrospective-2026-09-03.md` — operator theses validated, verification culture, latent races, variant model, campaign-lane input + disposition, process takeaways. READ THIS FIRST for the why.

**Typesetting research + architecture decisions:** `docs/typesetting-toolchain-landscape.md` — Typst (agent-native authoring, separate project per operator), Paged.js/Vivliostyle (CSS paged growth), IDML interchange (pro designers), Figma (exploration only), design primitives as the shared source language across all surfaces.

## Features scoped, awaiting design passes

- `press-kit-template-picker-and-image-specs` — user-facing picker, computed per-slot image specs, variant model (template = style identity; variant = tested content configuration with measured capacity contract)
- `press-kit-programmatic-surface` — agent/API twin: render manifest (ground truth from the renderer), intelligent image ingestion, content API with dry-run fit, render diffing, decoupled render worker, schema discoverability

## Standing agreements (mesh)

- Campaign agent: `/home/agent/projects/SNC/records/animal-future@animal-future` on the outpost-pi broker. Lane split: campaign owns content/staging/proofs (seed-press.ts commits, their repo); platform owns code. Every landing verified BOTH sides with measurements. Taste calls routed to the operator, never picked silently.
- The campaign's debrief: their side `.memory/sessions/2026-09-03-agent-experience-debrief.md` (commit 26f206a6).
- Restart-race protocol: after any pm2 restart, the campaign re-renders fresh before verifying (4 stale-render false defects this session; the hydration race is killed via script-blocking routes, but restart timing still bites).

## Open items

- **Operator calls pending:** one-sheet fade ratification + full-bleed polish (vertical rail); QR phone scan (physical device); the branch merge (debrief done — landing whenever called); LeAnna face tint (noted then retracted as wrong-chat — may resurface).
- **Parked:** one-pager luminosity masks (7, needs operator taste pass on web hero changes); exposure-lift on EPK triptych center (one-line SVG filter when ruled); facts-one-ink variant on horizontal hero.
- **Backlog:** `press-animalfuture-qr-destination-hardcode` (seed socialLinks, drop the handle special-case); the upload utility exists (`apps/api/src/scripts/press-asset.ts`).

## Hard-won technical rules (the short list)

1. page.evaluate callbacks: inline-only, no named helpers (tsx keepNames breaks in-browser)
2. Spawn plumbing: node:child_process, drain stderr concurrently, test under tsx not bun
3. Programmatic replaces: ALWAYS assert
4. Image geometry: extract-embedded-raster-and-compare is the only verification that can't be fooled
5. Print = deterministic/pinned; over-budget content 400s loudly with trim guidance
6. Aspect-derived windows (probe upload dims, clamp, match print spec) — WYSIWYG for any portrait upload
7. Script resources route-blocked before navigation (hydration race kill — 8/8 deterministic)
8. Slack distributes via space-between; row sections are bounded fixed-height boxes with centered content
9. imgproxy q:95 on print URLs (default ~76 reads soft)
10. The campaign lane's flash passes carry measurement instructions when hierarchy is in question

## Session shape

76 implementation rounds (conversational; 28 substrate stories + 3 features); ~60 mesh crossings; 2 provenance catches (operator);
3 latent races killed; 4 restart races survived; 10+ image-geometry rounds
converging to aspect-derived WYSIWYG; 2 model swaps (usage limits); the
operator drove every material fix through 15+ review rounds. The branch
tells the whole arc commit-by-commit for the merge debrief.
