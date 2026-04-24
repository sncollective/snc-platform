---
id: story-streaming-callback-rate-limit
kind: story
stage: done
tags: [streaming, media-pipeline]
release_binding: 0.3.0
created: 2026-04-18
updated: 2026-04-18
related_decisions: []
related_designs: []
parent: null
---

# Streaming callback rate limiter trips Liquidsoap retry loop

## Observed symptom

On the admin playout channel view, the queue and now-playing panel flickered — items appeared to be added, then silently disappeared a few seconds later, then sometimes reappeared. Queue positions came out non-contiguous (e.g. `2, 4, 5, 6`). Content never actually reached the RTMP output; nothing played on the stream.

## Root cause (investigation outcome, 2026-04-18)

**The rate limiter was a symptom, not the cause.** Investigation via clean restart + log correlation surfaced that the real root cause was **missing `?secret=...` on SRS callback URLs in dev `platform/srs.conf`**. Every `on_publish` callback from SRS was hitting `verifySrsCallback` with no query param and getting a 403 (`srs_callback_rejected` events in API logs), causing SRS to reject the publish, causing Liquidsoap's `output.url` to fail with `Avutil.Error(Input/output error)` and retry every 2 seconds. With 3 playout channels × 2 s retry = ~90 attempts/min, the unrelated 30/min `srsCallbackLimiter` on `/api/streaming/callbacks/*` tripped within ~20 seconds. After that, even if the secret was fixed, incoming callbacks got 429 until the 60 s window cleared — which masked the underlying 403 in the logs and made the rate limiter look like the primary cause.

The config divergence was local to dev: `platform/deploy/srs.conf.prod.example:56-62` already had `?secret=SRS_CALLBACK_SECRET` placeholders for deploy-time templating. Only the dev `platform/srs.conf` was missing them.

## Fix applied

`platform/srs.conf` updated so all three callback URLs (`on_publish`, `on_unpublish`, `forward.backend`) include `?secret=dev-srs-callback-secret-not-for-production-32` — the default dev secret from `platform/.env.example:61`. A comment explains why the value is hardcoded here (SRS 6 doesn't substitute env vars in config) and flags the need to keep it synced with `.env` on any rotation.

Restart verified: after `docker restart snc-srs && docker restart snc-liquidsoap`, Liquidsoap's first callbacks still hit the already-saturated rate limit (carry-over from the prior retry storm), but as soon as the 60 s window cleared, `stream_key_accepted` events appeared for all three playout channels and SRS's stream API reported steady RTMP publish with frames flowing. No more 429s, no more Liquidsoap I/O errors.

## What was NOT fixed

The rate limiter itself wasn't touched. Per the original story's candidate list, this matches option 4 ("address initial failure directly — if investigation identifies the root cause, fix it; the rate limiter then stops being a factor"). In normal operation the limiter now sees ~0 callbacks/min for playout channels (publishes happen once per startup, then stay connected), well under 30/min.

A future rupture in the secret auth layer (or a burst of legit publishes above 30/min) could still trigger the same 429 masking effect. Addressing that (move limiter after auth, or exempt authenticated callbacks) is worth considering but not required to fix this bug — parking the follow-up consideration at the end of this story rather than scoping a separate item.

## Follow-up consideration

If a similar mask-by-429 scenario surfaces again in future, the right architectural move is likely **move the rate limiter after `verifySrsCallback` in the middleware chain** — fast 403 on unauth traffic (no counting), rate limit only applied to authenticated requests (legit SRS traffic). Requires refactoring app.ts + streaming.routes.ts middleware ordering; defer until there's evidence the current structure causes real problems.

## Discovery context

Surfaced 2026-04-18 during `/review` on `playout-channel-architecture/phase1`. Phase 1's orchestration was behaving as designed — the thrash was downstream. Phase 1 passed review skip-with-note pending this fix. After this fix lands, Phase 1's end-to-end behavior should be observable in the admin UI.

## Tasks

- [x] Investigate the initial RTMP publish failure — clean restart + log correlation identified `srs_callback_rejected` as the real error, masked by 429s
- [x] Pick a fix — option 4 (address initial failure directly): add `?secret=` to dev srs.conf
- [x] Apply fix: `platform/srs.conf` updated with secret on all three callback URLs
- [x] Verify fix: `stream_key_accepted` events appear, SRS streams API shows active publish with frames, no 429s, no Liquidsoap I/O errors
- [x] Verify end-to-end via admin UI (2026-04-18): content plays on the live page, S/NC TV shows "On Air" with 1 viewer, queue advances and auto-fills correctly (positions 80+ match 7 track-events × auto-fill batch of 10). Remaining admin-UI-side issues (panel flicker, stuck now-playing timer, content pool count/list mismatch) are frontend-only polish items, unrelated to this fix — parked separately as `playout-admin-ui-queue-flicker` and `playout-admin-content-pool-display-mismatch`.
