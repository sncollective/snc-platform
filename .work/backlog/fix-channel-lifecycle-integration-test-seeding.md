---
id: fix-channel-lifecycle-integration-test-seeding
tags: [streaming, testing]
release_binding: null
created: 2026-06-22
---

# Fix channel-lifecycle integration test — missing creator_profiles seed (FK violation)

Surfaced 2026-06-22 while running the integration suite to verify the new creator-editorial
cross-tenant isolation tests. **Pre-existing, unrelated to that work** — recorded here so the
failures aren't later misattributed.

## What's wrong

`apps/api/tests/integration/streaming/channel-lifecycle.test.ts` (3 tests: the persistent-row
publish/unpublish cycle, the `ensureCreatorChannel` idempotency, and the duplicate-row dedupe)
fail with a foreign-key violation:

```
insert or update on table "channels" violates foreign key constraint
"channels_creator_id_creator_profiles_id_fk"
Key (creator_id)=(test-creator-<uuid>) is not present in table "creator_profiles".
```

The tests generate `creatorId = test-creator-${randomUUID()}` and insert / `ensureCreatorChannel`
a `channels` row referencing it, but never seed the corresponding `creator_profiles` row first. The
`channels.creator_id` FK to `creator_profiles.id` then rejects the insert.

These are real-DB-only failures (the `channels.creator_id` FK isn't exercised by the unit suite's
mocks), which is why they don't show in `test:unit`. They reproduce against the pre-session baseline
(commit `1069772`) — the creator-enablement work (`d5cc601..`) only *added* `findCreatorChannelId`
to `channels.ts` and did not touch `ensureCreatorChannel` or this test.

## Fix

Seed a `creator_profiles` row (the test's `creatorId`) in the test's setup before inserting the
channel / calling `ensureCreatorChannel`. Mirror how the passing creator-playout integration test
(`tests/integration/creator-playout/cross-tenant-isolation.test.ts`) seeds its creator profiles
first. Small, self-contained test-setup fix.
