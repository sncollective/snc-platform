---
name: pg-boss-v12
description: >
  pg-boss v12 PostgreSQL job queue reference. Auto-loads when working with pg-boss,
  PgBoss, job queue, background jobs, boss.send, boss.work, boss.schedule, boss.fetch,
  boss.createQueue, worker queue, job processing.
user-invocable: false
updated: 2026-06-17
---

# pg-boss v12 Reference

> **Version:** 12.15.0 (pinned via `^12.14.0` in `apps/api/package.json`; DB schema version 30)
> **Docs:** https://timgit.github.io/pg-boss/

See [reference.md](reference.md) for the full API reference (constructor, queues, send, work, scheduling, events). The §Source-confirmed internals section below records behavior read directly from the cloned source at tag `12.15.0` — provenance attestation at `.research/attestation/pg-boss-src-12-15-0.md`.

## Key Gotchas

### Handler Receives an Array

`work()` always passes an **array** of jobs to the handler, even with `batchSize: 1` (the default). Always destructure:

```typescript
// Correct — destructure the array
await boss.work('my-queue', async ([job]) => {
  console.log(job.data)
})

// Also correct — batch processing
await boss.work('my-queue', { batchSize: 5 }, async (jobs) => {
  for (const job of jobs) { /* ... */ }
})

// WRONG — job will be the array, not a single job
await boss.work('my-queue', async (job) => {
  console.log(job.data) // undefined!
})
```

### `send()` Returns Null for Throttled Jobs

When using `singletonSeconds`, `sendThrottled()`, or `sendDebounced()`, `send()` resolves to `null` (not a rejection) if the job was throttled. Always check the return value:

```typescript
const jobId = await boss.send('my-queue', data, { singletonSeconds: 60 })
if (jobId === null) {
  // Job was throttled — this is expected, not an error
}
```

### Default Expiration is 15 Minutes

Jobs expire after 15 minutes in active state by default (`expireInSeconds: 900`). For long-running jobs, set this explicitly:

```typescript
// Video processing — allow 2 hours
await boss.send('transcode', data, { expireInSeconds: 7200 })
```

### Default Retry Limit is 2

Jobs retry twice before failing. Override per-queue or per-job:

```typescript
await boss.createQueue('critical-email', { retryLimit: 5, retryDelay: 30, retryBackoff: true })
```

### Polling Interval

`work()` polls every 2 seconds by default. Adjust for your use case:

```typescript
// Check less frequently for batch jobs
await boss.work('daily-report', { pollingIntervalSeconds: 30 }, handler)
```

### Scheduling Must Be Enabled

`schedule: true` is the default, but if disabled in the constructor, cron-based scheduling won't work. Cron uses 5-field format (minute precision) — avoid the 6-field second-precision format.

```typescript
// Good — minute precision
await boss.schedule('cleanup', '0 3 * * *') // 3:00 AM daily

// Bad — second precision (discouraged, evaluated every 30s anyway)
await boss.schedule('cleanup', '0 0 3 * * *')
```

### Queue Policies Control Concurrency

| Policy | Queued | Active | Use Case |
|--------|--------|--------|----------|
| `standard` | Unlimited | Unlimited | Default — general purpose |
| `short` | 1 | Unlimited | At most 1 pending job |
| `singleton` | Unlimited | 1 | Serial processing |
| `stately` | 1 | 1 | One job at a time, one waiting |
| `exclusive` | 1 total | — | One job exists period |
| `key_strict_fifo` | Per-key FIFO | Per-key serial | Ordered processing per entity |

### Heartbeat for Long-Running Jobs

Use `heartbeatSeconds` (>= 10) to detect dead workers quickly, instead of waiting for `expireInSeconds` to elapse:

```typescript
await boss.createQueue('video-process', {
  expireInSeconds: 7200,   // Max 2 hours
  heartbeatSeconds: 60,    // Stall tolerance, not a detection SLA — see anti-pattern #4
})
```

Detection still waits for the maintenance sweep to run, so actual reclaim latency is bounded below by the sweep cadence, not by `heartbeatSeconds`. The win over `expireInSeconds` alone is a *tighter* stall tolerance (~minutes instead of hours), not sub-sweep precision.

## Queue Registration Pattern

Define queue names as a constant enum, create queues with explicit options during startup, then register workers:

