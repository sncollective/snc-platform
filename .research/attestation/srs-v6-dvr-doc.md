---
source_handle: srs-v6-dvr-doc
source_class: tool-doc
fetched: 2026-06-16
source_url: https://ossrs.net/lts/en-us/docs/v6/doc/dvr
provenance: source-direct
substrate_confidence: search-summary
tool: SRS v6 — DVR (recording) documentation
version: v6
topic: DVR recording config, dvr_plan options, filename variables, on_dvr callback, runtime control
---

# SRS v6 — DVR (recording) documentation

Engagement note: WebFetch summary. Config + variables cross-confirmed by the SRS full.conf
reference (`srs-fullconf-source` attestation) and the in-repo `srs-v6` skill.

## Paraphrased summary

DVR records a published stream to a file (FLV or MP4, chosen by `dvr_path` extension). It runs
per-vhost, default off. `dvr_apply` selects which streams record (`all` or a named list).
`dvr_plan` controls file finalization: `session` (one file per publish, closed on unpublish)
or `segment` (split by duration + keyframe). `append` was removed in SRS3+. `dvr_path`
supports stream variables (`[vhost]`, `[app]`, `[stream]`) and time variables (`[2006]` year,
`[01]` month, `[02]` day, `[15]` hour, `[04]` min, `[05]` sec, `[999]` ms, `[timestamp]`
Unix-ms). An `on_dvr` HTTP callback fires when a DVR file is reaped (includes the final file
path). DVR can also be toggled at runtime via the HTTP RAW API.

## Key passages

- **Config block:**
  ```
  vhost yourvhost {
      dvr {
          enabled on;
          dvr_apply all;
          dvr_plan session;
          dvr_path ./objs/nginx/html/[app]/[stream].[timestamp].flv;
          dvr_duration 30;
          dvr_wait_keyframe on;
          time_jitter full;
      }
  }
  ```
- **dvr_plan options:** `session` (close on unpublish) | `segment` (split by duration +
  keyframe). "append is removed in SRS3+". `[unverified-exact]`
- **Output format:** FLV or MP4 by `dvr_path` extension.
- **on_dvr callback:** enabled via `http_hooks { on_dvr <url>; }`; fires "when srs reap a dvr
  file"; payload includes `file` and `cwd`. `[unverified-exact]`
- **Runtime control:** "can use http raw api to control when to dvr specified stream" — DVR is
  toggleable at runtime via the RAW API. `[unverified-exact]`

## Structural metadata

- Page under `/docs/v6/`. DVR writes server-side files (a recording surface), distinct from
  HLS segments. on_dvr is one of the http_hooks family alongside on_publish/on_unpublish/on_hls.
