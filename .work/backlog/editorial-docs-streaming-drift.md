---
id: editorial-docs-streaming-drift
kind: backlog
tags: [streaming, playout, documentation]
created: 2026-06-17
---

# docs/streaming.md foundation-doc drift (from editorial-engine deep review)

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