```typescript
/** Canonical pg-boss queue names. */
export const JOB_QUEUES = {
  PROBE_CODEC: 'media/probe-codec',
  TRANSCODE: 'media/transcode',
  EXTRACT_THUMBNAIL: 'media/extract-thumbnail',
} as const

export const registerWorkers = async (boss: PgBoss): Promise<void> => {
  // Create queues with per-queue options
  await boss.createQueue(JOB_QUEUES.PROBE_CODEC, {
    retryLimit: 2,
    expireInSeconds: 300,
    deleteAfterSeconds: 60 * 60 * 24 * 7,
  })

  await boss.createQueue(JOB_QUEUES.TRANSCODE, {
    retryLimit: 1,
    expireInSeconds: 7200,
    heartbeatSeconds: 60,        // Long-running: stall tolerance (detection floored by sweep cadence — see anti-pattern #4)
    deleteAfterSeconds: 60 * 60 * 24 * 7,
  })

  // Register workers with typed data
  await boss.work<ProbeJobData>(
    JOB_QUEUES.PROBE_CODEC,
    { localConcurrency: 2 },
    (jobs) => handleProbeCodec(jobs as [Job<ProbeJobData>], boss),  // Pass boss for chaining
  )
}
```

## Job Pipeline / Chaining Pattern

Chain jobs by passing the `boss` instance into handlers and calling `boss.send()` for the next stage:

```typescript
// Handler signature — receives boss to dispatch follow-up jobs
export async function handleProbeCodec(jobs: [Job<ProbeJobData>], boss: PgBoss): Promise<void> {
  const [job] = jobs
  const result = await probeFile(job.data.filePath)

  // Chain: dispatch transcode + thumbnail extraction in parallel
  await boss.send(JOB_QUEUES.TRANSCODE, {
    uploadId: job.data.uploadId,
    codec: result.codec,
  })

  await boss.send(JOB_QUEUES.EXTRACT_THUMBNAIL, {
    uploadId: job.data.uploadId,
    timestamp: result.duration / 2,
  })
}
```

Key points:
- Pass `boss` as a parameter to handler functions (not imported as singleton)
- Use the `JOB_QUEUES` constants for queue names
- Each handler is responsible for dispatching the next stage(s)
- Failed jobs retry independently — the pipeline is loosely coupled

## Anti-Patterns

1. **Don't forget to listen to the `error` event** — unhandled EventEmitter errors crash the Node process:
   ```typescript
   boss.on('error', (err) => logger.error(err, 'pg-boss error'))
   ```

2. **Don't use `insert()` expecting job IDs back** — `insert()` is for batch creation and doesn't return IDs by default. Use `send()` for single jobs.

3. **Don't mix `fetch()`/`complete()` with `work()` on the same queue** — pick one pattern. `work()` manages the full lifecycle automatically; `fetch()` is for manual control.

4. **Heartbeat *detection* is gated by the maintenance/monitor cadence, not the refresh interval** — source-confirmed (`src/manager.ts:222`, `src/plans.ts:1143`): the worker refreshes `heartbeat_on` client-side every `heartbeatSeconds / 2` (overridable via `heartbeatRefreshSeconds`), but a *dead* worker is only reclaimed when the periodic `failJobsByHeartbeat` sweep runs. So a `heartbeatSeconds` shorter than the sweep cadence tightens the *refresh* but not the *detection floor* — detection latency is bounded below by the maintenance interval, not by `heartbeatSeconds`. Set `heartbeatSeconds` to the stall tolerance you want and don't expect sub-sweep detection.

5. **Don't delete throttled/debounced jobs after processing** — the job record enforces the uniqueness constraint. Deleting it re-opens the time slot, breaking your throttling policy.

6. **Don't use `deadLetter` without creating the dead letter queue first** — the dead letter queue must exist before jobs can be routed to it.

## Source-confirmed internals

Read from the cloned source at tag `12.15.0` (provenance: `.research/attestation/pg-boss-src-12-15-0.md`). All job-selection, locking, retry, and timeout logic lives as embedded SQL in `src/plans.ts`; the JS layer (`manager.ts`/`worker.ts`/`contractor.ts`) only orchestrates it. These are the behaviors the docs gloss — load-bearing because pg-boss runs against our shared app PostgreSQL.

### Fetch is `FOR UPDATE SKIP LOCKED`; visibility is state-based

`fetchNextJob` (`src/plans.ts:872`) selects candidates in a CTE with `FOR UPDATE SKIP LOCKED` (`:920`), then the outer `UPDATE` flips them to `state = 'active'`, `started_on = now()`. Consequences:

- **Concurrent pollers never block each other** — each grabs a disjoint row set. Safe to run many workers / many API instances against one queue.
- **There is no lease/visibility-timeout column.** A job is invisible to fetch purely because `state >= 'active'` (the `WHERE state < 'active'` predicate; the `job_state` enum is ordinally ordered `created < retry < active < completed < cancelled < failed`). Re-visibility on a stuck job happens by an explicit maintenance sweep moving it *out* of `active` (next subsection), not by a lock expiring.
- **A re-fetch counts as a retry**: the claim sets `retry_count = retry_count + 1` when `started_on IS NOT NULL` (`:970`).
- The fetch index is a partial covering index `job_i5 ON job (name, start_after) INCLUDE (priority, created_on, id) WHERE state < 'active'` (`src/plans.ts:522`).

### A stuck `active` job is reclaimed by two maintenance sweeps

