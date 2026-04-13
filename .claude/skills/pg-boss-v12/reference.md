# pg-boss v12 API Reference

## Constructor

### `new PgBoss(connectionString)`

```typescript
const boss = new PgBoss('postgres://user:pass@host:5432/database')
```

### `new PgBoss(options)`

**Connection options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `host` | string | "127.0.0.1" | PostgreSQL host |
| `port` | int | 5432 | PostgreSQL port |
| `database` | string | *required* | Database name |
| `user` | string | *required* | Database user |
| `password` | string | — | Database password |
| `connectionString` | string | — | PostgreSQL connection string (overrides individual fields) |
| `ssl` | boolean/object | — | SSL configuration |
| `max` | int | 10 | Max pool connections for this instance |
| `application_name` | string | "pgboss" | PostgreSQL application name |
| `schema` | string | "pgboss" | Database schema name (alphanumeric + underscore, <= 50 chars) |
| `db` | object | — | Bring-your-own connection (must implement `executeSql(text, values)`) |

**Operations options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `supervise` | bool | true | Enable maintenance and monitoring |
| `schedule` | bool | true | Enable cron scheduling |
| `migrate` | bool | true | Run schema migrations on `start()` |
| `createSchema` | bool | true | Issue `CREATE SCHEMA` during install |
| `superviseIntervalSeconds` | int | 60 | How often queues are monitored |
| `maintenanceIntervalSeconds` | int | 86400 (1 day) | How often maintenance drops old jobs |
| `monitorIntervalSeconds` | int | 60 | How often queues are checked for backlogs/expired jobs |
| `queueCacheIntervalSeconds` | int | 60 | Queue metadata cache refresh interval |
| `persistWarnings` | bool | false | Persist warnings to `warning` table |
| `warningRetentionDays` | int | — | Auto-delete warnings older than N days (max 365) |

### Lifecycle

```typescript
const boss = new PgBoss(options)
boss.on('error', err => logger.error(err))  // MUST add before start()
await boss.start()

// ... use boss ...

await boss.stop()  // Graceful shutdown
```

---

## Queue Management

### `createQueue(name, options)`

```typescript
await boss.createQueue('my-queue', {
  // Policy
  policy: 'standard',        // 'standard' | 'short' | 'singleton' | 'stately' | 'exclusive' | 'key_strict_fifo'
  partition: false,           // Create dedicated table for this queue
  deadLetter: 'failed-jobs',  // Queue name for jobs that exhaust retries

  // Retry
  retryLimit: 2,              // Number of retries (default: 2)
  retryDelay: 0,              // Delay between retries in seconds
  retryBackoff: false,        // Exponential backoff
  retryDelayMax: undefined,   // Max backoff delay in seconds

  // Heartbeat
  heartbeatSeconds: undefined, // Liveness check interval (>= 10, disabled by default)

  // Expiration
  expireInSeconds: 900,       // Max time in active state (default: 15 min)

  // Retention
  retentionSeconds: 1209600,  // Max time in created/retry state (default: 14 days)
  deleteAfterSeconds: 604800, // Retain completed jobs (default: 7 days, 0 = never delete)

  // Monitoring
  warningQueueSize: undefined // Emit warning when queue exceeds this size
})
```

**Queue Policies:**

| Policy | Queued | Active | Use Case |
|--------|--------|--------|----------|
| `standard` | Unlimited | Unlimited | General purpose (default) |
| `short` | 1 | Unlimited | At most 1 pending job |
| `singleton` | Unlimited | 1 | Serial processing |
| `stately` | 1 | 1 | One job at a time, one waiting |
| `exclusive` | 1 total | — | Only one job exists at a time |
| `key_strict_fifo` | Per-key FIFO | Per-key serial | Ordered processing per entity |

### Other Queue Methods

```typescript
await boss.updateQueue('my-queue', { retryLimit: 5 }) // Can't change policy or partition
await boss.deleteQueue('my-queue')                     // Deletes queue and all jobs
const queues = await boss.getQueues()                  // List all queues
const queue = await boss.getQueue('my-queue')          // Get queue details
const stats = await boss.getQueueStats('my-queue')     // Force-refresh stats
const keys = await boss.getBlockedKeys('my-queue')     // key_strict_fifo only
```

---

## Sending Jobs

### `send(name, data, options)`

Returns job ID (string) or `null` if throttled/debounced.

