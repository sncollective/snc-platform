---
id: research-pg-boss-vendored-source
tags: [research, workflow]
release_binding: null
research_origin: vendored-source-research-mode
created: 2026-06-16
---

# [research] Vendored-source acquire + orient: pg-boss v12

Apply vendored-source research mode to pg-boss (PostgreSQL job queue) — clone at our pinned
version, source-orient the `pg-boss-v12` tech-reference skill with source-grounded internals.
**Engagement entry:** `/agentic-research:research-orchestrator`.

## Acquire
- **Pin:** `pg-boss@^12.14.0` (package.json) — resolve the locked version (lockfile) and clone
  github.com/timgit/pg-boss at that tag. TypeScript + SQL — the internals are *readable* (unlike
  an opaque binary), which makes source-orientation cheap and high-value.

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
- Method: the **vendored-source research mode** (clone-at-pinned-version; source = `source-direct`
  tier, docs = portal tier; the two-pronged applicability gate). Carried in the
  `research_origin: vendored-source-research-mode` frontmatter; the orchestrator reads it at kickoff.

## Applicability check (the gate)
Source-available ✓ (OSS, TS/SQL — highly readable). Behavior/version-internals load-bearing ✓
(locking/retry/concurrency under load is the canonical "source beats docs" case; the SQL it runs
against our shared Postgres is load-bearing). Passes — strong candidate precisely because the
source is plain TS/SQL.
