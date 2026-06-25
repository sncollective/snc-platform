---
id: e2e-agent-vision-pixel-inspection
created: 2026-06-25
updated: 2026-06-25
tags: [testing, streaming, playout, developer-experience]
---

# Agent vision on rendered pixels (the literal "agent eyeballs" capability)

Capability level 4 — the top of the "take the human eyeball out of the loop" ladder, and the one the
user explicitly wants ("agent eyeballs on the pixels … useful for testing and debugging"). Sits above
machine-signal playback proof (`creator-channel-engine-e2e-infra`, levels 1-2) and browser-decode
proof (`e2e-browser-decode-playback-proof`, level 3).

## What this is
Playwright screenshots the playing `<video>` frame (its bounding box), and a **vision-capable agent**
inspects the image to confirm real rendered content — non-black, non-frozen, plausibly the expected
scene. This is the only level where an agent *literally sees the pixels* rather than asserting on a
machine signal that implies them. Two distinct uses:
1. **AC#5 close-out** — retire the last manual playback eyeball: an agent confirms Maya's content is
   actually rendering, not just that a callback fired.
2. **General visual testing/debugging** — the durable win the user flagged: screenshot + vision-agent
   inspection of any rendered surface (playback, player chrome, layout regressions) gives an agent a
   way to "look at" the running app during debugging, not just read the DOM.

## Design questions to resolve (why this isn't a one-liner)
- **Who runs the vision check?** A Playwright test can't call a model mid-run. Options: (a) Playwright
  captures screenshots as artifacts, a separate agent step inspects them post-run; (b) a thin harness
  outside Playwright drives the browser + calls a vision model inline; (c) capture-and-assert-later
  via the existing `screenshot: "only-on-failure"` plus an agent triage pass. This is the real fork.
- **Determinism vs. signal.** A vision assertion is inherently fuzzier than `readyState`/`currentTime`.
  Likely use it as a *debugging/triage* capability and a *coarse* gate (not-black, has-motion), with
  the deterministic level-3 assertion as the hard CI gate. Decide what blocks CI vs. what's advisory.
- **What "expected" means.** Non-black is cheap; "is this the right scene" needs a reference or an
  OCR/scene description. Scope the strength at design.

## Hard dependency
Same root gap — needs a creator channel actually streaming in the test stack
(`creator-channel-engine-e2e-infra`) AND a player rendering it (`e2e-browser-decode-playback-proof`)
before there are pixels to screenshot. This is the **last** rung; it depends on both.

## Notes
Heaviest and least deterministic of the four levels; also the most broadly useful for
debugging beyond AC#5. Design as its own feature (likely `feature-design`, not just
`e2e-test-design` — the "agent inspects screenshots" harness is a capability, not only a test). The
broader screenshot+vision debugging tool may be worth splitting from the narrow AC#5 playback check.
