---
title: SRS↔ffmpeg seam — capability audit for the playout rearchitecture
provenance: agent-synthesis
campaign: liquidsoap-version-capability-audit
facet: srs-ffmpeg-seam
scope_authority: mixed
updated: 2026-06-16
research_refs:
  - srs-v6-forward-doc
  - srs-v6-webrtc-doc
  - srs-v6-hls-doc
  - srs-v6-dvr-doc
  - srs-v6-http-callback-doc
  - srs-fullconf-source
  - srs-issue-3267-hwaccel
  - srs-github-codecs-changelog
---

# SRS↔ffmpeg seam — capability audit

We run **`ossrs/srs:6`** (confirmed in `docker-compose.yml`). This brief audits what SRS 6
gives us at the Liquidsoap↔SRS↔ffmpeg seam, against our rearchitecture and streaming backlog.
Throughout: **SRS-doc claims** carry `[handle]{N}` citations to attestations of the SRS v6
docs / source repo; **our-config facts** are read from `apps/api/src/services/liquidsoap-render.ts`,
`docs/streaming.md`, and the backlog items, and are labelled as ours. Web sources were fetched
via WebFetch, which returns model-summarized renderings — every SRS attestation carries
`substrate_confidence: search-summary` and flags claims not byte-verified. The in-repo
`srs-v6` skill reference is our own analytical artifact and is used as corroboration only, never
as a citation target (lens, not substrate).

A substrate caveat sets the ceiling on confidence: I did **not** run or inspect any live SRS
container (instructed not to). All SRS-side claims are documentation/source claims, not
observed behavior of our deployment.

---

## Q1 — SRS 6 capabilities relevant to our rearchitecture & backlog

### WebRTC (WHIP/WHEP) — backlog `streaming-low-latency-webrtc`

SRS 6 supports WebRTC ingest and playback through the standardized WHIP (ingest) and WHEP
(playback) HTTP signaling protocols [srs-v6-webrtc-doc]{1}. The endpoints sit on the HTTP API
port: WHIP at `…:1985/rtc/v1/whip/?app=live&stream=…`, WHEP at `…/rtc/v1/whep/?…`
[srs-v6-webrtc-doc]{1}. Crucially for us, **the same logical stream is addressable across RTMP,
HLS, HTTP-FLV, WHIP, and WHEP simultaneously** — one ingest feeds many output protocols
[srs-v6-webrtc-doc]{1}. SRS transmuxes RTMP↔RTC bidirectionally (`rtmp_to_rtc` / `rtc_to_rtmp`
toggles); the RTMP→RTC path requires **AAC→Opus audio transcode** because WebRTC uses Opus
while RTMP uses AAC [srs-v6-webrtc-doc]{1}[srs-fullconf-source]{6}.

**What we're not using:** our delivery path today is HLS-only at `/live` (per our
`docs/streaming.md`). WHEP playback is already enabled by the same SRS instance and the same
ingested stream — adding it is a config-on plus a player-side WHEP source, not a new ingest
path. The backlog item already notes Vidstack supports WHEP natively (our note, not an SRS
claim). The relative-anchor here: WebRTC is the lowest-latency tier SRS offers; HLS is the
highest-latency (see Q-latency below). I do not assert a specific millisecond figure — the SRS
v6 WebRTC page surfaced **no quantified latency number** [srs-v6-webrtc-doc]{1}; "sub-second"
is the backlog item's framing, not an SRS-doc claim.

