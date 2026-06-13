---
id: bold-lifecycle-transitions-playout-queue
kind: feature
stage: done
tags: [refactor, playout]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-06-12
updated: 2026-06-13
parent: bold-lifecycle-transitions
---

# Playout queue entry transitions: one owning module

## Brief
Crystallize the queue-entry lifecycle (`queued → playing → played`, plus admin
insert/remove/skip) into a single transition module that is the only writer of the queue
status column. Today the transitions are scattered through
`apps/api/src/services/playout-orchestrator.ts` (~974 LOC): `onTrackStarted` promotes
queued→playing and marks old→played, `insertIntoQueue` creates queued entries,
`removeFromQueue` guards on `status === "playing"` inline. The orchestrator keeps its
orchestration (auto-fill, prefetch push, Liquidsoap client calls) but delegates every
status mutation to named transitions.

Behavior-preserving: same DB writes in the same order under the same conditions —
verified by the existing orchestrator unit tests plus new transition-module tests.

Riskiest child of the epic (hot path, concurrent track events + admin mutations) —
design first via /agile-workflow:refactor-design. The named transitions become the
emission points for `bold-event-spine-publishers`, which depends on this feature.

## Refactor Overview

Transition discovery (full sweep, `rg "update\(playoutQueue\)|insert\(playoutQueue\)|delete\(playoutQueue\)"`):
all queue-entry **status** writes live in `playout-orchestrator.ts` — mark-played ×2
(`onTrackStarted` L283, `skip` L476), promote-next ×2 (`onTrackStarted` L316, `skip`
L502), birth-at-queued ×2 (`insertIntoQueue` L396, `autoFill` L766), plus the guarded
delete of a queued entry (`removeFromQueue` L451). Three other `playoutQueue` writes are
**not** lifecycle: position-shift (L369 — ordering mechanics, folded into the enqueue
transition since it's "make room for the new entry"), `pushedToLiquidsoap` flag writes
(L809, L916 — delivery bookkeeping, stays in the orchestrator), and the cleanup job's
retention purge (`jobs/handlers/playout-queue-cleanup.ts` L49 — deletes only terminal
`played` rows, reads the status column but never writes it; stays in the job handler).

**Scope boundary (load-bearing)**: the new module owns every write of
`playout_queue.status` and every creation/removal of a *live* (queued/playing) row.
Rejected: owning ALL `playoutQueue` writes — would drag delivery-flag and retention
mechanics into a module whose whole value is that reading it tells you the lifecycle;
the epic explicitly wants "one small transition module". Rejected: a generic
state-machine abstraction — epic names this as exactly the speculative generalization
to avoid.

New module: `apps/api/src/services/playout-queue-transitions.ts` — plain exported
functions (services style, like `channels.ts`; no factory — the orchestrator's factory
exists for the Liquidsoap client dependency, which transitions don't have). Five named
transitions, each a future event-spine emission point:

```ts
/** queued → playing → played. This module is the ONLY writer of
 * playout_queue.status and the only creator/remover of live queue rows.
 * Named transitions are the attachment points for side effects (event spine). */

/** playing → played. */
export const markPlayed = async (entryId: string): Promise<void>;

/** Promote the next queued entry (lowest position) to playing.
 * Returns the promoted row, or null when the queue is empty. */
export const promoteNext = async (channelId: string): Promise<QueueRow | null>;

/** Birth: create a queued entry. position given ⇒ shift queued entries at
 * >= position up by 1 first (same two statements, same order as today). */
export const enqueue = async (opts: {
  channelId: string;
  playoutItemId: string;
  position?: number;
}): Promise<QueueRow | null>;

/** Batch birth (auto-fill): reads MAX(position) over live rows, inserts all
 * at consecutive positions. Returns inserted count. */
export const enqueueBatch = async (
  channelId: string,
  playoutItemIds: string[],
): Promise<number>;

/** Removal of a live entry. Guard: refuses the playing entry (the guard IS
 * lifecycle logic). Caller passes the already-loaded row — no re-read. */
export const removeQueued = (
  entry: { id: string; status: string },
) => Promise<Result<void, AppError>>;
```

Behavior preservation: same DB statements, same order, same conditions — the
orchestrator keeps all reads (find-playing, find-candidates), all non-lifecycle writes,
all Liquidsoap calls, auto-fill thresholds, and the channelContent stats update (content
-pool bookkeeping, not queue lifecycle; stays adjacent to the markPlayed call site in
`onTrackStarted`, same order). The 1064-line orchestrator test suite pins this.

## Refactor Steps

### Step 1: markPlayed + promoteNext — convert the hot path
**Priority**: High
**Risk**: Medium (hot path: Liquidsoap track events; concurrency unchanged because
statements and order are unchanged)
**Source Lens**: missing abstraction / domain crystallization
**Files**: `apps/api/src/services/playout-queue-transitions.ts` (new),
`apps/api/src/services/playout-orchestrator.ts`,
`apps/api/tests/services/playout-queue-transitions.test.ts` (new)
**Story**: `bold-lifecycle-transitions-playout-queue-step-1`

**Current State** (`playout-orchestrator.ts` — duplicated in `onTrackStarted` L280-319
and `skip` L474-505):
```ts
if (playing) {
  await db.update(playoutQueue).set({ status: "played" })
    .where(eq(playoutQueue.id, playing.id));
}
// ... (skip: client.skipTrack between; onTrackStarted: channelContent stats between)
const [next] = await db.select().from(playoutQueue)
  .where(and(eq(playoutQueue.channelId, channelId), eq(playoutQueue.status, "queued")))
  .orderBy(asc(playoutQueue.position)).limit(1);
if (next) {
  await db.update(playoutQueue).set({ status: "playing" })
    .where(eq(playoutQueue.id, next.id));
}
```

**Target State**:
```ts
if (playing) {
  await markPlayed(playing.id);
}
// ... unchanged interleaved side effects in each caller ...
const promoted = await promoteNext(channelId); // select+update inside, same statements
```

**Implementation Notes**:
- `promoteNext` returns the promoted row (callers don't use it yet — the publishers
  feature will; returning it now avoids a signature change later and costs nothing:
  the row is already in hand from the select).
- The select-playing read stays in the callers (each interleaves different side
  effects between mark and promote — `onTrackStarted` updates channelContent stats,
  `skip` calls `client.skipTrack`).

**Acceptance Criteria**:
- [ ] Build passes; full orchestrator test suite green unchanged.
- [ ] New transition unit tests (drizzle-chainable-mock pattern, as in the
      orchestrator suite).
- [ ] `set({ status: "played" })` / `set({ status: "playing" })` no longer appear in
      `playout-orchestrator.ts`.

**Rollback**: revert the commit — single-commit step, no schema or contract change.

---

### Step 2: enqueue + enqueueBatch — convert insert and auto-fill
**Priority**: High
**Risk**: Low (admin path + auto-fill; same statements)
**Source Lens**: missing abstraction / domain crystallization
**Files**: same module + orchestrator + tests
**Story**: `bold-lifecycle-transitions-playout-queue-step-2`

**Current State**: `insertIntoQueue` L364-409 (optional position-shift UPDATE, then
INSERT...returning with `status: "queued"`); `autoFill` L742-766 (MAX(position) read,
batch INSERT with `status: "queued"`).

**Target State**: `insertIntoQueue` validates the item, then
`await enqueue({ channelId, playoutItemId, position })` (shift+max+insert inside,
statement-for-statement identical, returns the inserted row for the response mapping);
`autoFill` selects candidates, then `await enqueueBatch(channelId, candidateIds)`.

**Implementation Notes**:
- `enqueue` absorbs both the position-given branch (shift first) and the append branch
  (MAX over live rows) — both currently inline in `insertIntoQueue`.
- `enqueueBatch` absorbs the MAX(position) read currently in `autoFill` (read order
  preserved: candidates select happens in the orchestrator before the call, exactly as
  today).
- `pushedToLiquidsoap: false` stays part of the insert values (column default
  bookkeeping at birth, not a separate flag write).

**Acceptance Criteria**:
- [ ] Build passes; orchestrator suite green unchanged.
- [ ] Transition unit tests for both branches of `enqueue` + batch positions.
- [ ] `insert(playoutQueue)` no longer appears in `playout-orchestrator.ts`.

**Rollback**: revert the commit.

---

### Step 3: removeQueued + single-writer structural test
**Priority**: Medium
**Risk**: Low
**Source Lens**: domain crystallization / grep-detectable invariant (epic)
**Files**: same module + orchestrator + new structural test
**Story**: `bold-lifecycle-transitions-playout-queue-step-3`

**Current State**: `removeFromQueue` L436-452 — inline `status === "playing"` guard
(409 CANNOT_REMOVE_PLAYING) then DELETE.

**Target State**: orchestrator loads the entry (NotFound mapping stays), then
`return removeQueued(entry)` — guard + delete inside, same statements, same error.

**Implementation Notes**:
- Structural test (new, `apps/api/tests/services/playout-queue-single-writer.test.ts`):
  walks `apps/api/src` and asserts that `status: "queued" | "playing" | "played"` write
  expressions against `playoutQueue` (`set({ status:` and insert-values literals)
  appear ONLY in `playout-queue-transitions.ts`. This makes the epic's "stray writes
  become grep-detectable" an enforced invariant, not a convention. Allowlist the schema
  file and tests.
- Cleanup job's purge is deliberately outside the invariant (deletes terminal rows,
  never writes status) — the test only fences status-column writes and live-row
  creation.

**Acceptance Criteria**:
- [ ] Build passes; orchestrator + cleanup-job suites green unchanged.
- [ ] Structural single-writer test passes and fails when a stray write is introduced
      (verify by temporary mutation during development, not committed).
- [ ] `update(playoutQueue)` in the orchestrator only ever sets `pushedToLiquidsoap`
      or `position`.

**Rollback**: revert the commit.

## Implementation Order
1. `bold-lifecycle-transitions-playout-queue-step-1` (hot path — feasibility proof)
2. `bold-lifecycle-transitions-playout-queue-step-2`
3. `bold-lifecycle-transitions-playout-queue-step-3`

Sequential chain (shared module file; merge churn not worth parallelism at this size).

## Implementation summary (2026-06-13)

All three step stories implemented (one bundle agent, sequential, one commit each) and
at review. Orchestrator wave verification: full `@snc/api` unit suite green (1567 tests
/ 104 files), no build issues. The 34-test orchestrator suite passed **unchanged** — no
assertion weakened, no mock relocation needed (mocks bind at the db-connection module,
which the transitions module shares). Structural single-writer test tripwire-verified
(fails on an introduced stray write; cleanup job correctly exempt — it never writes
status). Remaining `update(playoutQueue)` in the orchestrator only sets
`pushedToLiquidsoap` (push buffer, startup reset), as designed.

Deviation (accepted): the full transitions module (all 5 functions) was written in
step 1 since it is one file; steps 2–3 connected call sites. Step-1's commit therefore
briefly carried not-yet-called exports — each commit still builds and tests green, and
per-step rollback holds.

The named transitions (`markPlayed`, `promoteNext`, `enqueue`, `enqueueBatch`,
`removeQueued`) are now in place as the emission points `bold-event-spine-publishers`
attaches to.

## Review (2026-06-13)
**Verdict**: Approve (deep lane, fresh-context sub-agent — not cross-model). No
blockers, no important findings.
**Behavior-preservation verified mechanically**: all three orchestrator diffs are
statement-for-statement cuts (same WHERE/set/orderBy, same insert values, same
guard/error, same log fields); the orchestrator test file is UNTOUCHED across all
three commits (call-count/shape assertions not loosened — the load-bearing evidence);
shared db-mock binding confirms "no mock relocation" is real. Grep: zero status-writes
/ inserts / deletes of playoutQueue remain in the orchestrator (the two surviving
update(playoutQueue) calls set only pushedToLiquidsoap — delivery bookkeeping). Suite
1567/1567 at HEAD.
**Nits** (advisory, accepted): (1) the single-writer structural test is a substring
tripwire (`set({ status:` exact spacing) not an AST check — catches the common
copy-paste regression, brittle to reformatting; (2) emission-point asymmetry for the
publishers lane — `markPlayed` returns void and `enqueueBatch` returns a count, while
`promoteNext`/`enqueue` return the affected row; publishers needing the played row's
channelId will pass the in-hand `playing` row at the call site or adjust the signature
→ noted on bold-event-spine-publishers below.
**Notes**: [refactor] tag integrity holds — nothing behavior-changing. No user-facing
surface, so no fix-verify loopback; advanced straight to done. Parent epic
bold-lifecycle-transitions stays at implementing (content-processing + stream-session
siblings still drafting). The 5 named transitions are the emission seams the publishers
feature attaches to.
