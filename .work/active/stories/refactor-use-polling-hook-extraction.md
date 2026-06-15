---
id: refactor-use-polling-hook-extraction
kind: story
stage: review
tags: [refactor, quality]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-04-20
updated: 2026-06-15
parent: null
---

## Implementation (2026-06-15)

Extracted to `apps/web/src/hooks/use-polling.ts` — `usePolling<T>(fetcher,
intervalMs, options?)` returning `{ data, isLoading }`. The two sites had a real
divergence (the story anticipated this): playout's `useChannelQueue` returns
`T | null` and re-subscribes on `channelId`; live's `useChannelList` carries an
`isLoading`/SSR-`initial` state and re-subscribes on `initial`. Rather than close
as "pattern diverged," the hook absorbs both via three options — `initial` (SSR
seed; skips the immediate fetch and starts `isLoading: false`), `key`
(re-subscription trigger), `immediate` (defaults to `initial === null`). The
shared core (mount-safe teardown, recursive `setTimeout`, swallow-on-error keeping
last value) lives once in the hook.

Conversions:
- `admin/playout.tsx` `useChannelQueue` → `usePolling` with `key: channelId`; the
  fetcher resolves `null` when no channel is selected (no request fires, status
  resets to null between channels) — preserves the original no-channel behavior.
- `live.tsx` `useChannelList` → `usePolling` with `{ initial }`; the
  immediate-only-if-no-SSR behavior is the hook's default.

Behavior-preserving: web `tsc --noEmit` clean, web unit suite 1737/1737 green (=
baseline). Verified live: `/live` renders the channel selector from SSR, `/admin/
playout` redirects to login (307, no 500), `/api/streaming/status` returns 6
channels.

Extract the duplicated `mountedRef` + recursive `setTimeout` polling pattern from two route components into a shared `usePolling<T>` hook.

## Scope

- `apps/web/src/routes/admin/playout.tsx` lines 53–89 — first polling implementation.
- `apps/web/src/routes/live.tsx` lines 94–129 — near-identical second implementation.
- `apps/web/src/hooks/use-polling.ts` (new) — the extracted hook. Signature: `usePolling<T>(fetcher: () => Promise<T>, intervalMs: number): T | undefined` (or similar; match the actual return shape needed by both call sites). The hook manages `mountedRef` teardown, error swallowing or surfacing, and the recursive timer internally.

## Tasks

- [ ] Create `apps/web/src/hooks/use-polling.ts` with a generic `usePolling<T>` hook capturing the shared pattern.
- [ ] Replace the inline polling block in `admin/playout.tsx` with a `usePolling` call.
- [ ] Replace the inline polling block in `live.tsx` with a `usePolling` call.
- [ ] Confirm both components render and tear down correctly; run `bun --cwd=./platform run --filter @snc/web test:unit`.

## Notes

Read both call sites before settling on the hook's API — the two implementations may differ slightly (error handling, initial state, return shape). The hook should accommodate both without leaking either site's specifics into its interface. If the two sites diverge enough that a shared abstraction would be awkward, document the divergence and close the story as "pattern diverged — not extracted"; but based on the board description they are described as identical.
