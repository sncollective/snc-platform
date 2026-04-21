---
tags: [testing, streaming]
release_binding: null
created: 2026-04-20
---

# Testing: S/NC TV broadcast channel not seeded in staging

Two failures — `live-streaming.spec.ts:4` on chromium + mobile. The spec expects `option /S\/NC TV/` in the live page channel selector. Staging has `S/NC Classics`, `S/NC Music` (user-created via admin channel CRUD test), and `Live: Maya Chen` — but not `S/NC TV`. `seed-channels.ts` declares the `S/NC TV` broadcast row but it was never run against staging (`seed-demo` does not seed channels).

Fix: run `bun run --filter @snc/api seed:channels` against staging so the broadcast channel exists, then confirm it surfaces in the channel selector. No release-board pairing needed — this is a narrow seed-ops gap.

Surfaced in the 2026-04-15 first real CI exercise (27/109 failures, typecheck-gap Phase D).