```typescript
const jobId = await boss.send('email-welcome', { to: 'user@example.com' }, {
  // General
  priority: 0,               // Higher number = higher priority
  id: undefined,              // Custom UUID (auto-generated if omitted)

  // Retry (overrides queue defaults)
  retryLimit: 2,
  retryDelay: 0,
  retryBackoff: false,
  retryDelayMax: undefined,

  // Heartbeat
  heartbeatSeconds: undefined, // Override queue-level heartbeat

  // Expiration
  expireInSeconds: 900,       // Max active time

  // Retention
  retentionSeconds: 1209600,
  deleteAfterSeconds: 604800,

  // Deferral
  startAfter: undefined,      // int (seconds) | string (ISO date) | Date

  // Throttle/Debounce
  singletonSeconds: undefined, // Time window for dedup
  singletonKey: undefined,     // Extend throttling per key
  singletonNextSlot: false,    // Schedule to next slot if throttled

  // Grouping
  group: undefined,            // { id: string, tier?: string }

  // Custom connection
  db: undefined                // Bring-your-own connection
})
```

### `send({ name, data, options })`

Object overload:
```typescript
const jobId = await boss.send({ name: 'backup', options: { retryLimit: 1 } })
```

### Convenience Methods

```typescript
// Delayed send
await boss.sendAfter('queue', data, options, 60)           // 60 seconds from now
await boss.sendAfter('queue', data, options, '2024-01-01') // ISO date string
await boss.sendAfter('queue', data, options, new Date())   // Date object

// Throttled — first job in interval wins, others rejected (null)
await boss.sendThrottled('queue', data, options, 60)       // 60-second window
await boss.sendThrottled('queue', data, options, 60, 'key') // Per-key throttle

// Debounced — if throttled, schedule for next slot
await boss.sendDebounced('queue', data, options, 60)
await boss.sendDebounced('queue', data, options, 60, 'key')
```

### `insert(name, jobs, options)`

Batch insert (no job IDs returned by default):

```typescript
await boss.insert('email-batch', [
  { data: { to: 'a@example.com' }, priority: 1 },
  { data: { to: 'b@example.com' }, startAfter: new Date('2024-06-01') },
  { data: { to: 'c@example.com' }, singletonKey: 'user-123' }
])

// JobInsert interface
interface JobInsert<T = object> {
  id?: string
  data?: T
  priority?: number
  retryLimit?: number
  retryDelay?: number
  retryBackoff?: boolean
  startAfter?: Date | string
  singletonKey?: string
  expireInSeconds?: number
  heartbeatSeconds?: number
  deleteAfterSeconds?: number
  keepUntil?: Date | string
  group?: { id: string; tier?: string }
}
```

---

## Working (Consuming Jobs)

### `work(name, options, handler)`

Registers a polling worker. Returns a unique worker ID.

```typescript
const workerId = await boss.work('my-queue', {
  // Fetch options
  batchSize: 1,                   // Jobs per fetch (default: 1)
  includeMetadata: false,         // Include full job metadata
  priority: true,                 // Fetch higher-priority jobs first
  orderByCreatedOn: true,         // FIFO ordering

  // Polling
  pollingIntervalSeconds: 2,      // How often to check for jobs (min: 0.5)

  // Concurrency
  localConcurrency: 1,            // Workers in this Node.js process
  localGroupConcurrency: undefined, // Per-group limit per node (in-memory, no DB overhead)
  groupConcurrency: undefined,    // Per-group limit globally (DB-enforced)

  // Heartbeat
  heartbeatRefreshSeconds: undefined // Custom heartbeat send interval (< heartbeatSeconds)
}, handler)
```

**Handler signature:**

```typescript
// Handler always receives an array of jobs
async function handler(jobs: Job[]) {
  // ...
}

interface Job<T = object> {
  id: string
  name: string
  data: T
  heartbeatSeconds: number | null
  signal: AbortSignal              // Use for fetch() calls, cancellation
}

// With includeMetadata: true
interface JobWithMetadata<T = object> {
  id: string
  name: string
  data: T
  priority: number
  state: 'created' | 'retry' | 'active' | 'completed' | 'cancelled' | 'failed'
  retryLimit: number
  retryCount: number
  retryDelay: number
  retryBackoff: boolean
  startAfter: Date
  startedOn: Date
  singletonKey: string | null
  singletonOn: Date | null
  groupId: string | null
  groupTier: string | null
  expireInSeconds: number
  heartbeatSeconds: number | null
  heartbeatOn: Date | null
  deleteAfterSeconds: number
  createdOn: Date
  completedOn: Date | null
  keepUntil: Date
  deadLetter: string
  policy: string
  output: object
}
```

**Concurrency options:**

| Option | Scope | Tracking | Use Case |
|--------|-------|----------|----------|
| `localConcurrency` | Per-node | Worker count | Total parallel capacity per node |
| `localGroupConcurrency` | Per-node, per-group | In-memory | Group fairness without DB overhead |
| `groupConcurrency` | Global, per-group | Database | Strict global group limits |

Cannot use both `localGroupConcurrency` and `groupConcurrency` simultaneously.

### `work(name, handler)`

Simplified (default options):

```typescript
await boss.work('my-queue', async ([job]) => {
  await processJob(job.data)
})
```

### Worker Control