Encoder seam note: WebRTC commonly avoids B-frames; SRS's `rtc` block defaults `keep_bframe
off` [srs-fullconf-source]{6}. Our encoder uses `preset="ultrafast"` (our config), which at
ultrafast emits no B-frames anyway, so our RTMP→RTC transmux would not be stressed on that axis.

### DVR / recording — backlog `streaming-srs-dvr-recording`, `streaming-dvr-rewind-live`

SRS 6 has native DVR: it records a published stream to FLV or MP4 (chosen by the `dvr_path`
extension), per-vhost, default-off [srs-v6-dvr-doc]{4}. `dvr_plan` controls finalization —
`session` writes one file per publish (closed on unpublish), `segment` splits by duration +
keyframe; `append` was removed in SRS3+ [srs-v6-dvr-doc]{4}. `dvr_path` supports stream
variables (`[app]`, `[stream]`, `[vhost]`) and time variables (`[timestamp]`, `[2006]`/`[01]`/
`[02]`/`[15]`/`[04]`/`[05]`/`[999]`) [srs-v6-dvr-doc]{4}[srs-fullconf-source]{6}. An `on_dvr`
HTTP callback fires when a DVR file is reaped, carrying the final file path
[srs-v6-dvr-doc]{4}[srs-v6-http-callback-doc]{5}. DVR is also toggleable at runtime via the
HTTP RAW API [srs-v6-dvr-doc]{4}.

**Mapping to the two backlog items:**
- `streaming-srs-dvr-recording` (record creator streams to FLV, triggered around `on_publish`)
  maps cleanly: enable `dvr` on the vhost, use `dvr_plan session`, and let `on_dvr` hand the
  finished file path to our existing remux→S3 pipeline. The callback infra it depends on
  already shipped (our note). No SRS capability gap.
- `streaming-dvr-rewind-live` (YouTube-style live rewind) is a **different** mechanism. SRS DVR
  writes server-side recording *files*; live-rewind/seek-back-in-time is a property of the
  *delivery* format's playlist window, not of DVR file recording. For HLS, the rewind window is
  bounded by `hls_window` (segments retained in the m3u8) [srs-v6-hls-doc]{3}. Calling this
  "enabled by SRS native DVR" (the backlog item's wording) conflates two features — I flag this
  as an open question for that item's design, not a settled claim (see Contradictions).

### Forward / simulcast mechanism — our current simulcast path

SRS forward relays a published stream to other RTMP servers; it runs in the `vhost` block with
two modes [srs-v6-forward-doc]{2}. **Static** `destination` accepts space-separated `{ip}:{port}`
pairs only (no full URL, app/stream inferred from the publish) [srs-v6-forward-doc]{2}. The
**dynamic `backend`** mode POSTs an `on_forward` JSON payload per-publish and the backend
returns **full RTMP URLs** in `{"code":0,"data":{"urls":[…]}}` — this is what permits routing
to arbitrary external platform stream-key paths (Twitch/YouTube) [srs-v6-forward-doc]{2}. The
doc states no cap on the number of forward destinations [srs-v6-forward-doc]{2}.

This is exactly our current architecture: `docs/streaming.md` describes `on_forward` querying
the `simulcast_destinations` table and returning active RTMP URLs (our config). So our
simulcast already uses the dynamic-backend mode — there is no unused SRS capability here, it is
load-bearing today.

### HLS low-latency — our `/live` delivery

SRS 6 converts the ingested stream to HLS per-vhost (`hls_fragment` default 10s, `hls_window`
default 60s → ~30s latency with defaults) [srs-v6-hls-doc]{3}. Latency tunes down by shrinking
fragment/window, but the doc is explicit that **SRS does not implement LL-HLS**, and tuned HLS
**won't drop below ~5s**; for sub-5s it points to HTTP-FLV, SRT, or WebRTC instead
[srs-v6-hls-doc]{3}. Our `srs-v6` skill already tunes fragment to 2s / window 10s (our config
hint), which is the floor HLS can reach.

**What we're not using:** if the product wants below the HLS floor, the options SRS already
offers on the same ingest are **HTTP-FLV** (one config flag, ~1-3s) and **WebRTC/WHEP**
(lowest). HTTP-FLV is the cheapest latency win we are not currently exploiting — it needs no
transcode and no new ingest, just a player that consumes FLV-over-HTTP. (Relative-anchor
framing; I do not assert exact latency numbers beyond the doc's "~30s default / ~5s HLS floor"
[srs-v6-hls-doc]{3}.)

### Multi-channel / vhost

SRS namespaces streams as `vhost / app / stream`; forward, HLS, DVR, http_hooks, and rtc are
all **per-vhost** blocks [srs-v6-forward-doc]{2}[srs-v6-hls-doc]{3}[srs-v6-dvr-doc]{4}. Stream
names within an app are arbitrary strings supplied at publish time (our `on_publish` already
keys off `stream`/`param`). I could not source a documented hard cap on the number of vhosts or
streams; `max_connections` (default 1000 in our skill's full-config) bounds concurrent
connections rather than stream count [srs-fullconf-source]{6}. This is an **open question** for
the dynamic-channels part of the rearchitecture (see Q2).

### Codec/protocol surface (SRS 6 headline)

SRS 6's README claims RTMP, WebRTC, HLS, HTTP-FLV, HTTP-TS, SRT, MPEG-DASH, GB28181, with codec
support for H.264, H.265, AV1, VP9, AAC, Opus, G.711 [srs-github-codecs-changelog]{8}. The v6.0
line added HEVC across more protocols (HEVC over SRT, H.265 for GB28181), an A/V-only WHEP
player, a WHIP→RTMP/HLS conversion fix, and SRT latency reduced to ~200ms in srt2rtc.conf
[srs-github-codecs-changelog]{8}. Per-protocol codec support varies — WebRTC's common path is
H.264 [srs-v6-webrtc-doc]{1}; H.265 is documented over RTMP/HTTP-FLV/SRT, not the WebRTC path
[srs-github-codecs-changelog]{8}. **SRT ingest** (~200-500ms, lower than RTMP's 1-3s per our
skill) is an unused capability if we ever want a lower-latency contribution path than RTMP.

---

## Q2 — The Liquidsoap↔SRS seam under the rearchitecture

**Today's push semantics (our config).** `liquidsoap-render.ts` emits, per channel,
`output.url(url="rtmp://#{srs_host}:#{t.srsRtmpPort}/live/<srsStreamName>?key=#{playout_key}", enc, …)`.
So Liquidsoap is an RTMP **publisher** to SRS, one publish per channel, stream key in the query
string. The S/NC TV broadcast block publishes under its own `snc_tv_stream` name. This is the
ordinary RTMP-publish path SRS authenticates via `on_publish` (key in `param`)
[srs-v6-http-callback-doc]{5} — our `docs/streaming.md` confirms the SHA256 key lookup is ours.

**The on_forward contract (corrected understanding).** Our `docs/streaming.md` narrates the
creator-takeover flow as: `on_publish` → validate → `on_forward` returns Liquidsoap's RTMP
input URL → SRS forwards the creator's stream to Liquidsoap. Reading the SRS forward doc, two
facts sharpen this:
1. `on_forward` (the `forward { backend … }` hook) fires **on publish to the vhost** and returns
   **full RTMP URLs** for SRS to push the stream to [srs-v6-forward-doc]{2}. It is a *separate*
   hook from the `http_hooks` `on_publish`/`on_unpublish` family — both POST similar JSON but
   are configured in different blocks [srs-v6-http-callback-doc]{5}[srs-v6-forward-doc]{2}.
2. Forward is **push-all on the vhost**: every published stream on a vhost with forward enabled
   gets the backend consulted. The backend returning an **empty `urls` array** is how a given
   stream opts out of forwarding (our skill reference documents this empty-array semantics).

**Does the rearchitecture stress this seam?** Two rearchitecture shapes to check:

- **Per-channel outputs.** Each playout channel is already a distinct Liquidsoap `output.url`
  publish to a distinct SRS stream name (our `renderChannelBlock`). Adding channels = adding
  RTMP publishes to SRS. SRS treats each as an independent stream under the vhost; no doc-stated
  per-stream-count limit was found, only `max_connections` bounding connections
  [srs-fullconf-source]{6}. The seam scales by adding publishes; the open risk is connection
  budget and per-stream CPU on the Liquidsoap side (each channel runs its own ffmpeg encode),
  not an SRS forward constraint.

- **Dynamic channels (create/delete at runtime).** Our channels render from a topology doc and
  regenerate `playout.liq`. On the SRS side, stream names are arbitrary publish-time strings, so
  a new channel's new stream name needs no SRS pre-registration [srs-v6-forward-doc]{2}. But two
  SRS-side seam constraints matter: (a) if forward/simulcast or per-channel HLS/DVR settings
  must differ **per channel**, those are per-vhost config in SRS — runtime changes need an SRS
  **config reload** (`http raw api … rpc=reload`, which our skill documents requires `raw_api`
  enabled). Our `docs/streaming.md` already relies on an SRS config reload when simulcast
  destinations change, so the reload path is in use. (b) Per-stream forward opt-out is handled
  by the `on_forward` backend returning `[]`, so dynamic channels that should NOT simulcast are
  handled at the callback, not config — no reload needed for that case
  [srs-v6-forward-doc]{2}.

**SRS-side constraint on number of streams / dynamic stream names: open.** I found no documented
hard cap on stream count or vhost count in the v6 docs I could fetch; `max_connections` bounds
connections, not streams [srs-fullconf-source]{6}. This is an open question that wants either an
SRS source-code read (`trunk/src/`) or an empirical test in the dev container — flagged in
`## Revisit if`. I deliberately do not assert "SRS supports N channels."

