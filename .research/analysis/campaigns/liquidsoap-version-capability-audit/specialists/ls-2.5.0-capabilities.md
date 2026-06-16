---
facet: ls-2.5.0-capabilities
campaign: liquidsoap-version-capability-audit
provenance: agent-synthesis
updated: 2026-06-16
sources:
  - liquidsoap-src-main
  - liquidsoap-changes-main
---

# Liquidsoap 2.5.0 (unreleased) capabilities — forward-looking facet

**Scope of this facet:** what the unreleased 2.5.0 line brings that maps to our roadmap, and how
mature the editorial/CRUD primitives our rearchitecture rests on are. The substrate is the cloned
Liquidsoap source at `origin/main` (= the 2.5.0-unreleased line, HEAD `70c7557`, 2026-06-15)
[liquidsoap-src-main]{1} plus the full upstream changelog [liquidsoap-changes-main]{2}.

**Standing caveat on everything 2.5.0:** the changelog section is literally headed "2.5.0
(unreleased)" [liquidsoap-changes-main]{2}. No 2.5.0 tag exists in the clone (newest tag is
v2.4.5, 2026-06-15) [liquidsoap-changes-main]{2}. Every 2.5.0 capability below is **API-not-final
and not shippable to production yet** — production runs 2.4.2 (per the editorial-engine position
lens). Treat 2.5.0 features as "watch / pre-validate," not "available."

---

## 1. Subtitles as a dedicated content type → maps to two backlog items

2.5.0 adds subtitles as a **first-class frame field** alongside `audio`/`video`. The content type
`src/core/base/stream/subtitle_content.mli` carries `{start_time, end_time, text, format
([`Ass | `Text]), forced}` per entry, times relative to position [liquidsoap-src-main]{1}. The
script surface (verbatim from `doc/content/subtitles.md`) [liquidsoap-src-main]{1}:

- **Native SRT decode** in all builds: `let {subtitles} = source.tracks(single("subtitles.srt"))`.
- **`%subtitle` encode / `%subtitle.copy` passthrough** via FFmpeg. Encode codec is
  container-dependent: Matroska → `subrip`/`ass`, WebM → `webvtt`, MP4 → `mov_text`
  (`doc/content/ffmpeg_subtitles.md`) [liquidsoap-src-main]{1}.
- **`on_subtitle` callback** (record incl. `absolute_start_time`/`absolute_end_time` in seconds),
  **`subtitles.map`** (transform/filter/drop), **`subtitles.insert`** (returns a source with
  `insert_subtitle({duration, text, format, forced})`; auto-creates a subtitle track if absent)
  [liquidsoap-src-main]{1}.
- **Multiple subtitle tracks** in one source: `source({video, subtitles=english, subtitles_2=french})`
  [liquidsoap-src-main]{1}.

**Roadmap mapping (the two named backlog items):**

- **`streaming-auto-captions`** — Liquidsoap's subtitle support is *transport and lifecycle*, not
  *generation*. There is no ASR / speech-to-text in the engine; `subtitles.insert` takes
  caller-supplied text, `on_subtitle`/`subtitles.map` operate on subtitles that already exist
  [liquidsoap-src-main]{1}. So "auto-captions" still needs an external ASR producer; 2.5.0 gives
  us the **insertion seam** (`subtitles.insert` from a `thread.run`, fed by whatever produces the
  text) and the **passthrough/encode seam** to carry caption tracks an upstream produced. The
  generation half is out of engine scope — an open question for that backlog item, not solved by
  2.5.0.
- **`streaming-subtitle-delivery-player`** — delivery depends on our output container. Our
  production path pushes RTMP to SRS; subtitle *encoding* in 2.5.0 is FFmpeg-container-bound to
  Matroska/WebM/MP4/HLS-fMP4 codecs, with **no entry for RTMP/FLV in the documented codec table**
  [liquidsoap-src-main]{1}. Whether subtitles can ride our specific RTMP→SRS→player path is **not
  answerable from this facet** — it depends on (a) SRS's subtitle handling and (b) the player's
  caption support, neither of which is in the Liquidsoap source. Flagged as a cross-component
  acquisition candidate below.

**Maturity:** brand-new in an unreleased line. Test coverage exists in-tree
(`tests/streams/test_{on_subtitle,subtitles_insert,subtitles_map}.liq`, `tests/media/subtitle_*.liq`)
[liquidsoap-src-main]{1}, but no production hardening behind a release yet. Do not build a delivery
feature on it before 2.5.0 ships and our output-path compatibility is validated.

