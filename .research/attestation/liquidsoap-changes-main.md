---
source_handle: liquidsoap-changes-main
fetched: 2026-06-16
source_path: /tmp/liq-spike/CHANGES-main.md
provenance: source-direct
substrate_confidence: source-direct
---

## Summary

The Liquidsoap upstream `CHANGES.md` from the cloned `main` tree (2920 lines, version headers
2.5.0-unreleased down to 0.3.8). Read 2026-06-16 to ground capability *names* and their
*version-of-introduction* for the backlog-feasibility map. NOTE: the dedicated LS facets
(`ls-version-delta`, `ls-2.5.0-capabilities`) own deep verification of these capabilities; this
attestation records only the changelog entry text + version boundary so the feasibility brief
can name capabilities and mark them pending-facet-verification. Production runs **2.4.2** (per
`docs/streaming.md` line 86 and the editorial-engine position).

## Key passages with version anchors

**2.5.0 (unreleased) — subtitles content-type (lines 8–11):**
"Added subtitles support as a dedicated content type. Includes native SRT decoding, FFmpeg
subtitle encoding/decoding (`%subtitle`), passthrough for bitmap subtitles (`%subtitle.copy`),
callbacks (`on_subtitle`), transformations (`subtitles.map`), and dynamic insertion
(`subtitles.insert`) (#4860, #4861, #4862)."

**2.5.0 (unreleased) — Icecast server + video dimension auto-detect (lines 12–18):**
"Video dimensions (`video.frame.width`/`height`) are now automatically detected from the first
decoded video file." "Added Icecast-compatible streaming server (`icecast.server`)..."

**2.5.0 (unreleased) — `source.content` / `track.format` introspection (line 6); video content
type renamed `canvas`→`yuv420p` (line 7, BREAKING for type annotations).**

**2.4.5 (2026-06-15) — request.queue removal (lines 57–58):**
"Added `remove` and `remove_request_id` methods to `request.queue` to remove a specific request
from the queue, also available as a telnet `remove` command (#5237)."

**2.4.2 (2025-01-17) — current production version (header line 147).**

**2.4.0 (2025-09-01) — cron thread (lines 243–244):**
"Added `cron.parse`, `cron.{add,remove}` and a cron thread to allow registration of cron-like
asynchronous tasks (#4579)."

**2.3.0 (2024-11-27) — `source.dynamic` stabilized (lines 466–467):**
"Reimplemented `request.once`, `single` and more using `source.dynamic`. Removed experiment flag
on `source.dynamic`. The operator is considered stable enough to define advanced sources." (So
`source.dynamic` has been non-experimental since 2.3.0, well before our 2.4.2.)

**2.x HLS lineage (multiple):** `output.hls` / native HLS streaming added 2.0.2 (line 1579,
#758); `input.{file,harbor}.hls` to read HLS streams added 2.0.2 (line 1578); video support in
`output.hls` added 2.0.2 (line 1253). fMP4 HLS audio+video fix in 2.4.x (line 43). These predate
2.4.2 — HLS output capability is present in production.

**switch/fallback time predicates:** `switch()` takes predicate getters re-evaluated against the
clock (confirmed in the editorial-engine spike position via `src/core/base/operators/switch.ml`).
The changelog does not show a dedicated "time-predicate" feature add — time-of-day switching is
expressed as a predicate `fun -> bool` reading the clock, a long-standing idiom, not a versioned
feature. (Verification of exact idiom owned by the LS facets.)

## Structural metadata

- Version of production: 2.4.2 (2025-01-17).
- Capability → introduced-in version: subtitles content-type → 2.5.0 (unreleased);
  `request.queue.remove` → 2.4.5; cron thread → 2.4.0; `source.dynamic` stable → 2.3.0;
  `output.hls` → 2.0.2.
- Newest stable tagged release in file: 2.4.5 (2026-06-15).

## Extension log

### 2026-06-16 — facet `ls-2.5.0-capabilities` (forward-looking, 2.5.0)

Additional changelog passages this facet attests to, verbatim from the "2.5.0 (unreleased)"
section (lines 1–62). All carry the unreleased caveat — the section header is literally
"2.5.0 (unreleased)" and the API is not final.

**Cross/crossfade unification — "Changed:" (lines ~33–37):**
"Simplified `cross`/`crossfade` implementation: replaced `start_duration` and `end_duration`
with a single unified `duration` parameter. Removed autocue-specific code and `assume_autocue`
setting. Metadata overrides `liq_cross_start_duration` and `liq_cross_end_duration` replaced by
`liq_cross_duration`. Methods `start_duration()` and `end_duration()` replaced by
`cross_duration()` (#4893)."

**`source.content` / `track.format` / `format.description` introspection — "New:" (line 6):**
"Added `source.content` operator returning an associative list of frame field names to their
content format, `track.format` returning the content format of a single track, and
`format.description` returning a typed record description of a content format."

**canvas→yuv420p rename — "New:" (line 7), BREAKING:**
"Renamed internal video content type from `canvas` to `yuv420p` to better reflect the actual
content. The video content remains organized as a canvas (superposition of `yuv420p` layers)
internally. Type annotations such as `source(video=canvas)` must be updated to
`source(video=yuv420p)`."

**video.frame auto-detection — "New:" (lines 13–15):**
"Video dimensions (`video.frame.width`/`height`) are now automatically detected from the first
decoded video file. This can be disabled by setting `settings.video.detect_dimensions` to
`false` or by explicitly setting the video dimensions."

**Icecast server — "New:" (lines 16–17):**
"Added Icecast-compatible streaming server (`icecast.server`) with support for source
authentication, mount points, relay, and per-listener encoding (#4915)." (The doc page marks
it Experimental — see the source-tree attestation `liquidsoap-src-main`.)

**source.dynamic fix trace across the version range (for the maturity-arc claim):**
- 2.4.2 (line 167): "Fixed sources leaks in `source.dynamic` (#4835)."
- 2.4.1 (lines 200–201): "Make sure that sources re-used in `source.dynamic` are never
  inadvertently cleaned up (#4713)."
- 2.3.0 (lines 466–467): "Removed experiment flag on `source.dynamic`. The operator is
  considered stable enough to define advanced sources but the user should be careful when using
  it."
- No `source.dynamic` entry appears in the 2.4.3, 2.4.4, 2.4.5, or 2.5.0-unreleased sections.

**Clock attach/detach fix trace (for the runtime-topology maturity claim):**
- 2.4.3 (line 124): "Fixed clock source detach when clock is running (#5051)."
- 2.4.3 (line 143): "Fixed sub-clock accumulation causing gradual CPU growth over time (#5032)."
- 2.4.4 (line ~/#5103): "Fixed sub-clock leak when `on_sleep` deregisters a source during
  `has_stopped` (#5103)."
- 2.4.5: "Clock sync-source propagation is now push-based and O(1) per tick instead of scanning
  all sources (#5133)" (Optimized section).

### 2026-06-16 — facet `ls-version-delta` (source-verified tag localization)

This facet diffed the cloned tree at tags v2.4.2/v2.4.3/v2.4.4/v2.4.5 and **confirmed in source
code** the changelog entries below, pinning each to the introducing tag (the diff evidence and
file:line anchors live in attestation `liquidsoap-src-version-delta`):

- **v2.4.5** (`src/libs/request.liq`): `request.queue.remove`/`remove_request_id` + telnet
  `remove` — added v2.4.5, absent v2.4.2 (#5237). CONFIRMED IN SOURCE.
- **v2.4.5** (`src/core/base/operators/cross.ml`): `source.skip`-from-non-clock-thread crash —
  `abort_track` deferred to `on_before_streaming_cycle` via an atomic flag; bug present v2.4.2,
  fixed v2.4.5 (#5194). CONFIRMED IN SOURCE. Load-bearing: we call `source.skip()` inside
  `harbor.http` handlers.
- **v2.4.5** (`src/core/base/harbor/harbor.ml`): `harbor.remove_http_handler` kept only the
  removed handler (`List.partition` first-element bug) v2.4.2, fixed to keep the complement
  v2.4.5. CONFIRMED IN SOURCE.
- **v2.4.3** (`src/core/base/clock.ml`): clock detach-while-running deferred to `after_tick`
  (#5051). CONFIRMED IN SOURCE.
- **v2.4.3** (`clock.ml` + `child_support.ml`): sub-clock accumulation fixed via
  register/deregister pair wired into `on_sleep`; the verbatim code comment names
  `source.dynamic` (#5032). CONFIRMED IN SOURCE. **v2.4.4** hardens it (#5103, `has_stopped`
  snapshots sub_clocks). CONFIRMED IN SOURCE.
- **v2.4.3** (`src/core/base/outputs/output.ml`): start/stop state machine moved
  `transition_to` → `execute_transition` (output-side of #4849 concurrent-stop/start). CONFIRMED
  IN SOURCE.
- `source.dynamic` core (`dyn_op.ml`) is effectively unchanged v2.4.2→v2.4.5 (one cosmetic
  notify_sync_source insertion in v2.4.5); its maturity fixes are upstream of 2.4.2 plus the
  2.4.3/2.4.4 sub-clock work above. CONFIRMED IN SOURCE.
- `switch.ml` predicate-selection core is unchanged across the range (only sync-source notify +
  error-arity). CONFIRMED IN SOURCE — corroborates the editorial-engine position's per-frame
  ref-driven re-selection reliance.

Changelog date anomaly: CHANGES.md dates v2.4.3/v2.4.4 to "2024" though v2.4.2 is 2025-01-17 and
v2.4.5 is 2026-06-15 — an upstream changelog typo; tag *ordering* is confirmed by the diffs.
