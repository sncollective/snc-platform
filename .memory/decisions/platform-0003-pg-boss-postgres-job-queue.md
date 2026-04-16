---
id: platform-0003
title: pg-boss as the PostgreSQL-native job queue
status: active
created: 2026-03
updated: 2026-04-16
supersedes: []
superseded_by: null
revisit_if:
  - "S/NC outgrows pg-boss — hundreds of concurrent jobs, complex multi-stage DAGs, or sub-second scheduling latency under load. At that scale BullMQ + Valkey (Linux Foundation OSS Redis fork) is the natural next step."
  - "pg-boss development stalls or its solo maintainer (Tim Jones) becomes unavailable without succession. 10-year track record is strong, but bus factor is 1 — forking to a maintained community version becomes the fallback."
  - "S/NC adopts Redis/Valkey for other platform reasons (session store, real-time cache). The 'zero new infrastructure' argument for pg-boss weakens, making BullMQ's richer feature set more attractive."
  - "Need for first-class job flows / DAGs or real-time progress events becomes load-bearing for a platform feature. pg-boss requires manual job chaining and external progress tracking; if that becomes fragile at scale, BullMQ's native flows + progress events earn their place."
---

## Context

The S/NC media processing pipeline needs a background job queue for FFmpeg transcoding (5–60+ minute jobs), codec probing, thumbnail extraction, and VOD recording post-processing (FLV → MP4 faststart remux from SRS DVR output — see [platform-0001-srs-unified-streaming-server.md](platform-0001-srs-unified-streaming-server.md)). Stack is Hono v4, PostgreSQL 16, Node.js 24, TypeScript strict mode. Redis is explicitly not deployed.

The queue is load-bearing for Phase 3+ — without a durable job queue, the streaming VOD pipeline can't land recordings reliably, and any FFmpeg work that takes longer than a request timeout has nowhere to run.

## Alternatives considered

### pg-boss (selected)

See Decision below.

### BullMQ

**Why considered.** Industry standard for Node.js job queues. Written in TypeScript with first-class types. Native parent-child job flows (DAGs) — a clean fit for `probe-codec → transcode → generate-thumbnail → update-content` chains. Real-time progress events (0–100%) perfect for FFmpeg progress tracking. Lock renewal + stall detection for long-running jobs. Bull Board OSS admin UI is excellent. Largest community, most Stack Overflow answers, most integrations.

**Why rejected.** Requires Redis/Valkey — new infrastructure to deploy, configure, monitor, and maintain. Pro features ($95/mo) include rate limiting, groups, and observability — useful but not essential. Taskforce.sh (the maintainer company) is small and has unclear long-term sustainability at cooperative scale. Redis itself has license concerns (Redis Ltd switched to dual-license in 2024; Valkey is the Linux Foundation fork — viable but adds deployment decision).

**Would change our mind if.** S/NC adopts Redis/Valkey for other reasons (session store, real-time cache), making the "new infrastructure" argument moot. Or if job complexity reaches the point where native DAGs + progress events earn their place over pg-boss's manual chaining pattern.

### Graphile Worker

**Why considered.** PostgreSQL-native like pg-boss. Uses LISTEN/NOTIFY for lower-latency job pickup. Written in TypeScript. From Benjie Gillam (PostGraphile ecosystem). Can define tasks as SQL functions (interesting for DB-heavy workflows).

