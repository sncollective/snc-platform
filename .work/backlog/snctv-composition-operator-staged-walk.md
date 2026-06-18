---
id: snctv-composition-operator-staged-walk
tags: [streaming, playout, deploy]
release_binding: null
created: 2026-06-18
---

# [deploy] S/NC TV composition — operator staged walk (prod-verification)

`unified-channel-model-snctv-composition` shipped to `done` (2026-06-18) with the machine-checkable
close gate verified on the dev pipeline (config/render equivalence, harbor now-playing shape,
input-switch telemetry round-trip — all green). The remaining checks need airing content + real RTMP
+ simulcast, so they're operator-at-station — relocate into the **Prod verification** section of
whatever release ships this work (the editorial-engine precedent, `release-0.4.0.md §Prod
verification`).

## Operator walk (run on the live/staged pipeline)

1. **Content-airing now-playing.** With real media on S/NC Classics (the carried source), confirm
   S/NC TV's now-playing (`/channels/<broadcast-id>/now-playing`) reports the carried track's
   `uri`/`title` — not blank. (This is the BLOCKER-1 fix's runtime behavior; dev couldn't show it
   because Classics was airing `mksafe(blank())` with no seeded media.)
2. **Creator takeover.** Push a real RTMP creator stream to the broadcast `:1936` input → confirm
   S/NC TV switches to it (priority-0 live tier preempts), and the input-switch telemetry posts
   `source=live` to the live-state holder.
3. **Fall-back.** Stop the creator stream → confirm S/NC TV falls back to the S/NC TV queue, then to
   carried Classics, then silence — and the telemetry posts the corresponding source name on each
   switch. (Validates the `fallback(transitions=[…])` firing semantics — the SPIKE NOTE; if
   transitions prove unreliable, the `thread.run is_ready()` poller is the documented fallback.)
4. **Viewer + simulcast.** Confirm the viewer HLS at `/live` shows the takeover + fall-back, and that
   any configured Twitch/YouTube simulcast destinations mirror what S/NC TV airs (simulcast sits on
   the `snc-tv` output — the generated `output.url` was verified to target `snc-tv`).

Origin: `snctv-composition` feature close gate (the staged walk named in its §Design decisions).
Machine-checkable parts already verified — see the feature's staging-walk record in git history
(archived stub `git_ref`).
