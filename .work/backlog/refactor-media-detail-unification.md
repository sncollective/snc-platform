---
tags: [refactor, quality, content]
created: 2026-04-20
---

Three near-identical pairs of content-detail components exist across the web app's content layer. Each pair handles audio and video variants of the same UI pattern with ~90% shared logic. The duplication is structural — it spans orchestration, locked-gate state, and player integration — meaning any future change to content detail behavior (e.g., adding a new media state, changing footer rendering, updating player hooks) requires touching six files instead of two or three. The design step needs to commit to a unification approach before implementation so that the sweep is consistent rather than piecemeal.

## Current state

### Pair 1 — Detail orchestrators: `audio-detail.tsx` / `video-detail.tsx`

Files: `audio-detail.tsx:39-181`, `video-detail.tsx:41-178`. Approximately 140 LOC each, ~90% shared.

Both files implement the same structure: a locked gate check, a missing-media early-return state, an editing branch that renders metadata and media controls, and a footer. The divergence is limited to the player component rendered in the non-editing view and which content type's fields are referenced.

### Pair 2 — Locked views: `audio-locked-view.tsx` / `video-locked-view.tsx`

Files: `audio-locked-view.tsx:21-58`, `video-locked-view.tsx:21-61`. Approximately 37-40 LOC each, structurally identical.

Both render a broken-image fallback state, a thumbnail, locked text, `ContentMeta`, and `ContentFooter`. The only divergence is the thumbnail source (audio cover art vs. video poster).

### Pair 3 — Detail views with player integration: `audio-detail-view.tsx` / `video-detail-view.tsx`

Files: `audio-detail-view.tsx:24-152`, `video-detail-view.tsx:24-100`. Both implement:

- Identical `useEffect` calling `setActiveDetail` on mount/update
- Identical `MediaMetadata` construction (title, artist, artwork)
- Identical play-overlay structure: a div (now `<button>` after the accessibility fix) with a keyboard handler
- The same GlobalPlayer integration pattern

Divergence is limited to which player component is rendered and which media-type-specific fields (e.g., duration, bitrate for audio; resolution for video) are displayed.

Prior accessibility fixes landed on this pair: the play-overlay `<div role="button">` was replaced with `<button type="button">` in both files separately. Any future fix to this pattern still requires double-editing unless unified.

## Options under consideration

### Option A — Single component with `type: "audio" | "video"` discriminator

Introduce a `MediaDetail` component accepting a `type` prop (and the relevant content item). Internal branches handle the handful of divergence points (player component, media-type-specific metadata fields, thumbnail source). `LockedView` becomes a single component parameterized by thumbnail source and media label.

Trade-offs:

- Smallest file count; one place to read for the full pattern
- `if (type === "audio")` branches are visible and easy to follow for narrow changes
- Adding a third media type (e.g., "document") extends via a new branch — no new file needed
- Branching inside the component means an agent editing the audio path must parse the video path to understand context (and vice versa)

### Option B — Generic `MediaDetail<T>` with type-specific composition

Define a generic orchestrator that accepts type-level composition objects (player component, metadata extractor, thumbnail resolver) as props or a config object. Each variant (audio, video) provides its own composition object and calls `<MediaDetail config={audioDetailConfig} item={item} />`.

Trade-offs:

- Branching moves from runtime conditionals to composition at the call site — the component body is clean
- More TypeScript surface to maintain: generic constraints, config interface, each variant's config object
- Harder for an agent to follow a single variant's rendering path without tracing through the generic machinery
- Flexibility is higher but the use case (two variants, stable divergence points) doesn't strongly motivate the complexity today

### Option C — Variant dispatch at route level with shared primitives only

Keep `audio-detail.tsx` and `video-detail.tsx` as variant files, but extract the shared structural primitives they both use: a unified `LockedView` component, a `useMediaDetail(item)` hook encapsulating the `setActiveDetail` effect and `MediaMetadata` construction, and a shared play-overlay component. Variants remain variant files, but ~70% of their lines become shared imports.

Trade-offs:

- Variant files remain as clear fallback targets: an agent editing audio behavior opens `audio-detail.tsx` and finds only audio-specific logic
- The dedup win is real but incomplete — structural duplication inside each orchestrator (the locked check, missing-media state, footer rendering) remains unless also extracted
- Adding a third media type requires a new variant file and wiring up the shared primitives — more initial work than Option A but clearer separation
- Consistent with how the codebase currently handles `SimulcastDestinationManager` (shared component) + per-context call sites

## Design questions

1. **Which approach balances dedup win against agent-workflow clarity?** Option A maximizes dedup but puts both variants in one file, which increases the cognitive load when an agent only needs to touch one variant. Option C preserves variant clarity but leaves some structural duplication in the orchestrator pair. Option B is the most flexible but adds the most type-system overhead. The design step should pick one and name the trade explicitly so implementation does not revisit it.

2. **Where do the unified primitives live?** `LockedView` and the play-overlay component would move to `components/content/` or `components/media/` — confirm the right subdirectory given the existing component organization before the sweep creates new files.

3. **Hook naming and location.** `useMediaDetail(item)` is the candidate name for the shared hook encapsulating `setActiveDetail` + `MediaMetadata` construction. Confirm it fits the `apps/web/src/hooks/` convention and does not conflict with existing hook names.

4. **Scope of the unification.** The three pairs can be unified in a single pass or in two stages (locked views first as they are simplest, then detail orchestrators + player views). Does the design step need to specify ordering, or is a single-pass sweep acceptable given the shared-primitive extraction is the hardest part?

## Out of scope

- The `event-form.tsx` complexity item (18 `useState` calls) — separate backlog entry, different component family.
- Accessibility gap: missing transcript links for audio and `<track kind="captions">` for video — flagged in the accessibility scan as an architectural gap requiring backend support. Not blocked by this unification but not resolved by it either.
- Upload and media playback context layer (`upload-context.tsx`, `audio-player.tsx`, `mini-player.tsx`) — covered by the upload-media-controls analysis and tracked separately.
