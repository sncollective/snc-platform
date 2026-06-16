---
source_handle: liquidsoap-src-main
source_class: github-readme
fetched: 2026-06-16
source_path: /workspaces/SNC/platform/.memory/scratchpad/liquidsoap-src (git origin/main @ 70c75575e56f771225a6ca7c42cb51be167d31e0, 2026-06-15)
source_url: https://github.com/savonet/liquidsoap
provenance: source-direct
substrate_confidence: source-direct
tool: Liquidsoap source tree (cloned), branch origin/main = the 2.5.0-unreleased line
version: origin/main @ 70c7557 (2026-06-15); compared against tag v2.4.2
topic: actual 2.5.0-unreleased implementations of subtitles, icecast.server, cross unification, content introspection, video auto-detect, source.dynamic
---

# Liquidsoap source tree — origin/main (2.5.0-unreleased line)

## Paraphrased summary

The cloned Liquidsoap source at `origin/main` is the development line that the changelog labels
"2.5.0 (unreleased)". HEAD is `70c7557` dated 2026-06-15. Tag `v2.4.2` (current production per
the editorial-engine position) is also present in the clone, enabling before/after diffs. This
attestation records the *actual source-level implementations* of the 2.5.0-unreleased
capabilities — distinct from the changelog text, which only names them. Everything here is from
the unreleased line: API shapes can still change before 2.5.0 ships.

## Key passages with source-internal anchors

### Subtitles as a dedicated content type

`src/core/base/stream/subtitle_content.mli` defines the content type:
```
type subtitle = {
  start_time : int;  end_time : int;  text : string;
  format : [ `Ass | `Text ];  forced : bool;
}
include Content_base.Content with type kind = [ `Subtitle ] and type params = unit
```
So subtitles are a first-class frame field alongside `audio`/`video`, format is ASS or plain
text, times stored relative to position (for concatenation).

`doc/content/subtitles.md` documents the script surface:
- Native SRT decode: `let {subtitles} = source.tracks(single("subtitles.srt"))` — "SubRip (.srt)
  files are natively supported by all builds of liquidsoap".
- `on_subtitle` / `track.on_subtitle` callbacks; record has `position`, `start_time`,
  `end_time`, `absolute_start_time`, `absolute_end_time`, `text`, `format`, `forced`.
- `subtitles.map` / `track.subtitles.map` — transform/filter (return updated fields, `{}` to
  keep, `null` to drop).
- `subtitles.insert` / `track.subtitles.insert` — returns a source with `insert_subtitle({duration, text, format, forced})`; "If the source doesn't have a subtitle track, `subtitles.insert` will create one."
- Multiple subtitle tracks: `source({video=video, subtitles=english, subtitles_2=french})`.

`doc/content/ffmpeg_subtitles.md`:
- `%subtitle` encoder. Codec support is container-dependent: Matroska → `subrip`/`ass`;
  WebM → `webvtt`; MP4 → `mov_text`.
- Decode from containers via `input.ffmpeg` — "supported only for text-based subtitle codecs
  (SubRip, ASS/SSA, WebVTT, MOV text). Bitmap-based subtitles (DVD, PGS, DVB) can only be copied."
- `%subtitle.copy` — passthrough, "the only way to handle bitmap-based subtitles ... also
  efficient for text-based subtitles when no modification is needed."

Operator source files present: `src/core/base/operators/{on_subtitle,map_subtitles,insert_subtitles}.ml`,
`src/core/base/stream/subtitle_content.{ml,mli}`. Test coverage present:
`tests/streams/test_{on_subtitle,subtitles_insert,subtitles_map,subtitles_track_insert}.liq`,
`tests/media/subtitle_*.liq`.

### `icecast.server` — Icecast-compatible source server

`doc/content/icecast_server.md` opening: "Liquidsoap can act as an icecast-compatible server,
accepting source client connections using the `icecast.server` operator. This allows you to
receive streams from software like butt, mixxx, or any other icecast-compatible source client."

**Explicitly experimental** — verbatim heading "## Experimental Feature": "This functionality is
still experimental. While it works for many common use cases, some features may change in future
releases and some icecast configuration options are not yet supported."

It is an *ingest* server (accepts source clients pushing in), returns a record with `mounts()`,
`get_source(mount)`, `get_config(mount)`, `stats()`, `on_connect`, `on_disconnect`. Default port
8000, default password "hackme". Source files: `src/libs/extra/icecast_server.liq`,
`src/core/base/outputs/icecast2.ml`. (This is server-side Icecast; orthogonal to outbound RTMP.)

### Cross / crossfade unification

`src/core/base/operators/cross.ml` on origin/main:
```
class cross val_source ~override_duration ~duration_getter ~persist_override ...
  method cross_duration = Frame.seconds_of_main main_duration
  method reset_duration = duration_getter <- original_duration_getter; ...
