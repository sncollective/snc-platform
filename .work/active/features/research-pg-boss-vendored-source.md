---
id: research-pg-boss-vendored-source
kind: feature
stage: done
tags: [research, workflow]
parent: null
depends_on: []
release_binding: null
gate_origin: null
research_origin: vendored-source-research-mode
research_refs: [research-pg-boss-vendored-source]
created: 2026-06-16
updated: 2026-06-17
research_dials:
  scope_authority: contained
  verification_rigor: full
  intent: inform-decision
  output_kind: [skill-orientation]
---

# [research] Vendored-source acquire + orient: pg-boss v12

Apply vendored-source research mode to pg-boss (PostgreSQL job queue) — clone at our pinned
version, source-orient the `pg-boss-v12` tech-reference skill with source-grounded internals.
**Engagement entry:** `/agentic-research:research-orchestrator`.

## Acquire
- **Pin:** `pg-boss@^12.14.0` (`apps/api/package.json`) — the lockfile (`bun.lock`) resolves this to
  **`pg-boss@12.15.0`**. Clone github.com/timgit/pg-boss at the `12.15.0` tag. TypeScript + SQL — the
  internals are *readable* (unlike an opaque binary), which makes source-orientation cheap and
  high-value.

## Orient (source-grounded internals worth pinning — the "behavior under load" tier)
- **Locking / fetch semantics** — how `boss.work`/`boss.fetch` lock jobs (SKIP LOCKED?), the
  visibility-timeout behavior, what happens on worker crash mid-job. These are exactly the
  behaviors docs gloss and source answers precisely.
- **Retry / backoff** — the retry-state machine, dead-letter behavior, `expireInSeconds`.
- **Concurrency / polling** — the SQL it actually runs (the job tables, indexes, the poll query) —
  load-bearing for "will this scale on our Postgres."
- **Schema migrations** — what pg-boss does to the DB on version bump (relevant since we share
  Postgres with the app).

## Grounding
- Existing position: `.research/analysis/positions/pg-boss-job-queue.md` (selection: zero new infra).
- Real usage surface to ground the orient against: the `apps/api/src/jobs/` subsystem (`boss.ts`,
  `register-workers.ts`, `queue-names.ts`, the five handlers) plus the services that enqueue
  (`upload-completion.ts`, `notification-dispatch.ts`, `notify-dispatch.ts`, `playout.ts`).
- Method: the **vendored-source research mode** (clone-at-pinned-version; source = `source-direct`
  tier, docs = portal tier; the two-pronged applicability gate). Carried in the
  `research_origin: vendored-source-research-mode` frontmatter; the orchestrator reads it at kickoff.

## Applicability check (the gate)
Source-available ✓ (OSS, TS/SQL — highly readable). Behavior/version-internals load-bearing ✓
(locking/retry/concurrency under load is the canonical "source beats docs" case; the SQL it runs
against our shared Postgres is load-bearing). Passes — strong candidate precisely because the
source is plain TS/SQL.

## Engagement record (2026-06-17)

Closed via `/agentic-research:research-orchestrator`. Dials honored from this item's
`research_dials` block (scope_authority contained → light path; verification_rigor full → all
four gates).

- **Acquire:** cloned `github.com/timgit/pg-boss` at tag `12.15.0` (commit `a827ec4`; the
  lockfile resolution of `^12.14.0`) into the gitignored reference holding-spot. DB schema
  version is **30** (`package.json` `pgboss.schema`, decoupled from the npm version).
- **Fan-out:** light path (1 source — the whole codebase is one ~6.4k-LOC TS tree; all four
  orient targets cross-cut `src/plans.ts`). Authored inline, no specialist spawn.
- **Output:**
  - Attestation `pg-boss-src-12-15-0` (source-direct, the four orient targets with
    file:line anchors + verbatim SQL for the load-bearing behaviors).
  - Source-oriented the `pg-boss-v12` skill: new "Source-confirmed internals" section
    (SKIP LOCKED fetch + state-based visibility, the two timeout sweeps + client-side
    abort + failWip-on-shutdown, the `failJobs` retry/backoff/dead-letter SQL, the poll
    loop + four-layer concurrency, partition model + auto-migrate-on-start). Version pin
    in the header. **Corrected** the pre-existing heartbeat anti-pattern (detection is
    floored by the maintenance-sweep cadence, not `heartbeatSeconds`) and reconciled two
    stale heartbeat code-comments to it.
- **Gates:** lint ✓ (0 broken / 0 thin / 0 unresolved; 2 version-number warnings are correct
  pinned facts, not drift) · adversarial-read **APPROVED** (all 13 source claims confirmed
  against the tree; jitter-formula + `<=100ms` boundary precision folded in) · evaluate
  **APPROVED** (isolated context; flagged the "seven queues" phrasing + heartbeat-comment
  tension, both fixed) · spot-check ✓.
- **Operative finding (inform-decision):** a pg-boss dependency bump auto-runs a PostgreSQL
  schema migration on the next `boss.start()` against our shared app DB — treat a bump like a
  DB migration in review. Detail in the skill + attestation.
