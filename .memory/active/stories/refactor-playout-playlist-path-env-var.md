---
id: story-refactor-playout-playlist-path-env-var
kind: story
stage: implementing
tags: [refactor, quality, streaming]
release_binding: null
created: 2026-04-20
updated: 2026-04-20
related_decisions: []
related_designs: []
parent: null
---

Replace the hardcoded filesystem path to the liquidsoap directory in `playout.ts` with a configurable env var, removing the fragile relative-path resolution.

## Scope

- `apps/api/src/services/playout.ts` lines 37–40 — currently uses `path.resolve(import.meta.dirname, "../../../../liquidsoap")` to locate the playlist directory. Replace with a config-driven path.
- `apps/api/src/config.ts` (or wherever the API's Zod config schema lives) — add a new field (e.g. `LIQUIDSOAP_PLAYLIST_DIR`) with a dev-sensible default of the equivalent resolved path so existing local dev setups require no `.env` change.

## Tasks

- [ ] Add `LIQUIDSOAP_PLAYLIST_DIR` (or equivalent name) to the API config Zod schema with a default value equal to the current resolved path.
- [ ] Replace the `path.resolve(import.meta.dirname, ...)` expression in `playout.ts` with `config.LIQUIDSOAP_PLAYLIST_DIR`.
- [ ] Verify `bun --cwd=./platform run typecheck` passes and the playout unit tests still pass.

## Notes

The default value preserves backward compatibility for local dev. Production deployments that mount the liquidsoap directory at a different path can now set the env var without patching source. Keep the default as a `path.resolve` expression computed once at config-load time (not at call time) so the behavior is identical to today.
