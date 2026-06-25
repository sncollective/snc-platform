---
id: channel-lifecycle-creator-profile-seed
created: 2026-06-15
updated: 2026-06-25
tags: [bug, testing, streaming]
---

# channel-lifecycle integration tests fail on missing creator_profiles seed (FK violation)

Surfaced 2026-06-15 once the API integration suite could finally run from the agent sandbox
(15/18 pass — these 3 are the only failures). Deterministic and schema-driven: it fails
identically in a base-namespace shell run, so this is NOT a sandbox artifact. Re-confirmed
pre-existing on 2026-06-22, 2026-06-25 (reproduces on clean HEAD when all creator-editorial work
is stashed). Recorded so the failures aren't misattributed to adjacent creator-enablement work.

**Symptom.** All 3 tests in `apps/api/tests/integration/streaming/channel-lifecycle.test.ts` fail —
the persistent-row publish/unpublish cycle, the `ensureCreatorChannel` idempotency, and the
duplicate-row dedupe. Each generates `creatorId = test-creator-${randomUUID()}` and inserts /
`ensureCreatorChannel`s a `channels` row referencing it (one test inserts into `channels`
directly), but never seeds the corresponding `creator_profiles` row first. The
`channels.creator_id` FK rejects the insert:

```
PostgresError 23503: insert or update on table "channels" violates foreign key constraint
"channels_creator_id_creator_profiles_id_fk"
Key (creator_id)=(test-creator-<uuid>) is not present in table "creator_profiles".
```

`ensureCreatorChannel` then returns a not-ok `Result`, so `expect(provisionResult.ok).toBe(true)`
fails at line 39 (and the idempotency/dedupe variants at ~132 / ~175).

**Real-DB-only.** The `channels.creator_id` FK isn't exercised by the unit suite's mocks, which is
why these never show in `test:unit` — only the real-Postgres integration run hits the constraint.

**Decision needed (fixture-vs-bug):**
- (a) **Missing fixture** — seed a `creator_profiles` row for the test's `creatorId` in setup before
  inserting the channel / calling `ensureCreatorChannel`. Mirror how the passing creator-playout
  integration test (`tests/integration/creator-playout/cross-tenant-isolation.test.ts`) seeds its
  creator profiles first. Small, self-contained test-setup fix.
- (b) **Real contract question** — should `ensureCreatorChannel` upsert/create the creator profile
  rather than assume it already exists?

(a) is the likely answer (the test predates the FK — added by migration
`0028_cute_living_tribunal.sql` during the unified-channel-model-identity-lifecycle work — and never
satisfied the new constraint). Confirm (b) isn't the intended behavior before settling on (a).
Resolve before relying on these 3 tests as a gate.
