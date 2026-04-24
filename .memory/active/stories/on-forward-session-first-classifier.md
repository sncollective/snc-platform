---
id: story-on-forward-session-first-classifier
kind: story
stage: review
tags: [streaming]
release_binding: 0.3.1
created: 2026-04-24
updated: 2026-04-24
related_decisions: []
related_designs: []
parent: null
---

# Classify on_forward by session, not stream name

Prod triage 2026-04-24 (0.3.0 live). Creator configured Twitch + YouTube simulcast destinations via the streaming-account-connect OAuth flow, activated them, stopped and restarted the stream, and neither external platform showed live. SRS logs showed `response={"code":0,"data":{"urls":[]}}` — the API returned no forward URLs at all.

Root cause: `on_forward` at `apps/api/src/routes/streaming.routes.ts` classified the stream by matching `body.stream` against the `channels` table (`isPlayoutStream`). On every creator go-live, `on_publish` calls `ensureLiveChannelWithChat(creatorId, sessionId, body.stream)` which writes a `channels` row with `srs_stream_name = <creator's publish name>, is_active = true`. The subsequent `on_forward` callback then sees its own row, classifies the publish as "playout," and takes the early-return branch that omits both the Liquidsoap URL and the creator's simulcast destinations. Affected every creator publish since 0.3.0 — simulcast for creators has never worked in prod; it wasn't exercised until today.

Fix: invert the branch order. Look up the `streamSessions` row by `srsClientId` first. If a session is found, the publish is a creator publish — return Liquidsoap URL + creator simulcast destinations. If not, fall through to `isPlayoutStream` for Liquidsoap-originated playout publishes (no session row written for those). Adds a structured log line per branch (`on_forward_creator`, `on_forward_playout`, `on_forward_unknown`) so the next incident on this path reads in one log scan.

Also restores the creator → Liquidsoap → S/NC TV playout mix path, which was silently broken by the same bug. Creator video was reaching SRS (and HLS-served natively), but not reaching Liquidsoap — so S/NC TV playout was never getting the takeover feed either.

## Scope

- [x] Invert `on_forward` branch order — session-first at `creator-events.routes.ts:streaming.routes.ts:388-435`.
- [x] Add structured log events (`on_forward_creator`, `on_forward_playout`, `on_forward_unknown`) with `urlCount` + `creatorId` (no stream keys logged).
- [x] Update existing playout tests to sequence `.where()` mocks (session lookup first, channel lookup second).
- [x] Add regression test: creator publish with stream name that collides with an auto-created `channels` row must still take the creator branch.
- [x] Add regression test for the unknown-publish branch (no session, not a known playout stream).
- [x] Full API unit suite — 1497/1497 green.
- [ ] User acceptance: live-test a creator publish in prod with Twitch + YouTube destinations active. Both should show live. SRS logs should show non-empty `urls` in the on_forward response.

## Risks

- Liquidsoap's publish path must not open a `streamSessions` row, or the classifier would misroute it into the creator branch (Liquidsoap would get its own stream forwarded back = loop). Verified: Liquidsoap publishes use the platform playout key path which is distinct from creator stream-key validation — no session row is created. `playout.ts:168-170` explicitly notes `srsStreamName` is no longer used for routing.
- Any creator go-live that was "working" before this fix only because the `channels` row hadn't been created yet on first publish — not real, `ensureLiveChannelWithChat` runs inside `on_publish` and completes before SRS fires `on_forward`.

## Revisit if

- `channels` schema gains other row kinds that should be treated as playout but aren't Liquidsoap-published (e.g., a third-party ingest that opens a session).
- `streamSessions` ever records non-creator publishes. Adding a `kind` discriminator to the session row would be the clean follow-up.
- Simulcast volume grows to the point where the live per-publish DB lookup becomes a hot path — cache or denormalize.

## Related

- Auto-creation of the colliding row: `services/channels.ts :: ensureLiveChannelWithChat` (called from `routes/streaming.routes.ts` `on_publish`).
- The schema ambiguity between playout channels and live-takeover channels in the `channels` table is the deeper design gap — this fix works around it at the classifier layer. A follow-up could add a `kind` column (`playout` vs `live-takeover`) and tighten `isPlayoutStream` to match `kind=playout` only. Not required for 0.3.1; captured for future.
