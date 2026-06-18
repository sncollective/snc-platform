---
id: editorial-docs-streaming-drift
kind: backlog
tags: [streaming, playout, documentation]
created: 2026-06-17
updated: 2026-06-18
---

# docs/streaming.md foundation-doc drift (the consolidated roll-forward)

> **Consolidated 2026-06-18 (groom):** this is the single "roll `docs/streaming.md` forward" item.
> Two narrower streaming-docs items merged in (their §-specific content is captured under
> "Additional sections to roll forward" below): `docs-streaming-simulcast-drift` (the §Simulcast
> destination-tier gap — which had itself already absorbed `documentation-simulcast-destinations-coverage`)
> and `documentation-streaming-account-connect-coverage` (the OAuth-connect coverage check). When
> picked up, do them as one pass over the doc.

`docs/streaming.md` predates the editorial engine + the prior multi-channel/identity work and no longer
matches the system. Rolling-foundation requires it roll forward. Concretely wrong:

- **Harbor API table** (lines ~108-123): lists `/now-playing`, `/classics/now-playing`, `/classics/queue`,
  `/reload-playlist`. The real per-channel surface is `/channels/:id/{queue,skip,now-playing,mode,arm,manual}`
  + `/channels/:id/pool/next` + `/admin/shutdown`. No `/classics/*` or `/reload-playlist`.
- **Engine model** (lines ~19, 41, 72, 84-94): describes an M3U playlist + `regeneratePlaylist()` reload and
  "two output channels — S/NC TV and S/NC Classics." The engine is now DB-driven `.liq` regeneration
  (`generateLiquidsoapConfig` → `regenerateAndRestart`) with per-channel blocks + the static S/NC TV block.
- **Version** (line ~86): says `Liquidsoap v2.4.2`; the Dockerfile is now `v2.4.5`.
- **No mention** of the editorial model: modes (manual/auto/off), tiers (live/queue/channel-as-source),
  the queue+pool program source, LRP pool, arm/take, manual-pin, channel-as-source carry.
- **Creator channels** (line ~35): "temporary, created on stream, deactivated on stop" — identity-lifecycle
  made them persistent (lazy provisioning).

Roll the Harbor API table + the playout-engine/configuration sections forward to the editorial model. The
S/NC TV broadcast-block prose can stay until `snctv-composition` migrates it. `gate-docs` will also catch
this at release-deploy; filed here so it's tracked from the feature review.

## Additional sections to roll forward (merged in 2026-06-18)

### §Simulcast — the creator-scoped destination tier (from docs-streaming-simulcast-drift)
`docs/streaming.md:64` asserts "Simulcast sits on the playout output, not on individual creator
streams" — but a creator-scoped tier exists the doc doesn't acknowledge: `simulcast.ts` carries a
`creatorId` column with creator CRUD (~146–169) and creator-forward semantics ("Creator forward
changes apply on next stream — no SRS restart needed", ~203); the manager UI
(`simulcast-destination-manager.tsx`) is mounted on the creator manage surface. Fix: name **both**
destination tiers (playout-output/admin-managed vs creator-scoped) and the **reload-semantics
split** the audit code-confirmed — admin destination changes apply immediately; creator changes
apply on next publish. Related active story `creator-simulcast-semantics-note` fixes the UI side;
this fixes the doc. (Origin: `streaming-playout-ux-review` 2026-06-12, findings A5 + C3.)

### §Account-connect — Twitch/YouTube OAuth coverage (from documentation-streaming-account-connect-coverage)
Confirm `docs/streaming.md` covers the OAuth connect flow: the separate-from-social-login scopes
(`channel:read:stream_key`, `youtube.force-ssl`), auto-created inactive simulcast destinations, and
the required `YOUTUBE_CLIENT_ID` env var. Files: `services/streaming-connect.ts`,
`routes/streaming-connect.routes.ts`. (Forwarded from release-0.2.2, 2026-04-11.)