## 2. `icecast.server` — relevant to us? Mostly no.

2.5.0 adds `icecast.server`: Liquidsoap acting as an **Icecast-compatible ingest server** that
*accepts* source clients (butt, mixxx, …) pushing streams in [liquidsoap-src-main]{1}. It returns
a record with `mounts()`, `get_source(mount)`, `stats()`, `on_connect`/`on_disconnect`; default
port 8000, default password "hackme" [liquidsoap-src-main]{1}.

**Relevance to S/NC: low, and the feature is experimental.** The doc page carries an explicit
"## Experimental Feature" heading — "still experimental … some features may change in future
releases and some icecast configuration options are not yet supported" [liquidsoap-src-main]{1}.
Our architecture pushes **RTMP out to SRS**; `icecast.server` is an **inbound Icecast** path
(orthogonal protocol, orthogonal direction). It would only matter if we wanted to let third-party
Icecast source clients push *into* Liquidsoap (a contributor-ingest model we have not scoped). Not
a roadmap driver. **No action.** Watch only if a contributor-live-ingest use case ever surfaces —
and even then, the experimental label argues for waiting past 2.5.0.

## 3. Cross/crossfade unification — a behavior change IF we adopt crossfades

2.5.0 collapses the two-sided crossfade duration API into one. Source-confirmed by diffing
`cross.ml`: v2.4.2 has `~start_duration_getter` + `~end_duration_getter` + `~assume_autocue` +
`~override_max_start_duration` and `start_duration()`/`end_duration()` methods; origin/main has a
single `~duration_getter` and a single `cross_duration` method, with `assume_autocue` removed
[liquidsoap-src-main]{1}. The changelog states the metadata-override rename: `liq_cross_start_duration`
and `liq_cross_end_duration` → single `liq_cross_duration`; `assume_autocue` setting removed
[liquidsoap-changes-main]{2}.

**Relevance:** conditional. The editorial-engine spike found our switching needs are met by
ref-driven `switch()` (the lens) — crossfades are not currently load-bearing for the
rearchitecture. **If** a future feature adds crossfade transitions (e.g. smooth channel/segment
transitions), this is the API shape to target, and any 2.4.x crossfade script using
`start_duration`/`end_duration`/`liq_cross_start_duration` must be rewritten for 2.5.0. It is a
**migration watch item, not a blocker** — we have no crossfade code today to break.

## 4. Content introspection: `source.content` / `track.format` / `format.description`

2.5.0 makes a source's content typing **runtime-introspectable and JSON-serializable per field**.
`source.content(s)` returns an assoc list of `(field_name, format)`; `track.format(track)` gives
the format of one track; `format.description(fmt)` returns a typed record (e.g. `desc.pcm.{channels,
channel_layout}`, `desc.yuv420p.{width, height}`) [liquidsoap-src-main]{1} [liquidsoap-changes-main]{2}.
The in-tree test shows direct JSON output: `json.stringify(audio_fmt) == '{"pcm":{"channel_layout":"stereo","channels":2}}'`
[liquidsoap-src-main]{1}.

**Relevance to dynamic topology / per-channel content typing: genuinely useful, when 2.5.0 lands.**
Our rearchitecture has per-channel source chains whose content (audio-only vs audio+video,
dimensions) varies. Today the now-playing/now-airing introspection rests on `switch.selected()`
(the lens). `source.content` adds a complementary axis: a control/monitoring endpoint could report
*what each channel's pipeline is actually carrying* (field set + format) as structured JSON without
bespoke probing. It does not replace `switch.selected()` (which answers "which child is selected");
it answers "what is the content shape of the selected output." A **nice-to-have for the
status/observability surface**, not a primitive the core switching mechanism depends on. Pending
2.5.0 release.

## 5. video.frame auto-detection + canvas→yuv420p rename — forward-compat watch item

Two coupled 2.5.0 video changes:

- **Auto-detect video dimensions** from the first decoded video file, **default ON**
  (`conf_video_detect_dimensions ~d:true` in `frame_settings.ml`), disableable via
  `settings.video.detect_dimensions=false` or by setting dimensions explicitly [liquidsoap-src-main]{1}
  [liquidsoap-changes-main]{2}. Convenience, low risk.
