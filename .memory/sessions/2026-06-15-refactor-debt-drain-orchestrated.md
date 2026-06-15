---
date: 2026-06-15
tags: [refactor, orchestration, workflow, testing]
session_type: refactor-debt drain (inline + orchestrated) → review → archive
related_items:
  - refactor-concurrent-awaits
  - refactor-use-polling-hook-extraction
  - refactor-jsdoc-exported-constants
  - refactor-component-splitting-oversized-files
  - refactor-pattern-compliance-sweep
  - refactor-route-file-size-splits
  - content-manage-list-not-responsive-mobile
---

# Session: drain the refactor-debt cluster (6 items) — inline → orchestrated → reviewed → archived

Continued from the e2e-drift-triage session (same day). With the full dev stack live and
agent-verifiable, picked the **refactor-debt** arc off the roadmap menu: 6 `[refactor]` items
that had been sitting at `stage: implementing` since 2026-04-20 with **zero work done** — the
stage was a mislabel, not motion. All closed this session: implemented, verified, deep-reviewed,
archived as bodyless stubs.

## The load-bearing finding: every plan had drifted

The single most important lesson — **all six 2026-04-20 plans were partly stale against current
code**, and the value of the work was the re-grounding, not the execution:

- `concurrent-awaits`: site 1 (creator.routes) was already half-done; the proposed projects.tsx
  effect-merge was **not behavior-preserving** (different dep arrays → would re-fetch on every
  toggle) — dropped. Real win: flattening two adjacent `Promise.all` blocks into one.
- `use-polling`: the two sites had genuinely diverged (T|null vs {data,isLoading}); rather than
  "pattern diverged — not extracted," a hook with `initial`/`key`/`immediate` options absorbs both.
- `jsdoc`: dropped the ESLint-detector task — platform has **no ESLint by design** (lint = tsc;
  inline-documentation.md §rationale explicitly rejects ESLint JSDoc enforcement). Net 6 blocks,
  not the stale ~30.
- `component-splitting`: dropped the useReducer consolidation (changes batching/re-render timing —
  not behavior-preserving). Did the emissions-chart presentational split + formatSeconds dedup.
- `pattern-compliance`: several tasks already done; `playout.ts` Result-return change verified
  caller-safe (HTTP behavior identical).
- `route-splits`: streaming already extracted, upload under threshold (dropped), booking optional
  (deferred). Only content.routes was real.

This is direct evidence for the upstream `backlog-grooming-skill` gap parked earlier: a backlog
rots silently and plans drift; nothing detects it continuously.

## Orchestration: what worked, what surprised

First two items drained **inline** (concurrent-awaits, use-polling). Remaining four handed to a
**worktree-isolated Workflow** (reground → implement → verify → advance), after confirming the
4 items were **disjoint at the file level** (zero pairwise overlap — my initial "they collide on
streaming/simulcast" worry was wrong; same directory ≠ same file). Findings:

- 3 of 4 landed clean. The 4th (route-splits) **self-blocked correctly** — its content.routes
  split needed a test-file edit outside its ownership AND forbidden by the no-test-edit gate, so
  it reverted to a clean worktree and escalated rather than forcing it. Exactly right.
- **The orchestrator's worktree changes were UNCOMMITTED** in the worktree dirs (not committed to
  worktree branches) — picked them up by copying changed+new files onto main, then ran the
  **combined-tree** suite myself (worktrees pass independently; combining can still break — it
  didn't, but the check is non-negotiable).
- On the authorized route-split retry, a fresh agent caught that the **original plan had a latent
  Hono bug**: static `/drafts` does NOT resolve ahead of param `/:id` across a co-mounted sub-app
  boundary (verified empirically against installed Hono 4.12.12). Naive mount order → `/drafts`
  captured by `/:id` → 400 regression. Fix: mount `contentFeedRoutes` FIRST. The original agent's
  revert had saved us from shipping that bug.

## Review

Batch review, substrate mode: 5 features deep-lane (2 highest-risk via adversarial fresh-context
reviewers prompted to *refute* byte-identical), 1 story fast-lane. Both adversarial reviewers
tried and **could not refute** — emissions-chart SVG paint-order/attributes/ARIA confirmed
identical; content-split route resolution empirically confirmed. Verdict **Approve** ×6, zero
blockers, one harmless nit (OpenAPI doc path ordering). All advanced review→done, archived as
**bodyless stubs** (delete-refs, archived_atop 0.3.0, bodies at git_ref 5672b42), late-bindable
into a future release.

## Spun-off work

- `content-manage-list-not-responsive-mobile` (parked the prior session, still open) — unrelated.
- 2 upstream skills proposals on branch `park/priority-and-grooming-gaps` in the skills repo
  (priority-value signal + backlog-grooming) — the grooming one is now strongly evidenced by this
  session's pervasive plan-drift.

## Verification baselines (held throughout)

shared 675 / api 1610 / web 1737 unit tests; tsc clean across all 3 packages; live smoke tests
(creator feed, /live render, content route resolution). Every refactor proven behavior-preserving
on the **combined** tree, not just per-worktree.

## Resume map

- 4 commits pushed to `forgejo/main` this session (reconcile + 2 reconciled-upstream + the 4
  refactor/review commits; the 4 local were `c59818f`, `c61565a`, `5672b42`, `60fc826`).
- Review queue now holds only the 3 **done-but-held** stories awaiting user fix-verify against
  prod/staging: `failed-upload-blocks-retry`, `on-forward-session-first-classifier`,
  `systemd-graceful-exit`. These are the next cheap closes — they need the operator, not an agent.
- Next arc candidates: the **bold epics** (design-gated — spine is done; next is designing
  lifecycle-playout-queue or unified-channel editorial-engine), or finishing
  `live-experience-redesign` (closest to a complete epic).