```typescript
// Stop all workers for a queue
await boss.offWork('my-queue')

// Stop specific worker
await boss.offWork('my-queue', { id: workerId })

// Don't wait for current jobs to finish
await boss.offWork('my-queue', { wait: false })

// Bypass polling interval for one iteration
await boss.notifyWorker(workerId)
```

---

## Manual Job Control (fetch/complete pattern)

### `fetch(name, options)`

Returns an array of jobs (empty if none available):

```typescript
const jobs = await boss.fetch('my-queue', {
  batchSize: 1,              // Number of jobs to fetch
  priority: true,            // Priority ordering
  orderByCreatedOn: true,    // FIFO ordering
  includeMetadata: false,    // Include full metadata
  ignoreStartAfter: false    // Fetch deferred jobs immediately
})
```

### Job Lifecycle

```typescript
// Complete a job (with optional output data)
await boss.complete('my-queue', jobId, { result: 'success' })

// Complete multiple jobs
await boss.complete('my-queue', [id1, id2])

// Complete queued jobs (not yet fetched)
await boss.complete('my-queue', jobId, data, { includeQueued: true })

// Fail a job (with optional error data)
await boss.fail('my-queue', jobId, { error: 'timeout' })
await boss.fail('my-queue', [id1, id2])

// Cancel pending or active jobs
await boss.cancel('my-queue', jobId)
await boss.cancel('my-queue', [id1, id2])

// Resume cancelled jobs
await boss.resume('my-queue', jobId)
await boss.resume('my-queue', [id1, id2])

// Retry failed jobs
await boss.retry('my-queue', jobId)
await boss.retry('my-queue', [id1, id2])

// Send heartbeat for active jobs (manual fetch pattern)
await boss.touch('my-queue', jobId)
await boss.touch('my-queue', [id1, id2])
```

### Job Queries

```typescript
// Find jobs by id, key, or data
const jobs = await boss.findJobs('my-queue', { id: 'abc-123' })
const jobs = await boss.findJobs('my-queue', { key: 'user-123' })
const jobs = await boss.findJobs('my-queue', { data: { type: 'email' } })
const jobs = await boss.findJobs('my-queue', { key: 'user-123', queued: true })
```

### Job Deletion

```typescript
await boss.deleteJob('my-queue', jobId)        // Delete by ID
await boss.deleteJob('my-queue', [id1, id2])   // Delete multiple
await boss.deleteQueuedJobs('my-queue')        // Delete all queued
await boss.deleteStoredJobs('my-queue')        // Delete completed/failed/cancelled
await boss.deleteAllJobs('my-queue')           // Delete everything (including active)
await boss.deleteAllJobs()                     // Delete from ALL queues
```

---

## Scheduling

Cron-based job creation. Uses 5-field format (minute precision). Checked every 30 seconds.

```typescript
// Schedule a recurring job
await boss.schedule('nightly-cleanup', '0 3 * * *')  // 3:00 AM UTC daily

// With data and options
await boss.schedule('reports', '0 9 * * 1', { type: 'weekly' }, {
  tz: 'America/Chicago',  // Time zone (default: UTC)
  key: 'weekly-report'    // Unique key if multiple schedules per queue
})

// Remove schedule
await boss.unschedule('nightly-cleanup')
await boss.unschedule('reports', 'weekly-report')  // By queue + key

// List schedules
const all = await boss.getSchedules()
const byQueue = await boss.getSchedules('reports')
const byKey = await boss.getSchedules('reports', 'weekly-report')
```

**Clock skew:** Every 10 minutes, instance clocks are compared to the database server. Skew is stored and used as an offset to ensure synchronized cron evaluation across instances.

---

## Events

pg-boss instances are EventEmitters.

### `error`

Raised during internal processing (scheduling, maintenance). **Must** have a listener or unhandled errors crash the process.

```typescript
boss.on('error', error => logger.error(error))
```

### `warning`

Monitoring and maintenance warnings:

```typescript
boss.on('warning', ({ message, data }) => {
  console.log('pg-boss warning:', message, data)
})
```

| Type | Description | Data |
|------|-------------|------|
| `slow_query` | Maintenance query exceeded threshold | `elapsed` (seconds) |
| `queue_backlog` | Queue exceeded `warningQueueSize` | `name`, `queuedCount`, `warningQueued` |
| `clock_skew` | DB clock out of sync | `seconds`, `direction` |

### `wip`

Emitted at most every 2 seconds when workers are processing jobs:

```typescript
boss.on('wip', workers => {
  // workers: array of { id, name, options, state, count, createdOn, lastFetchedOn, ... }
})
```

### `stopped`

Emitted after `stop()` once all workers complete and maintenance shuts down.

### `bam`

Emitted when async migration commands change status:

```typescript
boss.on('bam', event => {
  // event: { id, name, status: 'in_progress'|'completed'|'failed', queue, table, error }
})
```
