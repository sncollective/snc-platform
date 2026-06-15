---
id: channel-lifecycle-creator-profile-seed
created: 2026-06-15
tags: [bug, testing, streaming]
---

# channel-lifecycle integration tests fail on missing creator_profiles seed

Surfaced 2026-06-15 once the API integration suite could finally run from the
agent sandbox (15/18 pass — these 3 are the only failures). Deterministic and
schema-driven: it would fail identically in a base-namespace shell run, so this
is NOT a sandbox artifact.

**Symptom.** All 3 tests in `apps/api/tests/integration/streaming/channel-lifecycle.test.ts`
("creator channel lifecycle (persistent row model)") fail. Each test generates a
random `creatorId` (`test-creator-${randomUUID()}`) and calls `ensureCreatorChannel`
— and one test directly inserts into `channels` — **without first seeding a
`creator_profiles` row**. But `channels.creator_id` carries FK
`channels_creator_id_creator_profiles_id_fk`, so the insert is rejected:

```
PostgresError 23503: Key (creator_id)=(test-creator-…) is not present in table "creator_profiles"
```

`ensureCreatorChannel` then returns a not-ok `Result`, so `expect(provisionResult.ok).toBe(true)`
fails at line 39 (and the idempotency/dedupe variants at 132 / 175).

**Decision needed (fixture-vs-bug):**
- (a) **Missing fixture** — seed a `creator_profiles` row in the test setup before
  provisioning a channel; or
- (b) **Real contract question** — should `ensureCreatorChannel` upsert/create the
  creator profile rather than assume it already exists?

Resolve before relying on these 3 tests as a gate.
