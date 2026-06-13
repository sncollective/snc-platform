---
id: refactor-playout-playlist-path-env-var
kind: story
stage: done
tags: [refactor, quality, streaming]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-04-20
updated: 2026-06-13
parent: null
---

Replace the hardcoded filesystem path to the liquidsoap directory in `playout.ts` with a configurable env var, removing the fragile relative-path resolution.

## Closed obsolete (2026-06-13)

Re-grounding at implement time found the story's target no longer exists. The
`path.resolve(import.meta.dirname, "../../../../liquidsoap")` playlist-directory resolution
in `playout.ts` (story Scope lines 37–40) was **eliminated by the 0.2.1 playout rework**
(`c00a02bf`, "reworking the playout system"). That rework replaced the M3U-file playlist
model with a request-queue model — `playout-ingest.ts:27` records it explicitly:
*"when the queue needs filling — no playlist to regenerate."* `playout.ts` no longer
imports `node:path` and resolves no filesystem path.

The story's intent (env-drive the liquidsoap dir instead of patching source for non-default
mounts) **is already satisfied** for the one liquidsoap path that survived: the config-file
directory in `liquidsoap-config.ts` resolves `config.LIQUIDSOAP_CONFIG_DIR ?? DEFAULT_LIQUIDSOAP_DIR`
(`LIQUIDSOAP_CONFIG_DIR` is a Zod-schema field at `config.ts:78`, default computed once at
config-load via `resolve(import.meta.url, ...)` — exactly the "computed once, identical
behavior" shape the story's Notes asked for).

Verification: `grep` for `import.meta.dirname` / `__dirname` / hardcoded `liquidsoap`-or-
`playlist` path resolution across `apps/api/src` returns only `liquidsoap-config.ts`'s
already-env-driven `DEFAULT_LIQUIDSOAP_DIR`. No remaining hardcoded writable playout path.

No code change. Sibling-pattern note: this is the second 0.4.x refactor story whose scope
was silently completed by the 0.2.1 playout rework (cf. `refactor-playout-stream-names-dedup`,
re-grounded the same way). Future stale-story sweeps of pre-0.2.1-authored refactors should
expect more of these.

## Tasks

- [x] Add `LIQUIDSOAP_PLAYLIST_DIR` to config — N/A: no playlist dir to configure (M3U model retired).
- [x] Replace the `path.resolve` expression in `playout.ts` — N/A: expression no longer exists.
- [x] Verify — confirmed by grep sweep; the surviving liquidsoap path is already env-driven via `LIQUIDSOAP_CONFIG_DIR`.