---

## Q3 — ffmpeg encoder surface for ABR / multi-rendition

**Where transcoding happens in our stack today (our config).** Exactly one re-encode: Liquidsoap
encodes each channel's source to a single FLV/H.264/AAC rendition and pushes it to SRS — the
`enc = %ffmpeg(format="flv", %video(codec="libx264", preset="ultrafast", b="2500k", g="60"),
%audio(codec="aac", b="256k"))` block in `liquidsoap-render.ts`. SRS then **forwards** that
single rendition; it does not re-encode. Per `docs/streaming.md`, "the API doesn't re-encode
video" and renditions (1080p/720p/480p) are picked **at M3U-generation time** — i.e. rendition
selection chooses *which source file Liquidsoap reads*, not multiple simultaneous output
bitrates. So our live path is **single-bitrate end-to-end**; multi-rendition exists only for
file selection, not adaptive output (this matches the `streaming-multi-rendition-playout-transcoding`
backlog item's "currently skipped" position).

**What multi-rendition / ABR would require — three architectural options:**

1. **SRS-side transcode.** SRS 6 has a `transcode` block that drives an external ffmpeg child
   process; multiple `engine` blocks under one `transcode` produce multiple outputs (the basis
   for an ABR ladder), with `output` as a templated RTMP URL (`[vhost]`/`[app]`/`[stream]`/
   `[engine]`) [srs-fullconf-source]{6}. This is the most "SRS-native" path: ingest one
   rendition, let SRS fan it into a 1080/720/480 ladder. Cost: each engine is a full ffmpeg
   encode (CPU-bound, server-side); transcode is default-off [srs-fullconf-source]{6}.
   **Hardware-encode caveat is load-bearing here — see Q4.**

2. **Liquidsoap multi-output.** Liquidsoap can emit multiple encoders from one source (multiple
   `output.url` blocks with different `%ffmpeg` bitrates). This keeps all encoding upstream of
   SRS where our encoder config already lives, at the cost of N× encode load in the Liquidsoap
   container. (Liquidsoap-side capability — out of my SRS-anchored scope to verify in depth;
   flagged for the liquidsoap-encoder facet.)

3. **imgproxy-style / offline-ladder.** Not applicable to live (imgproxy is image-only in our
   stack); for VOD/playout-from-S3, the ABR ladder could be pre-generated per file (the backlog
   item ties this to "serving HLS directly from S3, bypassing Liquidsoap"). This is the only
   option that avoids live transcode entirely, but it changes the delivery model.

I do not pick among these — that is the ABR design's job (`streaming-abr-transcoding-strategy`).
The SRS-grounded finding is narrow: **SRS *can* produce a multi-rendition ladder via its
transcode/engine blocks** [srs-fullconf-source]{6}, but doing so means server-side software
ffmpeg encodes unless hardware encode is wired externally (Q4).

---

## Q4 — ultrafast + 2500k single-bitrate: capability left on the table

**Our config (fact):** `preset="ultrafast"`, single `b="2500k"` video, `b="256k"` audio,
`g="60"` GOP, `libx264` (software) — one rendition, in the Liquidsoap container. `ultrafast` is
the fastest, lowest-efficiency x264 preset (worst quality-per-bit; chosen presumably to keep
per-channel CPU low). `2500k` is a single fixed bitrate (not CQP/CRF, not adaptive).

**VAAPI / hardware encoding — the load-bearing finding.** Our prior playout research set
hardware encoding as a requirement: the `streaming-abr-transcoding-strategy` backlog item names
"FFmpeg sidecar with **VAAPI** hardware encoding … Target hardware: Intel UHD 630 / i7-10700,
CQP mode" (our backlog). Against that requirement:

- **We are not using VAAPI today.** Our encoder is `libx264` (software) in Liquidsoap; SRS does
  not encode at all (it forwards). So no part of the live path currently uses the Intel iGPU.
- **SRS's transcode block is the wrong place to add VAAPI.** SRS issue #3267 reports that SRS's
  transcode restricts the encoder to `libx264` and that `h264_nvenc` errors; the issue is
  **Closed / Won't-fix** [srs-issue-3267-hwaccel]{7}. Corroborating, the SRS `full.conf`
  documents `vcodec` values as `libx264` / `copy` / `png` / `vn` only — **no hardware encoder
  in the documented value list** [srs-fullconf-source]{6}. So if ABR is done SRS-side (Q3
  option 1), it would be **software** x264, not VAAPI — directly at odds with the iGPU
  requirement.
- **The supported place for VAAPI is an external ffmpeg / the upstream encoder.** Issue #3267's
  own framing (and Won't-fix disposition) points hardware-accelerated encoding to an external
  ffmpeg process rather than SRS's transcode block [srs-issue-3267-hwaccel]{7}. In our stack
  that "external ffmpeg" is **Liquidsoap's `%ffmpeg` encoder** (or a dedicated ffmpeg sidecar,
  which is exactly what the backlog item proposes). Liquidsoap's ffmpeg encoder can in principle
  name `h264_vaapi` as the codec — confirming that is a liquidsoap-encoder-facet question, but
  the SRS-side conclusion is firm: **don't route ABR/VAAPI through SRS transcode.**

**Capability left on the table (relative-anchor, no composed estimate):**
- Hardware (VAAPI) encoding on the target Intel iGPU is unused — the requirement from prior
  research is unmet by the current `libx264`/ultrafast config (our backlog vs our config).
- `ultrafast` trades quality-per-bit for CPU; a hardware encoder (VAAPI CQP, per the backlog)
  would change that trade — better quality at the same or lower CPU. I do not quantify the gain.
- Single-bitrate means no adaptive delivery — viewers on poor connections get the one 2500k
  stream or nothing. ABR (Q3) is the remedy, and it should encode with VAAPI **outside SRS**.

---

## Disconfirming analysis

- **"SRS can't do hardware encode" — sought the counter.** Issue #3267 is **SRS-4-era** and
  scoped to SRS's *transcode block*, not ffmpeg generally [srs-issue-3267-hwaccel]{7}. It does
  not prove the SRS 6 transcode block rejects every non-libx264 `vcodec` in all builds — only
  that hardware accel via the transcode block was reported broken and Won't-fixed. I checked the
  SRS 6 `full.conf` for a newer hardware-codec value list; the documented `vcodec` values are
  still `libx264`/`copy`/`png`/`vn` with no hardware encoder enumerated [srs-fullconf-source]{6}.
  The robust, disconfirming-resistant reading: **do not depend on SRS transcode for VAAPI**;
  encode upstream. If a future SRS 6 build documents `h264_vaapi` as a `vcodec`, this flips —
  named in `## Revisit if`.

- **"WebRTC is sub-second" — did the SRS doc actually say a number?** No. The SRS v6 WebRTC page
  I fetched gave no quantified latency [srs-v6-webrtc-doc]{1}. "Sub-second" is our backlog
  item's framing. I therefore frame WebRTC only as SRS's lowest-latency tier *relative to* HLS
  (~5s floor) and HTTP-FLV (~1-3s), not as a sourced absolute.

- **"SRS DVR enables live rewind" — checked the mechanism.** DVR records server-side files
  [srs-v6-dvr-doc]{4}; live-rewind is a delivery-window property (`hls_window` for HLS)
  [srs-v6-hls-doc]{3}. The backlog item's claim that rewind is "enabled by SRS native DVR" is at
  least imprecise; I flag it rather than ratify it (see Contradictions).

- **WebFetch substrate limit.** All SRS web claims are from model-summarized fetches, not
  byte-exact pages (every attestation marks this; specific snippets flagged `[unverified-exact]`).
  The forward/callback/HLS contracts are independently corroborated by our in-repo `srs-v6` skill
  reference (our prior source-direct capture), which raises confidence on those specific shapes
  but is lens, not a citation target. The transcode `vcodec` list and the issue #3267 disposition
  are the claims I'd most want byte-verified before they harden into a position — noted below.

## Contradictions

- **DVR-as-rewind (backlog vs SRS docs).**
  - *`streaming-dvr-rewind-live` (our backlog) position:* live rewind is "enabled by SRS native
    DVR maintaining a rolling buffer."
  - *SRS-docs reading:* DVR is server-side file recording (FLV/MP4), finalized per
    `dvr_plan` [srs-v6-dvr-doc]{4}; the seekable live window for a player is a delivery-format
    property (HLS `hls_window`) [srs-v6-hls-doc]{3}, not a DVR feature.
  - Not resolved here. Both are stated side-by-side; resolving it is the rewind item's design
    job. Plausible reconciliation: rewind may be served from HLS window for the recent window
    and/or from a DVR/recording-backed VOD for longer rewind — but that is a design decision,
    not a sourced fact.

## Revisit if

- An SRS 6 build documents a hardware encoder (`h264_vaapi`/`h264_nvenc`/`h264_qsv`) as a valid
  `transcode` `vcodec` — flips the Q4 "don't route VAAPI through SRS" conclusion. Re-read
  `trunk/conf/full.conf` and the transcode doc at the then-current v6 patch.
- We need a hard answer on **max streams / vhosts** for dynamic channels — read `trunk/src/`
  (the SRS source) or run a dev-container scaling test; the docs I could fetch gave only
  `max_connections`.
- The byte-exact wording of the issue #3267 disposition or the `vcodec` value list becomes
  load-bearing for a design decision — re-fetch the raw pages with an authenticated/raw tool
  (raw.githubusercontent.com 500'd this session) to upgrade `search-summary` → `source-direct`.
- The product prioritizes latency below the HLS ~5s floor — re-audit HTTP-FLV (cheapest win) and
  WHEP against the then-current Vidstack support and our ingest.
- Liquidsoap-encoder facet confirms/denies `h264_vaapi` works in Liquidsoap's `%ffmpeg` encoder
  — that determines whether the VAAPI requirement is met upstream or needs a separate ffmpeg
  sidecar (the backlog item's framing).
