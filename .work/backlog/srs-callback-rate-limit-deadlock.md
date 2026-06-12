---
id: srs-callback-rate-limit-deadlock
kind: backlog
tags: [streaming, playout]
created: 2026-06-12
---

# SRS on_publish retry loop × API rate limiter = permanent playout wedge

Observed live in dev (2026-06-12) while bootstrapping the UX-review audit env: when the
on_publish callback fails for any sustained reason (here: empty/unmigrated DB), SRS
rejects the publish, Liquidsoap immediately reconnects and republishes (~1/s), and the
retry storm permanently saturates `srsCallbackLimiter` (30 req / 60s in
`apps/api/src/app.ts`). Even after the underlying failure is fixed, every subsequent
on_publish gets 429 → SRS rejects → Liquidsoap retries → the window never clears. The
playout→SRS chain stays down until an operator manually stops the publisher for >60s.

Evidence: `~/.pm2/logs/api-out.log` continuous 429s on
`/api/streaming/callbacks/on-publish`; `docker logs snc-srs` shows
`on_publish failed ... RATE_LIMIT_EXCEEDED, code=429`; Liquidsoap logs show
`Error while connecting: Avutil.Error(Input/output error)` reconnect loop.

Deeper diagnosis (same session): the wedge has a second persistence mechanism. After
the retry storm, SRS holds **zombie publisher sessions** for the affected streams —
`acquire_publish() ... Resource temporarily unavailable` in `docker logs snc-srs` — so
even once the rate-limit window clears and on_publish returns 200, Liquidsoap's fresh
RTMP connects are bounced at the RTMP layer (`Avutil.Error(Input/output error)` on
output connect), which re-establishes the retry storm and re-saturates the limiter.
Recovery requires restarting BOTH: stop Liquidsoap → restart SRS (clears zombies) →
wait >60s (clears limiter) → start Liquidsoap. Also observed: the generated
`playout.liq` retained a stale third channel (`channel-s-nc-music`) from a pre-wipe DB
state — stale-config drift compounding the storm (one more retry loop than there are
real channels).

Fix directions to weigh at scope time: exempt or key the SRS callback limiter
differently (it's a single trusted caller authenticated by secret — IP-keyed
brute-force limiting may be the wrong tool entirely); or make 429 responses to SRS
return success-with-noop so SRS doesn't treat throttling as rejection; or add backoff
in the generated Liquidsoap config's reconnect policy. Relates to the
`bold-channel-topology` epic's drift-detection feature (this is exactly the class of
silent playout-down state it should surface loudly).
