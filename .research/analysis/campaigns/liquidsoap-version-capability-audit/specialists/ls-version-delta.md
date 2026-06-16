---
provenance: agent-synthesis
updated: 2026-06-16
campaign: liquidsoap-version-capability-audit
facet: ls-version-delta
---

# Liquidsoap version delta — what 2.4.3 / 2.4.4 / 2.4.5 change in OUR code paths

This facet verifies, **against the primary source** (the tag-pinned Liquidsoap tree, diffed
v2.4.2 → v2.4.3 → v2.4.4 → v2.4.5), which changes between our production version (2.4.2) and the
newest stable release (2.4.5) touch the code paths our playout render emits. Every load-bearing
claim is backed by a `git diff` at named tags, with file:line anchors in attestation
`[liquidsoap-src-version-delta]{1}`; changelog text is `[liquidsoap-changes-main]{2}`.

**Production version (verified):** `platform/liquidsoap/Dockerfile` line 1 is
`FROM savonet/liquidsoap:v2.4.2`. We are on 2.4.2 `[liquidsoap-src-version-delta]{1}`.

**Verdict labels:** "CONFIRMED IN SOURCE" = the code change was read in the diff at the named
tags. "CHANGELOG ONLY" = stated in CHANGES.md, not independently traced in code (none of the
load-bearing claims fall here — all were traced).

**Our code paths (from `apps/api/src/services/liquidsoap-render.ts` `[playout-render-seam]{3}`):**
per-channel `request.queue` + `request.queue.push.uri()` inside `harbor.http` POST handlers;
`source.skip()` inside `harbor.http` POST handlers; `fallback(track_sensitive=false, ...)` for
the broadcast chain; per-channel `output.url` (RTMP to SRS); `on_metadata(synchronous=false)`
callbacks; long-running (days) pipeline. The editorial design (lens: the editorial-engine
position) additionally anticipates ref-driven `switch()`, `source.dynamic` content swap, and
runtime clock attach/detach for channel CRUD.

---

## Claim-by-claim verification

### 1. `request.queue.remove` / `remove_request_id` (+ telnet `remove`) — added 2.4.5, absent 2.4.2 — CONFIRMED IN SOURCE

`git grep remove_request_id` returns 5 hits in `src/libs/request.liq` at v2.4.5 and **0 hits at
v2.4.2** `[liquidsoap-src-version-delta]{1}`. The v2.4.2→v2.4.5 diff adds `remove_request_id` and
`remove` as methods on the `request.queue` source record plus a telnet/server `remove <rid>`
command (#5237) `[liquidsoap-changes-main]{2}`.

**Relevance to us:** this is the **arm/take primitive** — pull a *specific* queued item by request
id without `skip()` (which only advances past the head) or flushing. Today our render emits only
`push.uri()` and `skip()` `[playout-render-seam]{3}`; selective removal of a queued item is **not
expressible on 2.4.2**. If the editorial design wants "un-arm a specific queued item" or "cancel
a scheduled spot already pushed," that needs the 2.4.5 upgrade (or a queue rebuild via
`set_queue`, which 2.4.2 *does* expose internally but the operator does not surface as a clean
method). Upgrade target.

### 2. `cross`/`crossfade` crash when `source.skip` is called off the clock thread — bug in 2.4.2, fixed 2.4.5 — CONFIRMED IN SOURCE (load-bearing)

The chain is verified end to end `[liquidsoap-src-version-delta]{1}`:
- `source.skip` (`v2.4.2:src/core/base/lang_source.ml`, `name="skip"`) calls `s#abort_track`
  **synchronously in the calling thread**. A `harbor.http` handler runs on a harbor/duppy thread,
  not the clock thread.
- v2.4.2 `cross.ml` `abort_track` runs `ignore self#prepare_before` inline → `prepare_source s =
  s#wake_up (...)` — it wakes/prepares buffer sources from the caller's thread. That cross-thread
  clock manipulation is the crash.
