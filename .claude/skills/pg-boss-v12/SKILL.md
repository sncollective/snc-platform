---
name: pg-boss-v12
description: >
  pg-boss v12 PostgreSQL job queue reference. Auto-loads when working with pg-boss,
  PgBoss, job queue, background jobs, boss.send, boss.work, boss.schedule, boss.fetch,
  boss.createQueue, worker queue, job processing.
user-invocable: false
---

# pg-boss v12 Reference

> **Version:** 12.x
> **Docs:** https://timgit.github.io/pg-boss/

See [reference.md](reference.md) for the full API reference (constructor, queues, send, work, scheduling, events).

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
  heartbeatSeconds: 60,    // Detect dead worker in ~2 min
})
```

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
    heartbeatSeconds: 60,        // Long-running: detect dead workers
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

4. **Don't set `heartbeatSeconds` below `monitorIntervalSeconds`** — the monitor checks heartbeats at `monitorIntervalSeconds` intervals (default 60s). Setting heartbeat below this provides no benefit.

5. **Don't delete throttled/debounced jobs after processing** — the job record enforces the uniqueness constraint. Deleting it re-opens the time slot, breaking your throttling policy.

6. **Don't use `deadLetter` without creating the dead letter queue first** — the dead letter queue must exist before jobs can be routed to it.

## Resources

- [pg-boss Documentation](https://timgit.github.io/pg-boss/)
- [pg-boss GitHub](https://github.com/timgit/pg-boss)
- [cron-parser syntax](https://www.npmjs.com/package/cron-parser)
