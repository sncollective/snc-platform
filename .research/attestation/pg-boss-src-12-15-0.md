---
source_handle: pg-boss-src-12-15-0
source_class: github-readme
fetched: 2026-06-17
source_path: platform/.research/reference/input/pg-boss (git tag 12.15.0 @ a827ec4d16b9a68e5051310ab13f955edf92fffa)
source_url: https://github.com/timgit/pg-boss
provenance: source-direct
substrate_confidence: source-direct
tool: pg-boss source tree (cloned at tag 12.15.0); TypeScript + embedded SQL
version: tag 12.15.0 (npm version); DB schema version 30 (package.json pgboss.schema)
topic: source-confirmed internals — SKIP LOCKED fetch, visibility/heartbeat timeout, retry/backoff state machine, dead-letter, polling loop, job-table SQL/indexes, partition model, version-bump migrations
---

# pg-boss source tree — tag 12.15.0

## Paraphrased summary

The cloned pg-boss source at tag `12.15.0` (npm version) carries DB **schema version 30**
(`package.json` → `pgboss.schema`; the schema number is decoupled from the npm version and is
what migrations key off). The codebase is ~6.4k LOC of TypeScript with all load-bearing job
behavior expressed as embedded PostgreSQL in `src/plans.ts` (1602 LOC). The JS layer
(`src/manager.ts`, `src/worker.ts`, `src/contractor.ts`) orchestrates those SQL plans; it holds
no job-selection logic of its own — selection, locking, retry, and timeout are all SQL. This
attestation records the actual source-level behavior for the four orient targets, distinct from
the docs text. Everything below is from the cloned tree at the pinned tag.

## Key passages

### 1. Fetch / locking — `SKIP LOCKED`, visibility-via-state, retry-count-on-fetch

**`fetchNextJob`** (`src/plans.ts`, function at line 872) builds the fetch query. The core CTE
selects candidate rows and locks them, then the outer statement claims them:

```sql
next AS (
  SELECT ...
  FROM <schema>.<table>
  WHERE name = '<name>' AND state < 'active' AND start_after < now() ...
  ORDER BY priority desc, created_on, id
  LIMIT <limit>
  FOR UPDATE SKIP LOCKED          -- src/plans.ts:920
)
...
UPDATE <schema>.<table> j SET
  state = 'active',
  started_on = now(),
  heartbeat_on = now(),
  retry_count = CASE WHEN started_on IS NOT NULL THEN retry_count + 1 ELSE retry_count END
FROM <finalCte>
WHERE name = '<name>' AND j.id = <finalCte>.id
RETURNING ...
```

Load-bearing specifics, all from `fetchNextJob`:
- **`FOR UPDATE SKIP LOCKED`** (line 920) is the concurrency primitive: multiple pollers fetch
  disjoint rows without blocking each other. This is *inside* the candidate CTE, so the row lock
  is held only for the duration of the claim transaction.
- **"Visibility" is state-based, not lock-based.** A job is invisible to fetch once its `state`
  becomes `active` (the `WHERE state < 'active'` filter; the `job_state` enum is ordinally
  ordered `created < retry < active < completed < cancelled < failed`, `src/plans.ts:83-96`).
  There is no separate visibility-timeout column — re-visibility on timeout happens by an
  explicit maintenance pass moving the row back out of `active` (see §2), not by a lease expiring.
- **Fetch increments `retry_count`** when `started_on IS NOT NULL` (line 970) — i.e. a re-fetch
  of a job that previously ran counts as a retry at claim time.
- **The fetch index is `job_i5`** (`src/plans.ts:522-524`):
  `CREATE INDEX job_i5 ON <schema>.job (name, start_after) INCLUDE (priority, created_on, id) WHERE state < 'active'`
  — a partial index covering exactly the fetch predicate + ORDER BY columns.
- `fetch()` in `src/manager.ts:685` wraps an empty `catch` (lines 706-710) commenting that
  "errors from fetchquery should only be unique constraint violations" — fetch errors are
  swallowed and an empty job array returned.

### 2. Timeout / worker-crash-mid-job — two server-side sweeps + one client-side abort

There is no in-fetch lease. A claimed (`active`) job that the worker never completes is reclaimed
by **maintenance sweeps** that run periodically (the monitor/maintenance cadence), each wrapped in
`locked()` (advisory lock, see §5):

- **Expiration sweep** — **`failJobsByTimeout`** (`src/plans.ts:1133`):
  `state = 'active' AND (started_on + expire_seconds * interval '1s') < now()` → routed through
  `failJobs` with output `{ "value": { "message": "job timed out" } }`. This is the
  `expireInSeconds` enforcement (default 900s = 15 min, `FIFTEEN_MINUTES`, `src/plans.ts:12,35`).