- **BREAKING type-annotation rename:** the externally-visible video content-type string changes
  `canvas` → `yuv420p`. Source-confirmed: `content_video.ml` `let name` goes from `"canvas"`
  (v2.4.2) to `"yuv420p"` (origin/main); the internal OCaml variant stays `` `Canvas ``
  [liquidsoap-src-main]{1}. Script annotations `source(video=canvas)` must become
  `source(video=yuv420p)` [liquidsoap-changes-main]{2}.

**Flag as a forward-compat watch item.** Any of our `.liq` scripts (or generated scripts from
`liquidsoap-render.ts`) that carry a `source(video=canvas)` annotation will break on a 2.5.0
upgrade. **Action when 2.5.0 upgrade is scheduled:** grep our rendered/static `.liq` for
`video=canvas` and rewrite to `video=yuv420p`. No effect while we stay on 2.4.2. (This facet did
not audit our render output for `video=canvas` usage — that audit is the ls-version-delta facet's
or the upgrade story's job.)

## 6. Maturity arc of `source.dynamic` + runtime clock attach/detach

This is the load-bearing question: are the primitives our content-swap/CRUD finding rests on (the
lens: `source.dynamic` for live content swap; `clock` attach/detach for channel CRUD) still
actively churning, or stabilized?

**`source.dynamic` — stabilized well before our production version; quiet since.**
- Experiment flag **removed in 2.3.0** (2024-11-27): "considered stable enough to define advanced
  sources but the user should be careful when using it" [liquidsoap-changes-main]{2}.
- Last correctness fixes were **2.4.1** (sources re-used in `source.dynamic` not inadvertently
  cleaned up, #4713) and **2.4.2** (source leaks fixed, #4835) [liquidsoap-changes-main]{2} — i.e.
  the leak fixes landed *in our production version*.
- **No `source.dynamic` entry in 2.4.3, 2.4.4, 2.4.5, or 2.5.0-unreleased** [liquidsoap-changes-main]{2}.
  The only origin/main commit touching `dyn_op.ml` in the clone's reachable history is the
  2026-06-15 "Add some missing notify_sync_source" — a one-line addition of
  `self#notify_sync_source (snd self#self_sync)`, i.e. clock-sync-propagation plumbing (kin to the
  2.4.5 O(1) sync-source optimization), **not a behavioral fix to the swap contract**
  [liquidsoap-src-main]{1}.

  Read: `source.dynamic` is **stabilized**. The swap-getter contract our content-swap finding rests
  on is unchanged since 2.4.2; the only forward churn is sync-source plumbing that does not alter
  the getter semantics.

