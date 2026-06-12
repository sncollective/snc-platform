---
id: bold-upload-purpose-registry-job-naming
kind: feature
stage: drafting
tags: [refactor, media]
release_binding: null
depends_on: [bold-upload-purpose-registry-unify]
gate_origin: null
created: 2026-06-12
updated: 2026-06-12
parent: bold-upload-purpose-registry
---

# Route follow-up job dispatch through the registry

## Brief
The post-upload job kickoff currently bridges two naming conventions by hand: purpose
keys like `"content-media"` and job queue names like `JOB_QUEUES.PROBE_CODEC`
(`"media/probe-codec"` in `apps/api/src/jobs/queue-names.ts`). Add the follow-up job (if
any) to each purpose's registry entry as a typed reference to the `JOB_QUEUES` constant,
and make upload completion dispatch from the entry — retiring the implicit convention
mapping. Queue names themselves do not change (pg-boss queue renames are operationally
noisy and out of scope).

Behavior-preserving: same jobs enqueued with same payloads for every purpose.
