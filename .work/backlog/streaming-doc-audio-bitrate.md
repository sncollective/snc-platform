---
id: streaming-doc-audio-bitrate
tags: [documentation, streaming]
release_binding: null
created: 2026-06-18
---

# [docs] streaming.md states 128k audio; render emits 256k

`docs/streaming.md` (~line 104) says the encode is "2500k video, 128k audio", but the Liquidsoap
render emits `%audio(codec="aac", b="256k")` (`liquidsoap-render.ts`, the `enc` definition).

Pre-existing drift, surfaced by the `snctv-composition` feature deep review (nit-tier — filed so it
isn't lost since the doc section was just edited). One-character-ish fix: 128k → 256k.

Origin: `snctv-composition` feature deep review (2026-06-18), NIT finding.