- **Heartbeat sweep** — **`failJobsByHeartbeat`** (`src/plans.ts:1143`):
  `state = 'active' AND heartbeat_seconds IS NOT NULL AND (heartbeat_on + heartbeat_seconds * interval '1s') < now()`
  → `failJobs` with `{ "value": { "message": "job heartbeat timeout" } }`. Faster dead-worker
  detection than waiting for `expire_seconds`, but only if `heartbeatSeconds` is set on the queue.
- **Client-side heartbeat refresh** — `#processJobs` in `src/manager.ts:201` starts a
  `setInterval` (line 224) that calls `this.touch(name, jobIds)` every `heartbeatSeconds / 2`
  (overridable via `heartbeatRefreshSeconds`, line 222). `touch` runs `touchJobs`
  (`src/plans.ts:1154`) setting `heartbeat_on = now()` for `active` jobs. So heartbeat refresh
  cadence is driven by the worker process, independent of the maintenance/monitor interval that
  runs the *detection* sweep.
- **Client-side expiration abort** — `#processJobs` wraps the handler in `resolveWithinSeconds(...)`
  (`src/manager.ts:234`) against `maxExpiration` (the max `expireInSeconds` across the batch) via
  an `AbortController`; the job's `signal` is exposed to the handler (line 212). So expiration is
  enforced both client-side (abort the in-process handler) and server-side (the sweep fails the
  stuck row).
- **Graceful-shutdown failure** — `Manager.failWip` (`src/manager.ts:301`) calls
  `fail(worker.name, jobIds, 'pg-boss shut down while active')` for every in-flight job on stop,
  then aborts the worker. On `boss.stop()`, in-flight jobs are failed (and thus subject to the
  retry machine), not silently abandoned.

### 3. Retry / backoff state machine + dead-letter — `failJobs`

**`failJobs`** (`src/plans.ts:1168`) is the retry engine, shared by `failJobsById`,
`failJobsByTimeout`, and `failJobsByHeartbeat`. It is a multi-CTE statement:
`DELETE ... RETURNING` the matched rows, then re-`INSERT` them into one of two CTEs:

- **`retried_jobs`** — `state = CASE WHEN retry_count < retry_limit THEN 'retry' ELSE 'failed' END`
  (lines 1209-1212). The next `start_after` is computed (lines 1218-1227):
  ```sql
  CASE WHEN retry_count = retry_limit THEN start_after
       WHEN NOT retry_backoff THEN now() + retry_delay * interval '1'
       ELSE now() + LEAST(
         retry_delay_max,
         retry_delay * ( 2 ^ LEAST(16, retry_count + 1) / 2
                       + 2 ^ LEAST(16, retry_count + 1) / 2 * random() )
       ) * interval '1s'
  END
  ```
  i.e. **exponential backoff**: with `n = LEAST(16, retry_count+1)`, the delay is
  `retry_delay × (2^n/2 + 2^n/2 × random())` — drawn uniformly from `[retry_delay × 2^n/2,
  retry_delay × 2^n]` (so `retry_delay × 2^(retry_count+1)` is the *ceiling*, the floor is half
  that), exponent capped at 16, clamped above by `retry_delay_max`. With `retry_backoff: false`
  (the default,
  `QUEUE_DEFAULTS.retry_backoff = false`, `src/plans.ts:41`), the delay is the flat `retry_delay`
  (default 0).
- **`failed_jobs`** — rows whose id is not in `retried_jobs` get `state = 'failed'`,
  `completed_on = now()` (lines 1247-1305).
- **`dlq_jobs`** (line 1312) — for results that landed in `failed`, if the source queue has a
  `dead_letter` set, a NEW job is inserted into the dead-letter queue (`INSERT INTO <schema>.job
  (name, data, output, ...) SELECT r.dead_letter, data, output, ...`) carrying the original data
  + output. Dead-letter is queue-level config (`createQueue({ deadLetter })`); the DLQ must
  already exist (FK `dlq_fkey`, `src/plans.ts:502`; `createQueue` validates it,
  `src/manager.ts:835`).

Defaults (`QUEUE_DEFAULTS`, `src/plans.ts:34-43`): `retry_limit = 2`, `retry_delay = 0`,
`retry_backoff = false`, `expire_seconds = 900`, `retention_seconds = 14 days`,
`deletion_seconds = 7 days`.

### 4. Polling loop + concurrency

**Worker poll loop** — `Worker.run` (`src/worker.ts:60`): `while (!this.stopping)` → `fetch()` →
`onFetch(jobs)` → adaptive delay. The delay (lines 96-100) is `interval - duration`, and is
**skipped** when the worker `beenNotified` or when the remaining interval is `<= 100` ms.
`notify()` (line 108) aborts the in-flight delay promise for an immediate re-poll. Default poll
interval is the docs-stated 2s (`pollingIntervalSeconds`).

