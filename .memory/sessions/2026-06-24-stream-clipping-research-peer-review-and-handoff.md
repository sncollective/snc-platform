# Stream-clipping research campaign — cross-model peer review + backlog handoff (2026-06-24)

Ran the **`stream-clipping-twitch-parity`** research campaign (the "A" surface — Twitch-parity
stream/VOD clipping, creator + viewer clips), put it through **cross-model peer review**, and
handed off to **backlog** (a buildable feature, unlike the editor engagement's position-only
outcome).

## What happened

- **Campaign** via `agentic-research:research-orchestrator` at `mixed` / `full`. 3-facet fan-out
  (`clip-extraction-stack` — read the actual `srs.conf` + Drizzle schema; `viewer-ugc-product`;
  `clipping-comparators`). All gates passed: lint → adversarial-read (1 clause fixed) → evaluate
  (APPROVED 5/5/5/4) → spot-check (4 candidates clean).
- **Cross-model peer review** (Codex via peeragent, 3 passes, converged). This earned its keep:
  the same-model verification stack (all Opus) had passed it, but Codex caught **8 substantive
  issues** — most valid — plus 3 refinements. The blind spots were real, not nits.
- **Handoff → backlog.** Grounded the pre-existing `streaming-clip-creation` item (the research
  answered its open click-at-second-10 edge + corrected its schema) and emitted 3 new items
  (`streaming-clip-dvr-enablement`, `streaming-clip-moderation-dmca`,
  `streaming-clip-live-edge-instant`). Deleted the now-superseded pre-ARD `video-editing-tools.md`.

## Key findings (the build picture)

- **DVR is the prerequisite for *stream-derived* clips** — the platform records nothing persistent
  today (no DVR; ~10s ephemeral HLS window). But clipping an **already-uploaded VOD** needs no DVR
  (FFmpeg straight from Garage) — the cheapest first slice. YouTube's docs corroborate DVR-as-substrate.
- **YouTube-parity first** (post-stream / uploaded-VOD clipping), **Twitch-parity later** (instant
  live-edge from a ~85s rolling buffer — the 10s→85s *rewind-depth* gap, separate from latency).
- **Extraction is cheap** — FFmpeg stream-copy (keyframe-bounded), reusing processing-jobs/pg-boss/Garage.
- **Viewer clips = mostly product-surface** — permissions, attribution, clip page + OG, discovery;
  the new platform concerns are **UGC moderation + DMCA §512** and **storage** (full-copy + dedup
  by source+offset, *not* pHash as primary).

## What cross-model peer review caught that ours didn't (the lesson)

The same-model stack (lint + adversarial + evaluate + spot-check, all Opus) shares blind spots.
Codex, on the same artifact, caught:
1. **DVR overstated as the *universal* prerequisite** — uploaded-VOD clipping needs none. (Our
   stack reinforced the over-claim.)
2. **The "4 schema fields" undersold it** — viewer clips need clipper identity (**not**
   `content.creatorId`, a creator-profile FK — Codex read the schema), moderation/visibility state,
   storage-object key.
3. **§512 subsection precision** — counter-notice is §512(g), repeat-infringer §512(i), not all (c).
4. **pHash is a weak primary dedup key for video** — (source + tolerance-bucketed offsets) is reliable.
5. **"YouTube-shaped MVP" mislabeled** creator-delete (a co-op divergence, not YouTube parity).
6. Plus: retention-vs-latency conflation, `on_dvr` path-inside-SRS + reconciliation-sweep,
   YouTube create-during-live-vs-playable-after.

**Takeaway:** run cross-model peer review on research synthesis even after a full same-model
verification stack — the catches (a factual over-claim, real legal-subsection errors, a
schema/FK detail) were the kind only a different model surfaces. Cheap insurance for buildable
findings about to become work items.

## State

- Campaign + position-equivalent (the build recommendation) committed; clip cluster in `.work/backlog/`
  (4 items, `research_origin: stream-clipping-twitch-parity`), `streaming-clip-creation` the grounded
  anchor with the 3 siblings.
- `video-editing-tools.md` deleted (fully superseded: clipping → this campaign; in-browser-NLE →
  de-scoped by the editor engagement).
- Editor engagement (prior arc) landed as the `video-editor-integration` **position** + one Garage
  Range-check story.

## Next

- `/agile-workflow:scope` on the clip cluster when clipping moves to active build.
- The Garage Range-check (`verify-garage-presigned-range-support`) gates clip-page seeking too —
  shared with the editor engagement.
- Acquisitions still open: Kick clip docs (403), Twitch help-UI (JS-rendered), Twitter/X player card.