**Why rejected.** Still 0.x versioning (v0.16, 0.17 RC) — API not yet stable. Smaller community (~2.1k stars, ~43k weekly downloads) than pg-boss (3.15k stars, 256k weekly). Solo maintainer, sponsor-funded. No dashboard in OSS (Pro tier adds worker tracking). No DAGs, no built-in progress tracking. Less documentation than pg-boss or BullMQ. The LISTEN/NOTIFY latency advantage is negligible for media transcoding (job pickup latency doesn't matter when jobs take 30 minutes).

**Would change our mind if.** Graphile Worker reaches v1.x with stable API and the community grows substantially. Or if we take on workflows where LISTEN/NOTIFY's sub-second pickup latency earns its place (interactive/conversational rather than batch media).

### Temporal

**Why considered.** Workflow orchestration engine. Durable execution — workflows survive process restarts, server crashes, and deployments. Most robust option by far, designed specifically for long-running workflows. Workflow-as-code model with TypeScript SDK. Built-in: retries, timeouts, heartbeats, signals, queries, cron. Excellent admin UI (Temporal Web). Activity heartbeats perfect for FFmpeg progress.

**Why rejected.** Massively over-engineered for dozens of jobs/day. Requires Temporal Server (Go binary) + PostgreSQL/MySQL/Cassandra + optional Elasticsearch — significant operational overhead. VC-backed (Temporal Technologies, $200M+ raised) — enshittification risk as investor expectations grow. Steep learning curve (workflow determinism constraints, activity vs workflow distinction). Would be the right choice at YouTube/Vimeo scale; at S/NC's scale, operational overhead dramatically outweighs the benefits.

**Would change our mind if.** S/NC reaches a scale where durable execution across multi-day workflows with complex branching becomes the dominant concern. Not foreseeable.

### Custom SKIP LOCKED

**Why considered.** No dependencies, full control. `SELECT ... FOR UPDATE SKIP LOCKED` gives worker-safe dequeuing on PostgreSQL with no library needed.

**Why rejected.** Reinventing solved problems: retries, backoff, dead letter queues, concurrency limiting, cron scheduling, monitoring. Estimated 500–1000 lines of infrastructure code before the first job handler. Every edge case (worker crash mid-job, stuck jobs, priority inversion) becomes our problem. No community, no ecosystem, no dashboard.

**Would change our mind if.** Never, for a system at this scale. pg-boss is a superset of what we'd build.

## Decision

**pg-boss (MIT, ~3.15k GitHub stars, ~256k weekly npm downloads, v12.x, 10-year development history)** is the background job queue for the S/NC platform. It uses existing PostgreSQL 16 as the backing store via `SELECT ... FOR UPDATE SKIP LOCKED` polling; jobs are rows in a PostgreSQL table.

Primary reasons:

1. **Zero new infrastructure** — uses existing PostgreSQL. No Redis, no Temporal Server, no new service to deploy, monitor, or maintain. The single biggest operational win at S/NC's scale.
2. **Mature and stable** — v12.x, 10 years of development, 256k weekly downloads. API has been stable for years.
3. **MIT with no paywalled features** — everything is OSS. No Pro tier creating a dependency path toward commercial features.
4. **Sufficient for scale** — built-in retries with backoff, dead letter queues, cron scheduling, priority queues, concurrency limiting. Covers the media pipeline's needs.
5. **Values-aligned** — no corporate lock-in, no upsell, no VC runway risk. Simple enough to fork if the solo maintainer becomes unavailable (10-year track record suggests stability regardless).

## Consequences

**Enabled:**
- Media processing pipeline: `probe-codec → transcode → generate-thumbnail → update-content` chains, FFmpeg work as durable jobs with retries
- VOD pipeline: SRS DVR FLV output → pg-boss queued remux job → MP4 faststart → Garage S3 (integrates with [platform-0001-srs-unified-streaming-server.md](platform-0001-srs-unified-streaming-server.md) and [platform-0002-garage-s3-object-storage.md](platform-0002-garage-s3-object-storage.md))
- Cron-scheduled maintenance jobs (carbon tracking aggregation, cleanup tasks, etc.)
- Dead letter queue for diagnosing failed transcodes without losing the job

**Implementation patterns established:**
- **Long-running jobs** — set `expireInHours: 2` for transcodes (static rather than dynamic heartbeats). Jobs that exceed this get marked failed and retried per the queue's retry policy. Acceptable tradeoff given pg-boss lacks heartbeats; transcode timing is predictable enough.
- **Job chaining** — manual rather than DAGs. Worker completes its task, then calls `boss.send('next-queue', data)` to enqueue the next step. Straightforward for linear pipelines (probe → transcode → thumbnail → update).
- **Progress tracking** — write FFmpeg stderr progress output to a `processing_status` column on the content table (rather than using a native progress mechanism pg-boss lacks). Frontend polls that column.
- **Admin UI** — `@pg-boss/dashboard` (separate package) provides basic queue visibility. Enough for diagnosing issues; not as rich as Bull Board.

**Accepted trade-offs:**
- **No native job flows/DAGs.** Manual chaining via worker-completes-then-enqueue-next. Works for linear pipelines; would get fragile if we needed complex branching. Not a problem today.
- **No real-time progress events.** Polling the `processing_status` column is slightly less elegant than event-driven progress, but works reliably.
- **Solo maintainer (Tim Jones), bus factor of 1.** 10-year track record + simple codebase mitigates the risk; forking to a community version would be tractable if needed.
- **Static `expireInHours` rather than dynamic heartbeats for long-running jobs.** If a transcode runs longer than expected, it gets retried. Acceptable given FFmpeg transcode times are reasonably predictable; not acceptable for truly open-ended tasks.

## Related

- [../../research/job-queue-libraries.md](../../research/job-queue-libraries.md) — full evaluation of pg-boss vs BullMQ vs Graphile Worker vs Temporal vs Custom SKIP LOCKED
- [platform-0001-srs-unified-streaming-server.md](platform-0001-srs-unified-streaming-server.md) — SRS as streaming server; pg-boss is the queue for SRS DVR post-processing
- [platform-0002-garage-s3-object-storage.md](platform-0002-garage-s3-object-storage.md) — Garage as object storage; pg-boss coordinates VOD writes into Garage
- Pipeline foundation brief — in the parent monorepo under `boards/platform/release-0.2/design/pipeline-foundation.brief.md` (prose reference to preserve standalone cloning)

No prior decision record to supersede — this is a fresh promotion from research to a structured decision record as Item 3c of the Level 3 critical path (2026-04-16). No position change from the March 2026 research conclusions — pg-boss has been load-bearing for platform work since.