No lease means a worker that dies mid-job leaves the row `active` until a sweep fails it (both wrapped in an advisory lock, run on the maintenance/monitor cadence):

- **`expireInSeconds` sweep** — `failJobsByTimeout` (`src/plans.ts:1133`): `active` AND `started_on + expire_seconds < now()` → failed with `"job timed out"`. Default 900s (15 min).
- **`heartbeatSeconds` sweep** — `failJobsByHeartbeat` (`src/plans.ts:1143`): `active` AND `heartbeat_on + heartbeat_seconds < now()` → failed with `"job heartbeat timeout"`. Only fires if the queue sets `heartbeatSeconds`; gives faster dead-worker detection than waiting out `expireInSeconds`.
- Client-side, the handler is also raced against `maxExpiration` via an `AbortController` (`resolveWithinSeconds`, `src/manager.ts:234`) — the job's `signal` is passed to the handler, so a well-behaved long job can observe cancellation.
- **On graceful shutdown** `failWip` (`src/manager.ts:301`) fails every in-flight job with `'pg-boss shut down while active'` — so they re-enter the retry machine rather than hanging `active`. (Platform's `stopBoss` races `boss.stop()` against a 15s timeout — jobs still running when the timeout wins are *not* failed by `failWip` and rely on the `expireInSeconds` sweep instead.)

### Retry / backoff / dead-letter is one SQL statement

`failJobs` (`src/plans.ts:1168`) is shared by manual `fail()`, the timeout sweep, and the heartbeat sweep. It `DELETE … RETURNING`s the row then re-`INSERT`s it as:

- **`retry`** if `retry_count < retry_limit`, else **`failed`**.
- Next `start_after`: flat `retry_delay` when `retry_backoff` is false (the default); when true, **exponential with jitter** — the delay is drawn uniformly from `[retry_delay × 2^n / 2, retry_delay × 2^n]` where `n = LEAST(16, retry_count+1)` (i.e. `retry_delay × 2^(retry_count+1)` is the *ceiling*, not the base; the floor is half that), then clamped by `retry_delay_max` (`src/plans.ts:1218`).
- **Dead-letter** (`dlq_jobs` CTE, `:1312`): when a job lands in `failed` and its queue has `deadLetter` set, a *new* job carrying the original `data` + `output` is inserted into the DLQ. The DLQ must already exist (FK-enforced; `createQueue` validates it) — this is why anti-pattern #6 holds.

Defaults: `retryLimit: 2`, `retryDelay: 0`, `retryBackoff: false`.

### Worker poll loop + how concurrency composes

`Worker.run` (`src/worker.ts:60`) is `while (!stopping) { fetch → onFetch → adaptive delay }`. The delay is `pollingInterval − lastDuration`, skipped when the worker was `notify()`d or the remainder is ≤ 100ms. Concurrency stacks in layers:

- **`localConcurrency`** (default 1) spawns N independent `Worker` poll loops for the same queue in one process.
- **`batchSize`** (default 1) is the SQL `LIMIT` — the handler always gets an array (see gotcha #1).
- **`groupConcurrency`** limits active jobs per `group_id` server-side (extra CTEs in the fetch query); `localGroupConcurrency` does the same in-process and `restore`s the excess.
- **Queue policies are enforced by partial unique indexes, not app code** (`src/plans.ts:506-540`): a throttled/singleton insert that would violate the index hits `ON CONFLICT DO NOTHING`, returns no id, and `send()` resolves `null` (gotcha #2). This is also why deleting a throttled job re-opens its slot (anti-pattern #5) — the row *is* the constraint.

### Job table is partitioned; migrations auto-run on `start()`

- **`pgboss.job` is `PARTITION BY LIST (name)`** (`src/plans.ts:294`). Queues created normally share the default `job_common` partition; a queue created with `partition: true` gets its own child table `j<sha224(name)>`. Platform creates no partitioned queues — every queue in `JOB_QUEUES` (`apps/api/src/jobs/queue-names.ts`) shares `job_common`.
- **Migration is automatic on `boss.start()`** — `Contractor.start` (`src/contractor.ts:42`) compares the code's schema number (`package.json` `pgboss.schema`, currently **30** — decoupled from the npm version) against the DB's stored `version` and migrates up if the code is ahead. Migrations run in one advisory-locked transaction guarded by an `assertMigration` "division by zero" race-check, so concurrent boss instances starting together don't double-migrate (the loser swallows only that specific error). **Upgrading the pg-boss dependency can therefore alter our shared PostgreSQL schema on the next server start** — treat a pg-boss bump like a DB migration: it is one, and it fires automatically. Large migrations may defer work to the background `bam` table (async migrations) rather than blocking startup.

## Resources

- [pg-boss Documentation](https://timgit.github.io/pg-boss/)
- [pg-boss GitHub](https://github.com/timgit/pg-boss)
- [cron-parser syntax](https://www.npmjs.com/package/cron-parser)
