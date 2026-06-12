---
id: streaming-playout-ux-review-protocol
kind: story
stage: done
tags: [streaming, playout]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-06-12
updated: 2026-06-12
parent: streaming-playout-ux-review
---

# Audit protocol + environment prep

Implements Unit 1 of the parent feature's design (read the feature body first —
`## Implementation Units`).

Define the audit rubric (NN/g heuristics + 0–4 severity, WCAG 2.2 AA quick pass via the
scan-accessibility library, platform research nuggets from `docs/ux-decisions.md`), the
mandatory finding record format, and the per-surface journey scripts at both viewports.
Append all of it as `## Audit protocol` to the parent feature body. Prepare and verify
the capture environment: dev env healthy, playout seeded, live-takeover simulation run
once, Playwright screenshot capture proven at mobile + desktop viewports.

## Acceptance
- [x] `## Audit protocol` section in the feature body: rubric, record format, journey scripts (13 journey scripts across 3 audiences + state-inspection rule)
- [x] One journey walked end-to-end with screenshots at both viewports — V1 cold tune-in captured at 1440×900 and 375×812 (`.memory/scratchpad/streaming-playout-ux-review/protocol-proof-live-{desktop,mobile}.png`)
- [x] `test-live-fallback.sh` verified BOTH directions — Liquidsoap log evidence: `Switch to input.ffmpeg with transition` (takeover, 19:00:10) and `Switch to switch.1 with transition` (fall-back, 19:00:39)

## Implementation notes
- The dev environment was substantially broken on arrival and most of this stride was
  repair: the database was completely unmigrated (zero tables → every streaming
  endpoint 502'd), Garage was uninitialized (S3_ERRORs on first seed), and the
  playout→SRS chain was wedged in a publish-retry × rate-limiter deadlock with zombie
  SRS publisher sessions. Applied: `db:migrate` (43 tables), `db:seed-channels`,
  `init-garage.sh`, `seed:demo` (clean second run), `seed-playout-content.sh` +
  `generate-playout-playlist.sh`, Playwright browser install, and the staged
  stop-Liquidsoap → restart-SRS → 60s → start-Liquidsoap recovery.
- Files changed: feature body (`## Audit protocol` section), this story. No production
  code touched.
- Adjacent issues parked: `srs-callback-rate-limit-deadlock` (production-grade wedge:
  on_publish retry storm saturates the 30/60s limiter and SRS zombie sessions keep it
  wedged after the cause clears; full diagnosis + recovery in the backlog item).
- Known residual: the generated `playout.liq` carries a stale third channel
  (`channel-s-nc-music`) not present in the re-seeded DB — harmless (publishes succeed,
  no UI surface reads it) but noted in the backlog item as stale-config-drift evidence
  for the bold-channel-topology epic.
- Discrepancies from design: none — protocol shape matches the feature's Unit 1 spec.
- Commit pending: git metadata is not mounted in this container; commit
  `implement: streaming-playout-ux-review-protocol` from a full checkout.

## Review record
Verdict: Approve — story verified by implement; fast-lane advance (2026-06-12).
Deliverable spot-checked: `## Audit protocol` + 13 journey scripts present in the
feature body; both proof screenshots on disk; takeover/fall-back log evidence recorded
in-session. No code changed, so no build/test gate applies. `release_binding` left null
deliberately: binding deferred until the parent feature completes (binding a lone
mid-feature story would orphan it from its siblings' bundle).
