---
source_handle: liquidsoap-src-version-delta
source_class: github-readme
fetched: 2026-06-16
source_path: /workspaces/SNC/platform/.memory/scratchpad/liquidsoap-src (git clone of https://github.com/savonet/liquidsoap; tags v2.4.2..v2.4.5 fetched)
source_url: https://github.com/savonet/liquidsoap
provenance: source-direct
substrate_confidence: source-direct
tool: Liquidsoap source tree (cloned), tag-pinned diffs v2.4.2 → v2.4.3 → v2.4.4 → v2.4.5
version: tag-pinned; production = v2.4.2 (SHA 0922a76)
topic: source-level (file:line) verification of which 2.4.3/2.4.4/2.4.5 changes touch our code paths — request.queue.remove, cross abort_track from non-clock thread, harbor.remove_http_handler, clock detach-while-running, sub-clock accumulation, switch/output deltas
---

# Liquidsoap source tree — tag-pinned version delta (v2.4.2 → v2.4.5)

## Paraphrased summary

This attestation records the **source-level diff evidence** between Liquidsoap tags v2.4.2
(production) and v2.4.5, with each change pinned to the exact intermediate tag that introduced
it. It complements `liquidsoap-src-main` (which diffs v2.4.2 against `origin/main`/2.5.0) and
`liquidsoap-changes-main` (changelog text). Where those record capability names and the
2.5.0-unreleased shape, this records the *actual code change* at *each tagged release*, so a
claim of "fixed in 2.4.5, present in 2.4.2" is backed by the diff, not the changelog alone.

Tag SHAs (all four fetched into the clone):
- v2.4.2 = `0922a76d2f1707ff3f5a50efd3a0cd9d65944743` (production — `liquidsoap/Dockerfile` line 1: `FROM savonet/liquidsoap:v2.4.2`)
- v2.4.3 = `3689714f5054c621845a9397e946db3ad71eb050`
- v2.4.4 = `759af2d974bc196339a275fa41c7fbf4a5b238a3`
- v2.4.5 = `879d0f24316794e9fc7d230b6cadfff4020fd367`

Diffs reproduce with `git -C <clone> diff <tagA> <tagB> -- <file>`.

## Key passages with source-internal anchors

### A. `request.queue.remove` / `remove_request_id` — added in v2.4.5 (`src/libs/request.liq`)

`git diff v2.4.2 v2.4.5 -- src/libs/request.liq` adds, inside the `request.queue` definition:
```
+  def remove_request_id(rid) =
+    if started() then
+      queue := list.filter(fun (r) -> request.id(r) != rid, queue())
+      inner_q = s.queue()
+      filtered = list.filter(fun (r) -> request.id(r) != rid, inner_q)
+      if list.length(filtered) < list.length(inner_q) then s.set_queue(filtered) end
+    else
+      initial_queue := list.filter(fun (r) -> request.id(r) != rid, initial_queue())
+    end
+  end
+  def remove(r) = remove_request_id(request.id(r)) end
```
and surfaces both as methods on the returned source record (`remove_request_id=...`,
`remove=remove`), plus a telnet/server command:
```
+    s.register_command(description="Remove a request from the queue.",
+      usage="remove <rid>", "remove",
+      fun (rid) -> begin remove_request_id(int_of_string(rid)); "Done." end)
```
Presence check: `git grep -n remove_request_id v2.4.5 -- src/` → 5 hits in `src/libs/request.liq`.
`git grep -n remove_request_id v2.4.2 -- src/` → **0 hits (NOT present)**. Tag-localization:
the partition between v2.4.2 and v2.4.5 confirms it is absent at v2.4.2; the changelog dates it
to the v2.4.5 section (#5237).

### B. `cross`/`crossfade` crash when `source.skip` called off the clock thread — fixed in v2.4.5 (`src/core/base/operators/cross.ml`)

Chain: `source.skip` builtin (`v2.4.2:src/core/base/lang_source.ml`, `name = "skip"`) calls
`s#abort_track` **synchronously in the calling thread** — a `harbor.http` handler thread or a
`thread.run` thread, NOT the clock thread.

v2.4.2 `cross.ml` `abort_track` (the bug) runs clock-affecting work inline:
```
method abort_track =
  match status with
    | `Idle -> self#source#abort_track
    | `Before s | `After s ->
        self#source#abort_track;
        status <- `After s;
        ignore self#prepare_before     (* prepares/wakes buffer sources off-thread *)
```
`prepare_before` → `prepare_source s = s#wake_up (...)` (`v2.4.2:cross.ml:218,326`), i.e. it
wakes up buffer consumers from the caller's thread — the cross-thread clock manipulation that
crashes.

v2.4.5 `cross.ml` defers it onto the clock cycle via an atomic flag:
```
+    val pending_abort_track = Atomic.make false
+    initializer
+      self#on_before_streaming_cycle (fun () ->
+          if Atomic.exchange pending_abort_track false then (
+            match status with
+              | `Idle -> ()
+              | `Before _ | `After _ -> ignore self#prepare_before))
     method abort_track =
-      match status with
-        | `Idle -> self#source#abort_track
-        | `Before s | `After s -> self#source#abort_track; status <- `After s; ignore self#prepare_before
+      self#source#abort_track;
+      Atomic.set pending_abort_track true
```
Now `abort_track` only sets a flag; the `prepare_before` work runs on
`on_before_streaming_cycle` (the clock thread). Tag-localization: `git diff` per pair shows the
`pending_abort_track`/`on_before_streaming_cycle` lines appear **only in v2.4.4 → v2.4.5** (zero
changed lines in v2.4.2→v2.4.3 and v2.4.3→v2.4.4 for this region). Changelog: v2.4.5 "Fixed crash
in `crossfade`/`cross` when `source.skip` is called from outside the clock thread, e.g. from a
`harbor.http` handler or `thread.run` (#5194)."

### C. `harbor.remove_http_handler` discarding all other handlers — fixed in v2.4.5 (`src/core/base/harbor/harbor.ml`)

v2.4.2 (the bug) at the `remove_http_handler` `exec`:
```
let handlers, removed =
  List.partition (fun (v, u, _) -> v = verb && suri = ... u) (Atomic.get handler.http) in
...
Atomic.set handler.http handlers;     (* BUG: `handlers` is List.partition's FIRST element = the MATCHING (to-remove) set *)
```
`List.partition pred xs` returns `(satisfying, not_satisfying)`. The predicate matches the
handler being removed, so `handlers` is the *removed* handler and v2.4.2 keeps exactly that one,
dropping all others.

v2.4.5 fix renames and sets the complement:
```
-      let handlers, removed =
+      let removed, remaining =
         List.partition (...) (Atomic.get handler.http) in
-      Atomic.set handler.http handlers;
+      Atomic.set handler.http remaining;
```
Tag-localization: the `removed, remaining` / `Atomic.set handler.http remaining` lines appear
**only in v2.4.4 → v2.4.5**. Changelog: v2.4.5 "Fixed `harbor.remove_http_handler` discarding all
registered handlers except the one being removed."

### D. Clock source detach while clock is running — fixed in v2.4.3 (`src/core/base/clock.ml`)

v2.4.2 `_detach` mutates the running clock's queues inline when state is `` `Started ``:
```
match Atomic.get x.state with
  | `Stopped _ -> ()
  | `Stopping {outputs; active_sources; passive_sources}
  | `Started  {outputs; active_sources; passive_sources} ->
      Queue.filter_out outputs (fun (a,s') -> if s==s' then (s#sleep a; true) else false);
      WeakQueue.filter_out active_sources ...; WeakQueue.filter_out passive_sources ...
```
v2.4.3 splits out a `do_detach` and, for a `` `Started `` clock, **defers** it to the tick's
`after_tick` queue (so detach does not race the running tick):
```
+  let do_detach { outputs; active_sources; passive_sources } = ... in
   match Atomic.get x.state with
     | `Stopped _ -> ()
-    | `Stopping {...} | `Started {...} -> <inline mutation>
+    | `Stopping params -> do_detach params
+    | `Started params  -> Queue.push params.after_tick (fun () -> do_detach params)
```
Tag-localization: `git diff v2.4.2 v2.4.3 -- src/core/base/clock.ml` (20 ins / 17 del) carries
this; v2.4.3→v2.4.4 (5/1) and v2.4.4→v2.4.5 (97/59) do not touch this region the same way.
Changelog: v2.4.3 "Fixed clock source detach when clock is running (#5051)."

### E. Sub-clock accumulation → gradual CPU growth — fixed in v2.4.3, hardened in v2.4.4 (`clock.ml`, `child_support.ml`)

v2.4.3 replaces `create_sub_clock` (push-only, no removal) with a `register_sub_clock` /
`deregister_sub_clock` pair (`src/core/base/clock.ml`):
```
+let register_sub_clock parent sub =
+  let _sub = Unifier.deref sub in
+  let sub_clocks = (Unifier.deref parent).sub_clocks in
+  if not (Queue.exists sub_clocks (fun c -> Unifier.deref c == _sub)) then Queue.push sub_clocks sub
+let deregister_sub_clock parent sub =
+  Queue.filter_out (Unifier.deref parent).sub_clocks (fun c -> c == sub)
```
and wires deregistration into `child_support.ml` (the base class for cross/crossfade/source.dynamic
child clocks) so sub-clocks are removed when the source sleeps:
```
+      (* We need an early registration for sources such as source.dynamic. *)
+      Clock.register_sub_clock self#clock self#child_clock;
       self#on_wake_up (fun () ->
+          Clock.register_sub_clock self#clock self#child_clock;   (* idempotent *)
           ...);
       self#on_sleep (fun () ->
+          Clock.deregister_sub_clock self#clock self#child_clock;
           ...)
```
The verbatim comment names **`source.dynamic`** as a motivating case. Changelog: v2.4.3 "Fixed
sub-clock accumulation causing gradual CPU growth over time (#5032)."

v2.4.4 follow-up (`clock.ml`, `has_stopped`) snapshots sub_clocks before sleeping outputs so an
`on_sleep`-driven deregistration can't prevent a sub-clock from being stopped at teardown:
```
+  (* Snapshot sub_clocks before sleeping outputs: on_sleep callbacks may
+     deregister sub-clocks (e.g. ffmpeg filter graphs) ... *)
+  let sub_clocks = Queue.elements clock.sub_clocks in
   Queue.iter x.outputs (fun (a, o) -> try o#sleep a with _ -> ());
-  Queue.iter clock.sub_clocks stop;
+  List.iter stop sub_clocks;
```
Changelog: v2.4.4 "Fixed sub-clock leak when `on_sleep` deregisters a source during
`has_stopped` (#5103)."

### F. `source.dynamic` core (`dyn_op.ml`) — effectively unchanged v2.4.2 → v2.4.5

`git diff --stat` per pair: v2.4.2→v2.4.3 NO CHANGE, v2.4.3→v2.4.4 NO CHANGE, v2.4.4→v2.4.5 1
insertion. The single v2.4.5 insertion adds `self#notify_sync_source (snd self#self_sync)` on
source switch (part of the #5133 clock sync-source O(1) propagation optimization), not a
correctness change to the swap contract. The maturity-relevant `source.dynamic` fixes are
therefore upstream of our baseline (#4835 in 2.4.2, #4713 in 2.4.1) PLUS the 2.4.3/2.4.4
sub-clock fixes above (which act on source.dynamic's child clock via `child_support.ml`), not in
`dyn_op.ml` itself.

### G. `switch.ml` — predicate-selection semantics unchanged; only sync-source notify + error-arity

`git diff v2.4.2 v2.4.5 -- src/core/base/operators/switch.ml`: (i) `Error.Invalid_value` gains a
trailing `[]` argument (v2.4.4 — an internal signature change applied across many files); (ii)
`self#notify_sync_source (...)` added on `exchange_selected` and on deselect-to-None (v2.4.5,
#5133). The `satisfied`/predicate re-evaluation core (per-frame re-selection) is **not** changed.
This corroborates the editorial-engine position's reliance on per-frame ref-driven predicate
re-selection — that mechanism is stable across the range.

### H. `output.ml` — start/stop state machine refactor in v2.4.3 (`transition_to` → `execute_transition`)

`git diff v2.4.2 v2.4.3 -- src/core/base/outputs/output.ml`: the start/stop calls move from
`start_stop#transition_to` to `start_stop#execute_transition` for `` `Stopped ``/`` `Started
``/`` `Idle `` transitions, and a telnet `status` command is added. v2.4.3→v2.4.4 only adds the
`Invalid_value` `[]` arg; v2.4.4→v2.4.5 = 0 changed lines. This is the output-side counterpart of
the 2.4.3 "concurrent stop/start" / output.harbor start-stop fixes (changelog v2.4.3 #4849
"crash with concurrent stop/start"; v2.4.1 #4666 "start/stop logic in output.harbor") — relevant
to runtime output attach/detach (channel CRUD) reliability.

### I. `harbor_input.ml` 403-on-taken-mountpoint fix (v2.4.4) — NOT our path

Changelog v2.4.4 "Fixed `input.harbor` returning 'Unknown error' instead of a proper 403 when a
mountpoint is already taken (#5098)" lands in `harbor_input.ml`. We use `harbor.http.register`
(HTTP handlers) and `input.rtmp` for the broadcast ingest, not `input.harbor` mountpoints, so
this does not touch our code paths. Recorded for completeness.

## Structural metadata

- Primary evidence: tag-pinned `git diff` over the local clone; tag SHAs listed above.
- Files inspected (both endpoints + intermediate tags): `src/libs/request.liq`,
  `src/core/base/operators/cross.ml`, `src/core/base/lang_source.ml`,
  `src/core/base/harbor/harbor.ml`, `src/core/base/clock.ml`,
  `src/core/base/tools/child_support.ml`, `src/core/base/operators/dyn_op.ml`,
  `src/core/base/operators/switch.ml`, `src/core/base/outputs/output.ml`,
  `src/core/base/sources/harbor_input.ml`, `src/core/base/sources/request_dynamic.ml`.
- Production version pinned from `platform/liquidsoap/Dockerfile` (`FROM savonet/liquidsoap:v2.4.2`).
- Changelog date anomaly noted: the CHANGES.md headers date v2.4.3/v2.4.4 to "2024" while
  v2.4.2 is 2025-01-17 and v2.4.5 is 2026-06-15 — an upstream typo in the changelog dates, not a
  versioning inconsistency; the tag *ordering* (2.4.2 → 2.4.3 → 2.4.4 → 2.4.5) is what the diffs
  confirm.