**Concurrency layers** (all in `src/manager.ts` `work()`, line 314):
- **`localConcurrency`** (default 1) spawns N independent `Worker` instances for the same queue,
  each its own poll loop (lines 390-396).
- **`batchSize`** (default 1) → the SQL `LIMIT` in `fetchNextJob`. The handler always receives an
  **array** (confirmed: `onFetch`/`#processJobs` operate on `jobs: Job[]`).
- **`groupConcurrency`** — server-side per-`group_id` active-count limiting via the
  `active_group_counts` + `group_ranking` + `group_filtered` CTEs in `fetchNextJob`
  (`src/plans.ts:904-951`), index `job_i7` (`src/plans.ts:538-539`).
- **`localGroupConcurrency`** — in-memory per-worker group tracking (`#localGroupActive`,
  `src/manager.ts:79-199`); excess jobs are `restore`d (set back to `created`,
  `src/plans.ts:1030`).
- **Queue policies** are enforced by **partial unique indexes**, not application logic
  (`src/plans.ts:506-540`): `short` = unique on `(name, singleton_key)` where `state='created'`
  (`job_i1`); `singleton` = unique where `state='active'` (`job_i2`); `stately` = unique where
  `state<='active'` (`job_i3`); `exclusive` = `job_i6`; `key_strict_fifo` = `job_i8`. A throttled
  insert violates the index and `ON CONFLICT DO NOTHING` returns no id → `send()` resolves `null`.

### 5. Job-table model, advisory locks, schema-bump migrations

- **Partition model** — `<schema>.job` is `CREATE TABLE ... PARTITION BY LIST (name)`
  (`src/plans.ts:294-324`). The default partition is `job_common` (a single shared table holding
  all non-partitioned queues, `src/plans.ts:350-368`). A queue created with `partition: true` gets
  its **own dedicated child table** named `j<sha224(queue_name)>` (`create_queue` plpgsql function,
  `src/plans.ts:371-455`), attached via `ALTER TABLE ... ATTACH PARTITION ... FOR VALUES IN`.
  Non-partition queues all share `job_common`. Per-queue config lives in `<schema>.queue`
  (`src/plans.ts:108-137`).
- **Advisory-locked maintenance** — `locked()` (`src/plans.ts:1413`) wraps multi-statement ops in
  `BEGIN; SET LOCAL lock_timeout=30000; SET LOCAL idle_in_transaction_session_timeout=30000;
  pg_advisory_xact_lock(...); ...; COMMIT;`. The lock key is
  `pg_advisory_xact_lock(sha224(current_database()||'.pgboss.'||schema||key))` (`advisoryLock`,
  `src/plans.ts:1426`) — so two boss instances against the same DB+schema serialize on
  create-queue, migration, deletion, timeout-sweep, and stats-cache ops.
- **Migrations on version bump** — `Contractor.start()` (`src/contractor.ts:42`) runs on
  `boss.start()`: if the schema is installed and the code's `schemaVersion` (read from
  `package.json` `pgboss.schema = 30`, `src/contractor.ts:7`) is greater than the DB's stored
  `version`, it auto-migrates; otherwise it creates the schema. **Migration is automatic and
  unconditional on startup** unless `migrate: false`-equivalent control is used. `migrate`
  (`src/migrationStore.ts:32`) concatenates every migration whose `previous >= current_version`,
  ordered ascending, into one `locked()` transaction; `flatten` (`src/migrationStore.ts:5`)
  prepends `assertMigration` (the `version/(version-target)` "division by zero" race guard,
  `src/plans.ts:1432`) and appends `setVersion`. The startup migrate `catch`
  (`src/contractor.ts:83`) only swallows the `MIGRATE_RACE_MESSAGE = 'division by zero'` error
  (concurrent boss already migrated); anything else re-throws.
- **Async / background migrations (BAM)** — migrations may carry an `async` command set
  (`src/migrationStore.ts:38-46`) that, instead of running inline, inserts rows into the
  `<schema>.bam` table (`src/plans.ts:167-183`) processed by a background command runner
  (`getNextBamCommand`, `src/plans.ts:1489`, single-in-progress via the `NOT EXISTS ... 'in_progress'`
  guard). This lets large partitioned-table migrations run out-of-band rather than blocking startup.

## Substrate notes (this engagement's grounding)

The platform usage that anchors this orient (`platform/apps/api/src/jobs/`): `boss.ts` constructs
`new PgBoss({ schema: 'pgboss', schedule: false })` and races `boss.stop()` against a 15s timeout
on shutdown — so §2's `failWip` (in-flight jobs failed on stop) and the retry machine in §3 are
on the platform's shutdown path. Seven queues are registered (`queue-names.ts`), media queues
use `localConcurrency` and per-queue `expireInSeconds`/`heartbeatSeconds` (`register-workers.ts`),
all on the shared `job_common` partition (no queue sets `partition: true`).
