---
status: settled
authored: 2026-06-10
provenance: agent-synthesis
related:
  - to: ../briefs/job-queue-libraries.md
    type: grounds
    note: full evaluation — pg-boss vs BullMQ vs Graphile Worker vs Temporal vs Custom SKIP LOCKED
  - to: srs-streaming-server.md
    type: cites
    note: SRS as streaming server; pg-boss is the queue for SRS DVR post-processing
  - to: garage-object-storage.md
    type: cites
    note: Garage as object storage; pg-boss coordinates VOD writes into Garage
revisit_if:
  - S/NC outgrows pg-boss — hundreds of concurrent jobs, complex multi-stage DAGs, or sub-second scheduling latency under load. At that scale BullMQ + Valkey (Linux Foundation OSS Redis fork) is the natural next step.
  - pg-boss development stalls or its solo maintainer (Tim Jones) becomes unavailable without succession. 10-year track record is strong, but bus factor is 1 — forking to a maintained community version becomes the fallback.
  - S/NC adopts Redis/Valkey for other platform reasons (session store, real-time cache). The zero-new-infrastructure argument for pg-boss weakens, making BullMQ's richer feature set more attractive.
  - Need for first-class job flows / DAGs or real-time progress events becomes load-bearing for a platform feature. pg-boss requires manual job chaining and external progress tracking; if that becomes fragile at scale, BullMQ's native flows + progress events earn their place.
---

# Position: pg-boss as the PostgreSQL-native job queue

**Status: settled.** pg-boss is the background job queue for the S/NC platform, selected after
a full evaluation of the available Node.js job queue options.

## The stance

**pg-boss (MIT, ~3.15k GitHub stars, ~256k weekly npm downloads, v12.x, 10-year development
history) is the platform's job queue.** It uses existing PostgreSQL 16 as the backing store via
`SELECT ... FOR UPDATE SKIP LOCKED` polling; jobs are rows in a PostgreSQL table.

### Primary reasons

1. **Zero new infrastructure**: uses existing PostgreSQL. No Redis, no Temporal Server, no new
   service to deploy, monitor, or maintain. The single biggest operational win at S/NC's scale.
2. **Mature and stable**: v12.x, 10 years of development, 256k weekly downloads. API has been
   stable for years.
3. **MIT with no paywalled features**: everything is OSS. No Pro tier creating a dependency path
   toward commercial features.
4. **Sufficient for scale**: built-in retries with backoff, dead letter queues, cron scheduling,
   priority queues, concurrency limiting. Covers the media pipeline's needs.
5. **Values-aligned**: no corporate lock-in, no upsell, no VC runway risk. Simple enough to fork
   if the solo maintainer becomes unavailable (10-year track record suggests stability).

## Rejected alternatives

### BullMQ

TypeScript-first, native parent-child job flows (DAGs), real-time progress events, lock renewal
+ stall detection for long-running jobs, excellent Bull Board admin UI, largest community.

**Why rejected:** Requires Redis/Valkey — new infrastructure to deploy, configure, monitor, and
maintain. Pro features ($95/mo) include rate limiting, groups, and observability — useful but
not essential. Taskforce.sh (the maintainer company) is small with unclear long-term
sustainability at cooperative scale. Redis itself has license concerns (Redis Ltd switched to
dual-license in 2024; Valkey is the Linux Foundation fork — viable but adds a deployment
decision).

Would reconsider if S/NC adopts Redis/Valkey for other reasons (session store, real-time cache),
making the "new infrastructure" argument moot; or if job complexity reaches the point where
native DAGs + progress events earn their place over pg-boss's manual chaining pattern.

### Graphile Worker

PostgreSQL-native like pg-boss, uses LISTEN/NOTIFY for lower-latency job pickup, written in
TypeScript, from Benjie Gillam (PostGraphile ecosystem).

**Why rejected:** Still 0.x versioning (v0.16, 0.17 RC) — API not yet stable. Smaller community
(~2.1k stars, ~43k weekly downloads) than pg-boss (3.15k stars, 256k weekly). Solo maintainer,
sponsor-funded. No dashboard in OSS (Pro tier adds worker tracking). No DAGs, no built-in
progress tracking. Less documentation. The LISTEN/NOTIFY latency advantage is negligible for
media transcoding (job pickup latency doesn't matter when jobs take 30 minutes).

Would reconsider when Graphile Worker reaches v1.x with stable API and the community grows
substantially, or if sub-second pickup latency becomes load-bearing for interactive/conversational
workflows (not batch media).

### Temporal

Workflow orchestration engine with durable execution, TypeScript SDK, built-in retries,
timeouts, heartbeats, signals, queries, cron. Excellent Temporal Web admin UI.

**Why rejected:** Massively over-engineered for dozens of jobs/day. Requires Temporal Server
(Go binary) + PostgreSQL/MySQL/Cassandra + optional Elasticsearch — significant operational
overhead. VC-backed ($200M+ raised) — enshittification risk as investor expectations grow. Steep
learning curve (workflow determinism constraints). Would be the right choice at YouTube/Vimeo
scale; at S/NC's scale, operational overhead dramatically outweighs the benefits.

Would reconsider only if S/NC reaches a scale where durable execution across multi-day workflows
with complex branching becomes the dominant concern — not foreseeable.

### Custom SKIP LOCKED

No dependencies, full control. `SELECT ... FOR UPDATE SKIP LOCKED` gives worker-safe dequeuing
on PostgreSQL with no library needed.

**Why rejected:** Reinventing solved problems: retries, backoff, dead letter queues, concurrency
limiting, cron scheduling, monitoring. Estimated 500–1000 lines of infrastructure code before the
first job handler. Every edge case (worker crash mid-job, stuck jobs, priority inversion) becomes
a platform problem. pg-boss is a superset of what we'd build.

Would not reconsider at this scale — pg-boss is a superset of what we'd build.

## Implementation patterns established

- **Long-running jobs**: set `expireInHours: 2` for transcodes (static rather than dynamic
  heartbeats). Acceptable tradeoff given pg-boss lacks heartbeats; transcode timing is
  predictable enough.
- **Job chaining**: manual via worker-completes-then-enqueue-next (`boss.send('next-queue', data)`).
  Works for linear pipelines (probe → transcode → thumbnail → update).
- **Progress tracking**: write FFmpeg stderr progress output to a `processing_status` column on
  the content table. Frontend polls that column.
- **Admin UI**: `@pg-boss/dashboard` (separate package) provides basic queue visibility.

## Accepted trade-offs

- No native job flows/DAGs: manual chaining via worker-completes-then-enqueue-next. Works for
  linear pipelines; would get fragile with complex branching.
- No real-time progress events: polling the `processing_status` column is slightly less elegant
  than event-driven progress, but works reliably.
- Solo maintainer (Tim Jones), bus factor of 1: 10-year track record + simple codebase mitigates;
  forking to a community version would be tractable if needed.
- Static `expireInHours` rather than dynamic heartbeats for long-running jobs.

## Platform constraints it sets

- `pg-boss-v12` tech-reference skill carries the pg-boss API and job patterns.
- Media pipeline: `probe-codec → transcode → generate-thumbnail → update-content` chains.
- VOD pipeline: SRS DVR FLV output → pg-boss queued remux job → MP4 faststart → Garage S3.
