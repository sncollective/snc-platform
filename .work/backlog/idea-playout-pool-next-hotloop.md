---
id: idea-playout-pool-next-hotloop
created: 2026-07-01
updated: 2026-07-01
tags: [playout, observability]
---

# Liquidsoap `pool/next` callback hot-loops (~9 req/s continuously)

## Symptom (observed)

The `api` pm2 process logged ~795 MB to `~/.pm2/logs/api-out.log` over ~2.5 days
(Jun 29 → Jul 1 01:35), almost entirely pino `Request completed` INFO lines for one
endpoint:

    GET /api/playout/channels/895e30b6-0a84-4f01-816a-4cee881c1a31/pool/next

Poll rate in the final hour was **~540 req/min (~9 req/s), steady-state, nonstop** —
not once-per-track. Every request returned `statusCode: 200` with `responseTime: 1-3ms`,
so the API is succeeding; Liquidsoap is the one re-issuing.

This did NOT directly cause the 2026-07-01 VM freeze (the api had shut down cleanly at
01:35, ~20h before the lockup — the freeze was remote_pi's Gradle build exhausting RAM
on a tmpfs `/tmp`). But it is a real, separate bug: runaway log volume, pointless DB +
HTTP load, and a process that grows memory while alive.

## Root-cause hypothesis

The generated `playout.liq` renders each channel's pool tier as `request.dynamic`:

- Renderer: `apps/api/src/services/liquidsoap-render.ts` (the `case "queue"` block ~line 46)
- Generated output: `liquidsoap/playout.liq` lines 146-150 (channel 895e30b6…), 59-63 (02e8fa83…)

  ```
  ch_…_pool = request.dynamic(fun() -> begin
    uri = http.get("…/api/playout/channels/{id}/pool/next?secret=…")
    if uri == "" then null() else request.create(uri) end
  end)
  ch_…_queue_program = fallback(track_sensitive=true, [ch_…_queue, ch_…_pool])
  ```

`request.dynamic` is re-invoked whenever the source needs a new ready request. A ~9/s
steady re-poll where every response is `200 + a URI` means Liquidsoap **discards each
returned request immediately and asks again** — the returned URI is not actually
resolvable/playable. Likely causes (to confirm at scope/design time):

- The S3 URI returned can't be resolved by Liquidsoap (wrong endpoint/scheme, s3:// vs
  https://, Garage presign mismatch, or the object doesn't exist at that key).
- The media decodes to failure / near-zero duration, so the source goes "not ready"
  instantly and `request.dynamic` polls again.
- `request.create(uri)` succeeds but the underlying `request.resolve`/decoder fails.

A 200 with an unplayable URI is the worst case: the empty-string guard (`if uri == ""`)
never trips, so the not-ready → repoll loop never throttles.

## Evidence pointers

- `~/.pm2/logs/api-out.log` (795 MB; ~540 GET pool/next per min in the last hour)
- `liquidsoap/playout.liq:146-150` (channel 895e30b6… pool block)
- `apps/api/src/services/liquidsoap-render.ts` `renderTierSource` `case "queue"`
- `apps/api/src/routes/playout-channels.routes.ts:464` (the `pool/next` route)
- `apps/api/src/services/editorial-control.ts:226` (`resolvePoolNextUri` backing logic)
- `docs/streaming.md:152` (pool selection + URI preference: 1080p→720p→480p→source)

## Direction (for scope/design, not binding here)

1. Confirm whether Liquidsoap can actually resolve+decode the returned URI (run the
   pool block in the dev container against a real channel_content row; watch logs for
   resolve/decode errors).
2. If the URI is the problem, fix the URI resolution in `editorial-control.ts`
   `resolvePoolNextUri` (scheme/endpoint/presign) — or pre-validate the object exists.
3. Consider a guard so `request.dynamic` can't hot-loop regardless: have `pool/next`
   return empty (`""`) when the resolved URI is known-unresolvable, OR throttle the
   dynamic in `.liq` (e.g. delay/`sleep` on failure) rather than polling unbounded.
4. Reduce log noise: the pino INFO "Request completed" on every callback is what made
   the log balloon — that level should be debug for the playout callback path, or
   sampled.
