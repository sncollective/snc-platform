---
id: idea-poolcontentscope-null-creator-fallthrough
created: 2026-06-25
updated: 2026-06-25
tags: [security, streaming]
---

`poolContentScope` (`apps/api/src/services/editorial-config.ts:58-66`) resolves a channel with
`ownership === "creator"` but `creatorId === null` to `{ allCreators: true }` — i.e. that channel's
pool would draw from / serve **all** creators' content. A latent cross-tenant escalation.

**How a null-creatorId creator channel can arise:** `channels.creatorId` is nullable with
`ON DELETE SET NULL`. Deleting a creator profile sets its channel's `creatorId` to null while
`ownership` stays `"creator"` — a malformed-but-possible row.

**Why it is NOT exploitable via the creator route surface today:** the gate middleware
`require-creator-channel-permission.ts` explicitly rejects `!channel.creatorId` with a 404, so a
creator-route request never reaches `poolContentScope` with a null creatorId. The exposure is via
the **admin/internal** paths that resolve scope directly — `autoFill` (timer-driven) and
`resolvePoolNextUri` (Liquidsoap pool-next playback) — on such a malformed row.

**Found by:** Codex cross-model review pass 3 of the `creator-content-playable` arc (2026-06-25).
Flagged as **pre-existing** (`poolContentScope` predates the B1 queue-widening work) and explicitly
**not** a reopening of the B3 direct-pollution case for valid creator channels — so parked rather
than blocking that loop's convergence.

**Possible fix direction (for scope time, not committed):** make `poolContentScope` fail closed on
the malformed shape — a `creator`-ownership channel with `creatorId === null` should resolve to an
empty/deny scope (or raise), never `{ allCreators: true }`. Consider whether the `ON DELETE SET NULL`
on `channels.creatorId` is the right cascade for a creator channel at all (a creator channel without
a creator is arguably an invalid row that should cascade-delete or be cleaned up).