```
Compared against `v2.4.2:src/core/base/operators/cross.ml`:
```
class cross val_source ~end_duration_getter ~override_end_duration
  ~override_duration ~start_duration_getter ~override_start_duration
  ~override_max_start_duration ~persist_override ~rms_width ~assume_autocue ...
  method end_duration = ...   method start_duration = ...
```
Confirms the unification: the v2.4.2 split `start_duration_getter`/`end_duration_getter` +
`assume_autocue` + `max_start_duration` collapse into a single `duration_getter` and a
`cross_duration` method on origin/main. `src/libs/fades.liq` (origin/main) exposes the builtin
with `%argsof(cross[id,duration,override_duration,persist_override,width])` — single `duration`
arg.

### Content introspection: `source.content` / `track.format` / `format.description`

`src/core/builtins/builtins_source.ml` (origin/main) — `source.content` folds the source's
`content_type` into a list of `(field_name, format)` pairs:
```
"... Use `format.description` to introspect a format value."
[("", Lang.source_t (Lang.univ_t ()), None, None)]
(Lang.list_t (Lang.product_t Lang.string_t Content.Format_val.t))
... Frame.Fields.fold (fun field fmt acc -> ... s#content_type ...)
```

`tests/language/source_content.liq` shows the script-level shape (verbatim excerpts):
```
audio_content = source.content(sine())          # [("audio", fmt)]
desc = format.description(fmt)                   # desc.pcm.{channels, channel_layout}
s = (noise() : source(audio=pcm, video=yuv420p))
av_content = source.content(s)                   # assoc list audio+video
video_desc = format.description(list.assoc("video", av_content))
                                                 # video_desc.yuv420p.{width, height}
let {audio, video} = source.tracks(s)
track.format(audio)                              # same fmt as source.content
json.stringify(compact=true, audio_fmt)
  == '{"pcm":{"channel_layout":"stereo","channels":2}}'
```
So content typing is now runtime-introspectable and JSON-serializable per field.

### Video content type rename canvas→yuv420p (BREAKING for type annotations)

`origin/main:src/core/base/stream/content_video.ml`:
```
let name = "yuv420p"
let string_of_kind = function `Canvas -> "yuv420p"
let kind_of_string = function "yuv420p" -> Some `Canvas | _ -> None
```
`v2.4.2:src/core/base/stream/content_video.ml`:
```
let name = "canvas"
let string_of_kind = function `Canvas -> "canvas"
let kind_of_string = function "canvas" -> Some `Canvas | _ -> None
```
Confirms the breaking rename of the externally-visible content-type *string* (`canvas` →
`yuv420p`); the internal OCaml variant stays `` `Canvas ``. Script type annotations
`source(video=canvas)` must become `source(video=yuv420p)`.

### Video dimension auto-detection

`origin/main:src/core/base/stream/frame_settings.ml`:
```
let conf_video_detect_dimensions =
  Conf.bool ~p:(conf_video#plug "detect_dimensions")
    ~d:true "Automatically detect video dimensions"
    ~comments:["When enabled, video dimensions are set from the first decoded video file."; ...]
... log#important "Auto-detected video dimensions: %dx%d (source: %s)."
```
Default ON (`~d:true`). The setting key on the config tree is `video.detect_dimensions`
(changelog gives the script path `settings.video.detect_dimensions`).

### source.dynamic implementation on origin/main

`src/core/base/operators/dyn_op.ml` (origin/main) — `class dyn ~init ~track_sensitive
~infallible ~self_sync ~merge next_fn`, `inherit Source.generate_from_multiple_sources`,
`method prepare s = Typing.(...); Clock.unify ~pos:self#pos s#clock self#clock; s#wake_up ...`,
`val current_source = Atomic.make None`. The only commit touching this file in the clone's
reachable history is `70c7557` ("Add some missing notify_sync_source", 2026-06-15) — it adds
`self#notify_sync_source (snd self#self_sync)` at line 62. NOTE: the clone is shallow, so
git-log path history is truncated; the per-version *fix trace* is taken from the changelog
(attestation `liquidsoap-changes-main`, extension log), not from `git log` here.

## Structural metadata

- Branch: `origin/main` = the line the changelog labels "2.5.0 (unreleased)". HEAD `70c7557`,
  2026-06-15. API not final.
- Diff baseline: tag `v2.4.2` (production).
- Files inspected: subtitle_content.{ml,mli}, on_subtitle.ml, doc/content/{subtitles,ffmpeg_subtitles,icecast_server}.md,
  cross.ml (both versions), builtins_source.ml, tests/language/source_content.liq,
  content_video.ml (both versions), frame_settings.ml, dyn_op.ml, icecast_server.liq.
- Clone is shallow: use the changelog for cross-version fix-trace history, the tree for
  current-implementation shape.