**Runtime clock attach/detach — actively hardened across 2.4.3–2.4.5, no contract change.**
- **2.4.3:** "Fixed clock source detach when clock is running (#5051)" + "Fixed sub-clock
  accumulation causing gradual CPU growth over time (#5032)" [liquidsoap-changes-main]{2}.
- **2.4.4:** "Fixed sub-clock leak when `on_sleep` deregisters a source during `has_stopped`
  (#5103)" [liquidsoap-changes-main]{2}.
- **2.4.5:** "Clock sync-source propagation is now push-based and O(1) per tick instead of scanning
  all sources (#5133)" [liquidsoap-changes-main]{2}.

  Read: the runtime attach/detach machinery our channel-CRUD finding rests on **was buggy at our
  production 2.4.2 and got materially hardened in 2.4.3 and 2.4.4** (detach-while-running and
  sub-clock-leak fixes are exactly the attach/detach path), then optimized in 2.4.5. These are
  *fixes and optimizations*, not API changes — the attach/detach contract is stable, but the
  **reliability improved after 2.4.2**. This is a concrete argument for upgrading 2.4.2 → 2.4.5
  (a *released, stable* version) before leaning hard on runtime channel CRUD, independent of
  anything 2.5.0.

**Bottom line for the rearchitecture's primitives:** content-swap (`source.dynamic`) is stabilized
and safe on 2.4.2. Channel-CRUD (clock attach/detach) is contract-stable but had real bugs on
2.4.2 that 2.4.3/2.4.4 fixed — favor a 2.4.5 upgrade before relying on live CRUD. Neither primitive
needs 2.5.0; 2.5.0 adds *introspection* polish (`source.content`) on top, not new switching power.

---

## Disconfirming analysis

- **"2.5.0 brings new switching/CRUD power we should wait for."** Searched the 2.5.0-unreleased
  changelog section and the origin/main `switch.ml`/`dyn_op.ml`/`clock` diffs against v2.4.2 for any
  new switching, dynamic-topology, or CRUD *capability*. Found none — the 2.5.0 switching-adjacent
  changes are (a) `source.content` introspection (read-only observability), (b) the one-line
  `notify_sync_source` plumbing in `dyn_op.ml` [liquidsoap-src-main]{1}. No new live-topology verb,
  no change to `switch()`/`source.dynamic` semantics. **Disconfirmed:** 2.5.0 does not strengthen
  the core mechanism; the rearchitecture should not wait for it.

- **"Subtitle support solves auto-captions."** Searched `subtitles.md`/`ffmpeg_subtitles.md` and the
  operator source for any ASR/speech-to-text/auto-generation surface. Found only insertion of
  caller-supplied text and transformation/passthrough of existing subtitles [liquidsoap-src-main]{1}.
  **Disconfirmed:** the generation half of auto-captions is out of engine scope; 2.5.0 gives the
  carriage/insertion seam only.

- **"The canvas→yuv420p rename is internal-only / harmless."** Checked whether the change is purely
  internal. The `content_video.ml` `string_of_kind`/`kind_of_string` are the *external* string
  parsers for type annotations, and they flip from `"canvas"` to `"yuv420p"` [liquidsoap-src-main]{1};
  the changelog explicitly says annotations "must be updated" [liquidsoap-changes-main]{2}.
  **Disconfirmed:** it is a real breaking change for any script with a `video=canvas` annotation.

- **"source.dynamic might still be unstable."** Sought the most recent churn. The only origin/main
  change is sync-source plumbing, and the experiment flag came off in 2.3.0 with the last
  correctness fixes in 2.4.1/2.4.2 [liquidsoap-changes-main]{2} [liquidsoap-src-main]{1}. The
  disconfirming evidence (a recent behavioral fix) does not exist in the reachable record.
  **Confirms** the stabilized reading. Caveat: the clone is shallow, so path-level `git log` is
  truncated — the version trace rests on the changelog, not on full commit history.

## Contradictions

None across my two sources — the changelog text and the source-tree implementation agree on every
checked capability (subtitles, icecast.server, cross unification, introspection, canvas rename,
auto-detect). One tension worth naming for the synthesis layer, not a contradiction: the changelog
*announces* `icecast.server` as a feature while the doc page *labels it experimental*
[liquidsoap-changes-main]{2} [liquidsoap-src-main]{1} — the maturity signal is finer-grained than the
changelog's flat "New:" list suggests. Generalize: a changelog "New:" line is not a maturity
warrant; check the doc/source for an experimental marker.

## Revisit if

- **2.5.0 actually ships a tag.** Re-verify every API shape here against the released version — this
  facet read an unreleased line whose API can change. Especially the subtitle insertion record and
  the `cross` `duration` argument.
- **We schedule a 2.4.2 → 2.4.5 (or → 2.5.0) upgrade.** Audit our rendered/static `.liq` for
  `source(video=canvas)` annotations and `liq_cross_start_duration`/`liq_cross_end_duration`
  metadata before the bump.
- **An auto-captions feature is scoped.** The ASR/generation producer is external; revisit whether
  `subtitles.insert` + `%subtitle` encode can carry the result over our RTMP→SRS→player path
  (cross-component, depends on SRS + player, not the Liquidsoap engine).
- **We decide to lean on runtime channel CRUD (clock attach/detach).** The 2.4.3/2.4.4 detach +
  sub-clock-leak fixes argue for upgrading off 2.4.2 first; re-read the clock changelog at the
  upgrade target.
- **A contributor-live-ingest (push-in) use case surfaces.** Re-evaluate `icecast.server` — but
  past its experimental label.

## Acquisition candidates

**Enriching (not blocking this facet's questions):**

1. **SRS subtitle/caption handling over RTMP/FLV → HLS/WebRTC.** Needed to answer whether 2.5.0's
   subtitle output can ride our RTMP→SRS→player path (claim 1 / `streaming-subtitle-delivery-player`).
   Out of the Liquidsoap source. Points at a fetched source naming it: the in-repo SRS reference
   `platform/.claude/skills/srs-v6/SKILL.md` (and SRS upstream docs) — fetch/read for caption
   support in our delivery chain.
2. **The player's caption/subtitle support (Vidstack).** The delivery-half of claim 1. Points at a
   fetched source naming it: `platform/.claude/skills/vidstack-v1/SKILL.md` — read for
   text-track/caption capability against our HLS/WebRTC output.

**Blocking:** none for this facet — all six claims were verifiable against the local source tree +
changelog already in hand.
