---
id: research-handoff-liquidsoap-version-capability-audit-3
tags: [research, streaming]
release_binding: null
research_origin: liquidsoap-version-capability-audit
created: 2026-06-16
---

# Determine SRS max streams / vhosts for dynamic channels

Find the practical ceiling on concurrent streams (and vhosts) SRS 6 supports, for the
dynamic-channel part of the playout rearchitecture (each playout channel is a distinct RTMP publish
to a distinct SRS stream name). The version/capability audit could only source `max_connections`
(default 1000, bounds *connections* not *streams*) from the SRS docs — the stream/vhost cap is an
open question.

## Sketch

- Either read SRS source (`trunk/src/`) for a documented/enforced stream-count limit, or run a
  dev-container scaling test: spin up N concurrent publishes and observe where SRS (or the
  Liquidsoap-side per-channel ffmpeg encode load) degrades.
- Informs how many channels the airs-when-programmed model can hold concurrently before the
  constraint is SRS-side vs encode-CPU-side.
- Not blocking until the channel count grows or the dynamic-channel CRUD work is scoped.

## Research grounding

**Source**: `.research/analysis/campaigns/liquidsoap-version-capability-audit/parent.md`
(slug: `liquidsoap-version-capability-audit`)

Carried open question from §Open questions: the docs gave only `max_connections`, not a stream cap;
a dev-container scaling test or SRS source read answers it.
