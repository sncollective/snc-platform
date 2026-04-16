# Node.js Job Queue Libraries (March 2026)

**Status:** Complete — pg-boss selected
**Decision record:** [../.memory/decisions/platform-0003-pg-boss-postgres-job-queue.md](../.memory/decisions/platform-0003-pg-boss-postgres-job-queue.md)

> Revised 2026-04-16 — the backing decision was promoted from this research doc into the structured submodule decision record linked above, as Item 3c of the Level 3 critical path. Content of this research is unchanged; a Status + Decision record pointer was added. pg-boss has been load-bearing for platform work since March 2026.

Evaluated for the S/NC media processing pipeline: FFmpeg transcoding (5-60+ minutes), codec probing, thumbnail extraction, and VOD recording post-processing. Stack: Hono v4, PostgreSQL 16 (deployed), Node.js 24, TypeScript strict mode, no Redis.

## Comparison

| Criteria | pg-boss | BullMQ | Graphile Worker | Temporal | Custom SKIP LOCKED |
|---|---|---|---|---|---|
| **New infra** | None (uses PG) | Redis/Valkey | None (uses PG) | Temporal Server + optional ES | None (uses PG) |
| **License** | MIT | MIT (Pro: $95/mo) | MIT (Pro: $100/mo) | MIT | N/A |
| **GitHub stars** | ~3,150 | ~8,600 | ~2,100 | ~19,100 | N/A |
| **NPM weekly** | ~256k | ~1M+ | ~43k | varies | N/A |
| **TypeScript** | Good (ships types) | First-class (written in TS) | Good (written in TS) | First-class (TS SDK) | DIY |
| **Maintainer** | Tim Jones (solo, 10 years) | Taskforce.sh (small company) | Benjie Gillam (solo, sponsor-funded) | Temporal Technologies (VC-backed) | You |
| **Concurrency control** | Queue policies | Per-worker + global rate limiting | Worker pool size | Activity task queue config | DIY |
| **Long-running jobs** | expireInHours (static) | Lock + stall detection + heartbeats | Dedicated workers + timeouts | Excellent: heartbeats, durable execution | DIY |
| **Progress tracking** | No built-in | First-class (0-100% + events) | No built-in | Activity heartbeat details | DIY |
| **Job flows/DAGs** | No | Yes (parent-child flows) | No | Yes (workflow composition) | DIY |
| **Admin UI** | @pg-boss/dashboard | Bull Board (OSS) + Taskforce.sh (paid) | None (Pro has worker tracking) | Temporal Web UI (excellent) | None |
| **Cron/scheduling** | Built-in | Built-in | Built-in | Built-in | DIY |
| **Retries + DLQ** | Built-in | Built-in | Built-in | Built-in | DIY |
| **Maturity** | v12.x (stable) | v5.x (stable) | v0.16 (0.17 RC) | v1.x (stable) | N/A |
| **Setup complexity** | Low | Medium (need Redis) | Low | High | Low start, high finish |

## Detailed Assessments

### pg-boss

PostgreSQL-native job queue using SKIP LOCKED for efficient polling. Jobs are rows in a PostgreSQL table. Workers poll for available jobs, process them, and mark complete.

**Strengths:**
- Zero new infrastructure — uses existing PostgreSQL
- 10 years of development, stable API (v12.x)
- Built-in: retries with backoff, dead letter queues, cron scheduling, priority queues, concurrency limiting
- MIT with no paywalled features (everything is OSS)
- Simple API: `boss.send('queue', data)` / `boss.work('queue', handler)`

**Weaknesses:**
- No native job flows/DAGs — chain jobs manually (worker completes → sends next job)
- No built-in progress tracking — need to write FFmpeg progress to your own table
- Long-running job support via static `expireInHours` rather than dynamic heartbeats
- Solo maintainer (Tim Jones) — bus factor of 1, though 10-year track record suggests stability
- Dashboard is a separate package (@pg-boss/dashboard), basic compared to Bull Board

**For media pipeline:** Set `expireInHours: 2` for transcodes. Track progress by writing FFmpeg stderr output to a `processing_status` column on the content table. Chain jobs: `probe-codec` → `transcode` → `generate-thumbnail` → `update-content`.

### BullMQ

Redis-based job queue. Industry standard for Node.js. Most feature-rich option.

**Strengths:**
- Written in TypeScript, first-class types
- Parent-child job flows (DAGs) — perfect for probe → transcode → thumbnail chains
- Real-time progress events (0-100%)
- Lock renewal + stall detection for long-running jobs
- Bull Board (OSS admin UI) is excellent
- Largest community, most Stack Overflow answers, most integrations

**Weaknesses:**
- **Requires Redis/Valkey** — new infrastructure to deploy, configure, monitor, and maintain
- Pro features ($95/mo) include rate limiting, groups, and observability — useful but not essential
- Taskforce.sh is a small company — business sustainability unclear at cooperative scale
- Redis is memory-bound — needs sizing for job data

