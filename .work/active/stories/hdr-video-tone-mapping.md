---
id: hdr-video-tone-mapping
kind: story
stage: done
tags: [content, media-pipeline]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-04-18
updated: 2026-06-12
parent: null
---

# HDR Video Tone-Mapping

HDR video tone-mapping — ffprobe HDR detection (`color_transfer`), zscale tone-map filter chain in transcode pipeline, 1080p cap for HDR sources, HDR upload logging.

## Review (2026-06-12)

**Verdict**: Approve with comments

**Blockers**: none
**Important**: none
**Nits**: story body is a one-liner with no scope checklist, file references, or test
evidence (pre-conversion item); verification was reconstructed at review.

**Notes**: Fast lane with cheap verification. Verified at review: HDR detection +
tone-mapping code present in `apps/api/src/jobs/handlers/probe-codec.ts` and
`apps/api/src/services/media-processing.ts` (`color_transfer` probe, zscale/tonemap filter
chain); test coverage exists at `apps/api/tests/jobs/handlers/probe-codec.test.ts`; full
API unit suite 1501/1501 green in this review cycle.

**Hold — fix-verify loopback pending.** Behavioral confirmation is user-verifiable: upload
an HDR source (e.g. iPhone HLG clip), confirm transcoded output is tone-mapped (no washed-out
colors), capped at 1080p, and the HDR detection is visible in upload logs. Story stays at
`stage: review` until confirmed.

## Disposition (2026-06-13)
Advanced to done on the 2026-06-12 deep-review approval (code-level). No dev-station
surface — runtime verification (an actual HDR source through the transcode job) rides
the release `## Prod verification` walk if/when an HDR fixture is available. User call:
do not hold the review queue on a dev visual check this story can't receive.
