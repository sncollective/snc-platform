---
id: srs-stream-name-unique-index-collision
kind: backlog
tags: [streaming, playout]
created: 2026-06-14
---

# activateLiveChannel can silently fail on the channels_srs_stream_name unique index

Surfaced by the deep review of `unified-channel-model-identity-lifecycle` (2026-06-14).

## Concern
The persistent-creator-channel rewrite changed channel lookup from by-`srsStreamName` to
by-`creatorId`, decoupling the write key from the table's uniqueness key. On publish,
`activateLiveChannel` (`apps/api/src/services/channels.ts` ~:286) does
`UPDATE channels SET srsStreamName = opts.srsStreamName ...` where `opts.srsStreamName =
body.stream` (the on_publish path: `streaming.routes.ts` → `stream-lifecycle.ts`). Per
`docs/streaming.md:47` a creator points OBS at `rtmp://…/live/<stream-name>?key=<stream-key>`
— if `<stream-name>` is encoder-chosen (free-form) rather than deterministic-per-creator, two
creator channels (or a stale still-active row holding that name) can collide on
`uniqueIndex("channels_srs_stream_name_idx")` (`streaming.schema.ts:146`). The activate call is
best-effort and swallowed (`ensureLiveChannelWithChat` catches + logs), so the failure is
**silent**: SRS ingests the stream but the creator's channel never activates and never appears
in `/status`.

The retired `createLiveChannel` looked up *by* `srsStreamName`, so it was structurally aligned
with the unique index; the new by-`creatorId` path is not.

## To confirm / fix (scope-time)
1. **Confirm first**: is `body.stream` deterministic per creator in the real deployment (derived
   from the key / enforced server-side), or free-form OBS input? If deterministic, this is
   theoretical and can close after a confirming note. If free-form, it's a live-path defect.
2. If a defect: either derive/enforce a deterministic per-creator stream name, or reconcile the
   unique index with the activate-by-creatorId write (e.g. clear/transfer the name from any stale
   row first, or relax/repurpose the uniqueness key).
3. Related hardening (also from the deep review, lower priority): `ensureCreatorChannel`'s
   select-then-insert dedup is not concurrency-safe — a partial unique index on
   `(creator_id) WHERE ownership='creator' AND role='live-ingest'` would make idempotency
   structural instead of self-healing; and `deactivateLiveChannel` leaves a stale
   `streamSessionId` on the row (clear it on deactivate).

## Carry to unified-channel-model prod-verification
This is on the production streaming path. Confirm/resolve before the `unified-channel-model`
epic ships (the epic binds whole at release; flag for its `## Prod verification`).