**For media pipeline:** Excellent fit technically. The blocker is deploying and maintaining Redis/Valkey.

### Graphile Worker

PostgreSQL-based, from Benjie Gillam (PostGraphile ecosystem). Uses LISTEN/NOTIFY for near-instant job pickup.

**Strengths:**
- PostgreSQL-native, uses LISTEN/NOTIFY (lower latency than polling)
- Written in TypeScript
- Cron support, retries, priority
- Can define tasks as SQL functions (interesting for DB-heavy workflows)

**Weaknesses:**
- Still 0.x versioning (v0.16, 0.17 RC) — API not yet stable
- Smaller community (~2,100 stars, ~43k weekly downloads)
- Solo maintainer (Benjie Gillam), sponsor-funded
- No dashboard in OSS (Pro tier adds worker tracking)
- No DAGs, no built-in progress tracking
- Less documentation and fewer examples than pg-boss or BullMQ

**For media pipeline:** Technically capable but less mature than pg-boss with a smaller community. The LISTEN/NOTIFY advantage is negligible for media transcoding (job pickup latency doesn't matter when the job takes 30 minutes).

### Temporal

Workflow orchestration engine. Durable execution — workflows survive process restarts, server crashes, and deployments.

**Strengths:**
- Most robust option by far — designed for exactly this kind of long-running workflow
- Workflow-as-code model (TypeScript SDK)
- Built-in: retries, timeouts, heartbeats, signals, queries, cron
- Excellent admin UI (Temporal Web)
- Activity heartbeats perfect for FFmpeg progress tracking
- Version-safe workflow updates

**Weaknesses:**
- **Massively over-engineered** for dozens of jobs/day
- Requires Temporal Server (Go binary) + PostgreSQL/MySQL/Cassandra + optional Elasticsearch
- Significant operational overhead — another service to deploy, monitor, upgrade
- VC-backed (Temporal Technologies, $200M+ raised) — enshittification risk
- Steep learning curve (workflow determinism constraints, activity vs workflow distinction)

**For media pipeline:** Would be the right choice at YouTube/Vimeo scale. At S/NC's scale (handful of uploads/day), the operational overhead dramatically outweighs the benefits.

### Custom SKIP LOCKED

DIY job queue using a PostgreSQL table + `SELECT ... FOR UPDATE SKIP LOCKED` for worker-safe dequeuing.

**Strengths:**
- No dependencies, full control
- You understand every line of code
- No bus-factor risk from external maintainers

**Weaknesses:**
- Reinventing solved problems: retries, backoff, dead letter queues, concurrency limiting, cron scheduling, monitoring
- Estimated 500-1000 lines of infrastructure code before you write a single job handler
- Every edge case (worker crash mid-job, stuck jobs, priority inversion) is your problem
- No community, no ecosystem, no dashboard

**For media pipeline:** Don't reinvent what pg-boss already solved.

## Governance Assessment

| Library | Governance Model | Cooperative Alignment |
|---------|-----------------|----------------------|
| pg-boss | Solo maintainer, MIT, no monetization | Good — pure OSS, no upsell. Bus-factor risk mitigated by 10-year stability + simple codebase (forkable). |
| BullMQ | Small company (Taskforce.sh), MIT + Pro tier | Moderate — core is OSS, but Pro features create dependency path. Redis itself now has license concerns (Redis Ltd switched to dual-license in 2024; Valkey is the Linux Foundation fork). |
| Graphile Worker | Solo maintainer, MIT + Pro tier, sponsor-funded | Moderate — OSS core, Pro tier for sustainability. Smaller community means less forking safety net. |
| Temporal | VC-backed ($200M+), MIT core | Lower — MIT license protects forking rights, but the server is complex enough that a community fork would be a major undertaking. |

## Recommendation

**pg-boss** for S/NC's media processing pipeline.

**Primary reasons:**
1. Zero new infrastructure — uses existing PostgreSQL 16
2. Mature and stable (v12.x, 10 years, 256k weekly downloads)
3. MIT with no paywalled features
4. Sufficient for scale: retries, DLQ, cron, concurrency control, priority queues
5. Values-aligned: no corporate lock-in, no upsell, simple enough to fork if abandoned

**What pg-boss lacks vs BullMQ:** native job flows (DAGs) and real-time progress tracking. For the media pipeline, chain jobs manually (worker completes → sends next job) and write FFmpeg progress directly to the content table. This is straightforward and sufficient for dozens of jobs/day.

**If S/NC outgrows pg-boss:** BullMQ + Valkey (Linux Foundation open-source Redis fork) is the natural next step. Only consider it when you need hundreds of concurrent jobs, complex DAGs, or sub-second latency under load.