- v2.4.5 `cross.ml` defers: `abort_track` only does `Atomic.set pending_abort_track true`; the
  `prepare_before` work runs on `on_before_streaming_cycle` (the clock thread). The
  `pending_abort_track` / `on_before_streaming_cycle` lines appear **only in the v2.4.4→v2.4.5
  diff**, localizing the fix to 2.4.5 (#5194) `[liquidsoap-changes-main]{2}`.

**Relevance to us — this is the load-bearing one.** Our render emits `${vid}_source.skip()` and
`snc_tv` skips *from inside `harbor.http` POST handlers* `[playout-render-seam]{3}`. The crash
condition is "`source.skip` from a harbor handler **when a `cross`/`crossfade` operator is in the
source graph**."

- **Today's emitted graph does NOT contain `cross`/`crossfade`.** The channel source is
  `fallback(track_sensitive=false, [queue, mksafe(blank())])` and the broadcast is `fallback(...)`
  — no cross operator `[playout-render-seam]{3}`. So on 2.4.2, **skip-from-harbor is currently
  safe** because there is no cross operator to crash. The bug is latent, not active.
- **It becomes active the moment a crossfade is introduced.** If the editorial design adds
  `crossfade`/`cross` for smooth transitions (a natural "TV polish" want) AND keeps skip-from-harbor,
  the 2.4.2 crash is in scope. This couples "do we want crossfades on channels we can skip" to "must
  upgrade to 2.4.5." Flag for the design pass.
- **Disconfirming note (see Disconfirming analysis):** I did not reproduce the crash empirically —
  this is a code-read of the synchronous-call path, not a runtime repro on a cross graph.

### 3. `harbor.remove_http_handler` discarding all other handlers — bug in 2.4.2, fixed 2.4.5 — CONFIRMED IN SOURCE

v2.4.2 `harbor.ml` does `let handlers, removed = List.partition pred ...` then
`Atomic.set handler.http handlers` — but `List.partition` returns `(matching, non-matching)`, so
`handlers` is the *matched/removed* handler; v2.4.2 keeps only that one and drops all the rest.
v2.4.5 renames to `(removed, remaining)` and sets `remaining`. Localized to the v2.4.4→v2.4.5 diff
`[liquidsoap-src-version-delta]{1}`; changelog v2.4.5 `[liquidsoap-changes-main]{2}`.

**Relevance to us:** our render registers **many** `harbor.http` handlers (per-channel queue/skip/
nowPlaying, plus `/health` and `/admin/shutdown`) `[playout-render-seam]{3}`. We do **not** call
`harbor.remove_http_handler` anywhere in the current render. So on 2.4.2 this bug is **not
triggered today** (we never remove a handler). It becomes load-bearing only if channel CRUD is
implemented via *runtime handler removal* (remove a deleted channel's queue/skip/nowPlaying
handlers from a persistent process). On 2.4.2, removing one channel's handler would silently drop
every other channel's handlers — a correctness landmine for the runtime-attach/detach CRUD branch.
If CRUD goes the "regenerate-and-restart" route, this never fires. Directly informs the CRUD
mechanism fork the editorial-engine position left open.

### 4. Clock source detach while clock is running — bug in 2.4.2, fixed 2.4.3 — CONFIRMED IN SOURCE

v2.4.2 `clock.ml` `_detach` mutates the running clock's `outputs`/`active_sources`/`passive_sources`
queues **inline** when the clock state is `` `Started ``. v2.4.3 splits a `do_detach` helper and,
for a `` `Started `` clock, **defers** it onto the tick's `after_tick` queue so detach doesn't race
the running tick. Localized to v2.4.2→v2.4.3 (#5051) `[liquidsoap-src-version-delta]{1}`,
`[liquidsoap-changes-main]{2}`.

**Relevance to us:** the editorial-engine position's **CRUD-without-restart finding rests on
runtime `clock.detach`** (remove a channel output from a running clock). On 2.4.2, detaching a
source from a *running* clock takes the un-deferred inline path — the exact race the 2.4.3 fix
addresses. So **runtime channel removal (detach) on 2.4.2 is on the unfixed side of #5051.** If
the design adopts runtime attach/detach CRUD, 2.4.3+ is the floor for safe live detach;
regenerate-and-restart CRUD avoids it. This is the single most consequential delta for the
position's "softer CRUD boundary" claim — it confirms runtime detach is *more reliable* on 2.4.3+
than on our 2.4.2.

### 5. Sub-clock accumulation → gradual CPU growth — fixed 2.4.3, hardened 2.4.4 — CONFIRMED IN SOURCE

v2.4.3 replaces the push-only `create_sub_clock` with a `register_sub_clock`/`deregister_sub_clock`
pair (dedup guard + `filter_out` removal) and wires `deregister_sub_clock` into the `on_sleep`
callback of `child_support.ml` (the base for cross/crossfade/source.dynamic child clocks). The
verbatim code comment names **`source.dynamic`** as a motivating case (#5032). v2.4.4 hardens it:
`has_stopped` snapshots `sub_clocks` before sleeping outputs so an `on_sleep`-driven
deregistration can't skip stopping a sub-clock at teardown (#5103)
`[liquidsoap-src-version-delta]{1}`, `[liquidsoap-changes-main]{2}`.

**Relevance to us — long-running-pipeline stability.** Our pipeline runs for days
`[playout-render-seam]{3}`. Any operator with a child clock (`crossfade`, `cross`,
`source.dynamic`, ffmpeg filters) created/torn-down over the process lifetime accumulated stale
sub-clocks on 2.4.2, with per-tick scan cost growing without bound = "gradual CPU growth over
time." **Today's emitted graph has no child-clock operators** (`fallback` + `request.queue` +
`output.url` only) `[playout-render-seam]{3}`, so this leak is **not active on our current
2.4.2 graph**. It becomes active if the editorial design introduces `source.dynamic` (content
swap), `crossfade`, or repeatedly-recreated child-clock sources over a days-long process — exactly
the editorial primitives the position anticipates. For those, 2.4.3 (and 2.4.4 hardening) is the
stability floor.

### 6. `source.dynamic` maturity on 2.4.2 vs 2.4.5 — CONFIRMED IN SOURCE

`dyn_op.ml` (the `source.dynamic` core) is **effectively unchanged** v2.4.2→v2.4.5: NO CHANGE
across v2.4.2→v2.4.3 and v2.4.3→v2.4.4; one cosmetic insertion in v2.4.5 (`notify_sync_source`,
part of #5133, not a swap-contract change) `[liquidsoap-src-version-delta]{1}`. The
maturity-relevant fixes are:
- **Upstream of our baseline:** experiment flag removed in 2.3.0; source-leak fix #4835 in 2.4.2
  (i.e. *in* our version); re-use-cleanup fix #4713 in 2.4.1 `[liquidsoap-changes-main]{2}`. So the
  *operator itself* is already at its 2.3.0-stable, 2.4.1/2.4.2-leak-fixed state in production.
- **Not in `dyn_op.ml` but acting on source.dynamic's child clock:** the 2.4.3/2.4.4 sub-clock
  register/deregister work (Claim 5) — its comment explicitly names `source.dynamic`. So
  source.dynamic's *core* is mature on 2.4.2, but its *long-running child-clock hygiene* improves
  at 2.4.3+.

**Net:** `source.dynamic` is usable on 2.4.2 for content swap (core is stable + leak-fixed), but
for a days-long process that swaps repeatedly, the 2.4.3 sub-clock cleanup is the difference
between bounded and unbounded clock count. No *further* source.dynamic-specific fixes appear in
2.4.3/2.4.4/2.4.5 beyond the shared sub-clock work.

### 7. Other 2.4.3/2.4.4/2.4.5 changes touching our operators — scan results

Scanned the full v2.4.2→v2.4.5 src diff (46 changed core files) for switch/fallback/harbor/output/
clock/request.queue/encoder `[liquidsoap-src-version-delta]{1}`:

- **`switch.ml` — selection semantics UNCHANGED.** Only adds `notify_sync_source` calls (2.4.5,
  #5133) and an `Error.Invalid_value` arity `[]` (2.4.4). The per-frame predicate re-evaluation
  core is untouched — corroborates the editorial-engine position's ref-driven `switch()` mechanism
  is stable across the range. CONFIRMED IN SOURCE.
- **`output.ml` — start/stop refactor in 2.4.3** (`transition_to` → `execute_transition`) +
  telnet `status` command. This is the output-side of the 2.4.3 concurrent-stop/start fixes
  (#4849) `[liquidsoap-changes-main]{2}`. Relevant to runtime output attach/detach (CRUD)
  reliability, same direction as Claim 4. CONFIRMED IN SOURCE.
- **`harbor_input.ml` 403-on-taken-mountpoint (2.4.4, #5098)** — lands in `input.harbor`. We use
  `harbor.http.register` + `input.rtmp`, NOT `input.harbor` mountpoints
  `[playout-render-seam]{3}`, so this does **not** touch our paths. Recorded, NOT our concern.
- **2.4.5 optimizations** (clock sync-source O(1) #5133, format/kind O(1) dispatch #5136,
  `content_length`/timed-blit hot paths #5137, WeakQueue doubling #5118) — general performance,
  no API/behavior change to our paths; favorable for a long-running multi-channel process but not
  a correctness gate. CHANGELOG ONLY for the perf magnitude; the #5133 code touch is visible in
  switch.ml/dyn_op.ml `[liquidsoap-src-version-delta]{1}`.
- **`request.liq` category annotations** (`request.once`/`request.dynamic` recategorized to
  `Source / Input / Passive`) — cosmetic/doc only, no behavior change. CONFIRMED IN SOURCE.
- **No fallback-specific (`fallback.liq` / fallback transition) change** appears in the range — our
  broadcast `fallback(transitions=[...])` semantics are unchanged 2.4.2→2.4.5. (Their *firing
  correctness*, flagged as a spike-note in the render `[playout-render-seam]{3}`, is unaffected by
  version — it's a usage question, not a version delta.)

---

## Upgrade-relevance summary (2.4.2 → 2.4.5)

| Delta | Tag | Active on our CURRENT graph? | Becomes load-bearing when |
|---|---|---|---|
| `request.queue.remove`/`remove_request_id` | 2.4.5 (new capability) | n/a (capability, not bug) | editorial design needs selective queue-item removal (arm/take a specific item) |
| skip-from-harbor crashes cross/crossfade | fixed 2.4.5 | **No** — no cross operator emitted today | a `crossfade`/`cross` is added to a channel we also `skip()` |
| `harbor.remove_http_handler` drops other handlers | fixed 2.4.5 | **No** — we never remove handlers today | channel CRUD via runtime handler removal |
| clock detach-while-running race | fixed 2.4.3 | **No** — we don't detach at runtime today | channel CRUD via runtime `clock.detach` |
| sub-clock accumulation CPU growth | fixed 2.4.3 (+2.4.4) | **No** — no child-clock operator emitted today | `source.dynamic` / `crossfade` / recreated child-clock sources in the days-long process |
| `source.dynamic` core | stable since 2.3.0, leak-fixed 2.4.1/2.4.2 | usable on 2.4.2 | (already usable; child-clock hygiene improves at 2.4.3+) |

**The pattern:** every 2.4.3-2.4.5 *bug fix* relevant to us is currently **latent, not active** —
our present render emits a deliberately simple graph (`fallback` + `request.queue` + `output.url`,
no cross, no source.dynamic, no runtime detach, no handler removal) that sidesteps all of them.
**Every one of them activates exactly as the editorial design reaches for the richer primitives
the editorial-engine position anticipates** (live `switch()` is safe on 2.4.2; but content swap
via `source.dynamic`, crossfades, runtime channel CRUD, and selective queue removal each pull in a
2.4.3/2.4.5 fix). The upgrade decision is therefore **coupled to the editorial feature scope**,
not an independent maintenance choice.

## Disconfirming analysis

- **"Skip-from-harbor is safe on 2.4.2."** Sought disconfirming evidence: does the 2.4.2 source
  graph contain any cross operator that would trigger #5194? Read `liquidsoap-render.ts` in full
  `[playout-render-seam]{3}` — the channel source is `fallback(track_sensitive=false, [queue,
  mksafe(blank())])` and the broadcast is `fallback(...)`; no `cross`/`crossfade` is emitted. The
  skip-crash needs a cross operator in the graph, so the claim holds *for the current render*. But
  I did **not** runtime-reproduce the crash on a cross graph — the #5194 verdict is a code-read of
  the synchronous `abort_track` → `prepare_before` → `wake_up` path called off-thread, not an
  empirical repro. A spike that adds `crossfade` + skip-from-harbor on a throwaway 2.4.2 container
  would be the disconfirming test.
- **"`source.dynamic` is fine on 2.4.2."** The editorial-engine position records that the spike's
  initial `source.dynamic` crashes were *getter-contract mistakes, not engine limitations* (lens).
  That is consistent with my source finding (core stable on 2.4.2). The residual risk I cannot rule
  out from source alone: whether the 2.4.2 sub-clock accumulation produces *observable* CPU growth
  on a days-long process with frequent dynamic swaps, or whether the magnitude is negligible at our
  swap frequency. The changelog says "gradual CPU growth over time"; I have no measurement of the
  rate. Open question for human/spike, not resolvable from the diff.
- **"We never remove harbor handlers / never detach at runtime."** Verified by absence: no
  `remove_http_handler`, no `clock.detach`, no runtime topology mutation appears in
  `liquidsoap-render.ts` `[playout-render-seam]{3}`. The render regenerates the whole `.liq` and
  (per the file header) "regenerated on channel create/delete" — i.e. today's CRUD is
  regenerate-and-restart, which is precisely the branch that sidesteps Claims 3 and 4. So the
  "latent not active" framing is well-grounded for the *current* implementation.

## Contradictions

No source-vs-source contradictions surfaced. One **changelog-internal anomaly** (not a
contradiction between sources): CHANGES.md dates v2.4.3/v2.4.4 to "2024" while v2.4.2 is 2025-01-17
and v2.4.5 is 2026-06-15 — an upstream changelog date typo. Tag *ordering* (2.4.2 → 2.4.3 → 2.4.4
→ 2.4.5) is confirmed by the diff chain, so the typo does not affect any version-presence claim
`[liquidsoap-src-version-delta]{1}`.

Tension worth naming for the lead: the editorial-engine position (lens) states the CRUD boundary
is "softer than first stated" and that runtime attach/detach "IS supported" on the 2.4.2 tree it
dived. My source delta **qualifies** that: runtime *detach* specifically is on the *unfixed* side
of #5051 on 2.4.2 (the race fix landed 2.4.3). The position's claim that the *mechanism exists* in
2.4.2 is correct (clock.ml exposes attach/detach); my finding is that the *reliability* of runtime
detach improves materially at 2.4.3. These are compatible — "possible" vs "race-safe" — but the
design pass should not read the position's "supported" as "production-safe on 2.4.2."

## Revisit if

- The editorial design commits to runtime attach/detach CRUD (vs regenerate-and-restart) — then
  2.4.3 (#5051 + #5032) becomes a hard floor, not a latent improvement; re-rank the upgrade.
- A crossfade/cross operator is added to any channel that also receives `skip()` — then #5194
  (2.4.5) becomes a hard floor; spike the crash on 2.4.2 to confirm severity (was code-read only).
- `source.dynamic` content swap ships into the days-long process — measure sub-clock count / CPU
  over a multi-day run on 2.4.2 to quantify the #5032 leak rate (changelog says "gradual," no
  number); decide 2.4.3 floor on evidence.
- We adopt `request.queue.remove` for selective arm/take — confirm the 2.4.5 method signature
  hasn't shifted by the time we pin the upgrade (it is a stable-release API as of 2.4.5, but
  re-check at upgrade time).
- Liquidsoap ships 2.4.6+ or 2.5.0 stable — re-diff against the new tag; the
  `ls-2.5.0-capabilities` facet tracks the unreleased line separately.
