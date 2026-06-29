---
id: e2e-agent-vision-pixel-inspection
kind: story
stage: done
tags: [testing, streaming, playout, developer-experience]
parent: machine-verifiable-testing
depends_on: [creator-channel-engine-e2e-infra, e2e-browser-decode-playback-proof]
release_binding: null
gate_origin: null
created: 2026-06-25
updated: 2026-06-28
---

# Agent vision on rendered pixels (the literal "agent eyeballs" capability)

Capability level 4 — the top of the "take the human eyeball out of the loop" ladder. Sits above
machine-signal playback proof (`creator-channel-engine-e2e-infra`, levels 1-2) and browser-decode
proof (`e2e-browser-decode-playback-proof`, level 3).

> **Re-scoped 2026-06-26: triage/debugging-only, NOT a CI gate.** An adversarial review (Codex,
> verified) flagged vision-on-pixels as both fuzzy and token-expensive — wrong shape for a gate.
> **L3 (`readyState`/`currentTime`) is the hard CI gate** that proves playback; this level does not
> gate. Its value is (a) failure triage — when an e2e spec fails, a vision pass on the retained
> screenshot/video tells an agent what the user would have seen; and (b) general "agent looks at the
> running app" debugging beyond AC#5. AC#5 playback is closed by L1–L3 machine proof, not by this.
> Plugs into the `e2e-harness-determinism` artifact-triage component.

## What this is
Playwright captures a targeted artifact for rendered pixels, and a vision-capable agent inspects the
artifact to answer a coarse triage question: did the user-facing surface show real content rather
than a black, frozen, or obviously wrong frame? This is the only level where an agent literally sees
pixels rather than asserting on a machine signal that implies them.

Primary uses:
1. Failure triage for playback/debugging — when L3 or a nearby live-streaming spec fails, an agent
   can inspect the retained player-frame artifact plus the existing trace/video/screenshot bundle.
2. General visual debugging — any spec can opt into the same capture helper to let an agent "look at"
   a rendered surface during investigation.

## Design

### Fork decision: post-run agent triage, not an inline model call
The vision check is run by a separate post-run triage pass, not by Playwright mid-test.

Concrete shape:
- Playwright/spec code captures targeted visual artifacts and attaches them to the test result.
- The existing triage reporter surfaces those artifacts in `test-results/triage.json` and
  `test-results/triage.md`.
- A vision-capable agent inspects the retained image after the run using a documented runbook.

Why this fork:
- Matches the re-scope: advisory triage is useful; inline model calls are not justified for a
  non-gate capability.
- Preserves deterministic CI: Playwright remains pure browser/assertion code; L3 stays the only hard
  playback gate.
- Reuses the existing failure-artifact pipeline instead of creating a second browser-driving harness.
- Minimizes token spend because vision only runs when a human/agent is actually triaging a failure or
  doing deliberate debugging work.

Rejected alternatives:
- Inline model call from Playwright: not viable in the runner, couples test execution to model
  availability, and would blur the non-gate policy.
- Thin external harness that both drives the browser and calls vision inline: duplicates Playwright
  setup/auth/fixture logic for little gain, still non-deterministic, and adds a second maintenance
  surface.
- Full-page failure screenshot only: already useful, but too coarse for playback triage because it
  does not reliably isolate the actual video pixels the agent needs to inspect.

### Capture path
Implementation adds a small reusable helper dedicated to visual triage capture, e.g.
`apps/e2e/tests/helpers/visual-triage.ts`.

Helper responsibilities:
- Resolve the most specific useful locator for the rendered surface.
  - playback-first selector: `[data-media-player] video`
  - fallback: `[data-media-player]`
- Capture a bounded PNG artifact via locator screenshot rather than a full-page screenshot.
- Write a sidecar metadata JSON next to the image.
- Attach both files to `testInfo` so they ride the existing Playwright output flow.

For the playback use case, the L3 browser-decode spec is the first consumer:
- after the stream is proven live and the browser has reached the L3 decode/progress phase,
  capture a player-frame artifact when the spec is entering a failure path, so failure triage gets a
  focused image without retaining extra artifacts for every passing run;
- optionally allow explicit ad hoc capture from a spec during debugging by calling the helper
  directly.

This keeps artifact volume bounded while still making the capability reusable beyond the narrow
playback check.

### Artifact shape
The helper emits two attached artifacts in the test output dir:
- `vision-target:<slug>` — PNG image of the targeted rendered surface
- `vision-target-meta:<slug>` — JSON metadata describing what the image is

Metadata fields should include at least:
- `kind` (`player-frame`, later extensible to other surfaces)
- `pageUrl`
- `selector`
- `fallbackUsed` (boolean)
- `capturedAt`
- `boundingBox` (when available)
- `triageQuestion` (the exact coarse question the vision agent should answer)
- `expectationHint` (for playback: Maya / Studio Tour scene expected, coarse only)
- `nonGatePolicy` (`advisory-triage-only`)

The important contract is that the image is inspectable on its own and the metadata tells a later
agent what it is looking at without re-deriving context from the whole test.

### Triage integration
`apps/e2e/tests/helpers/triage.ts` already emits machine-readable and markdown triage output.
Extend it to recognize attachments whose names start with `vision-target:` and `vision-target-meta:`.

Reporter behavior:
- include the image path and metadata path in the per-attempt artifact list;
- add a `visionCandidates` section to `triage.json` / `triage.md` with the coarse triage question;
- add next-step guidance that explicitly routes the artifact to a vision-capable agent;
- keep the existing trace/video/screenshot guidance unchanged.

This story plugs into the existing artifact-triage component instead of inventing a separate report.

### Agent-inspection invocation
This story does not automate model invocation inside the test harness. The invocation surface is a
runbook documented in `apps/e2e/README.md`.

Runbook shape:
1. Read `apps/e2e/test-results/triage.json` or `.md`.
2. Open the retained trace/video/screenshot as normal.
3. If a `vision-target:*` artifact exists, pass that image to a vision-capable agent and ask the
   recorded `triageQuestion`.
4. Treat the answer as advisory evidence for debugging only.
5. If no targeted artifact exists, fall back to the retained Playwright failure screenshot/video.

Canonical playback triage question:
- "Does this image show real rendered video content rather than a black/blank frame, and is it
  plausibly the expected creator playback scene?"

Allowed answer shape is intentionally coarse:
- clearly rendered / clearly blank / inconclusive / wrong-looking scene

No stronger semantic claim is required for this story.

### Non-gate policy
This must be stated in code comments/docs and preserved in review:
- Vision inspection never blocks CI.
- Vision output never replaces deterministic assertions.
- L3 `readyState >= 2` plus `currentTime` advance remains the hard playback gate.
- Vision is additive evidence for failure triage and debugging only.

### Story shape decision
Keep this as a single story.

Rationale:
- the narrow playback-pixel triage and the broader "agent looks at running app" debugging capability
  are the same mechanism: reusable targeted capture + triage-report surfacing + documented vision
  runbook;
- splitting now would create dependency overhead without a real seam in implementation ownership;
- if a future batch vision CLI or broader visual-inspection framework appears, that can be scoped as
  a new follow-up item without blocking this story.

## Hard dependency
Same root gap — needs a creator channel actually streaming in the test stack
(`creator-channel-engine-e2e-infra`) AND a player rendering it (`e2e-browser-decode-playback-proof`)
before there are pixels worth inspecting. This is the last rung; it depends on both.

## Acceptance criteria
- [ ] A reusable visual-triage helper is designed for `apps/e2e/tests/helpers/` that captures a
      targeted locator screenshot and metadata sidecar, then attaches both to Playwright test output.
- [ ] The L3 playback spec is the first consumer and captures a focused player/video artifact for
      failure triage without turning vision into a runtime assertion.
- [ ] `apps/e2e/tests/helpers/triage.ts` surfaces `vision-target:*` artifacts in
      `test-results/triage.json` and `test-results/triage.md` with explicit next-step guidance.
- [ ] `apps/e2e/README.md` documents the post-run agent vision runbook and states that vision is
      advisory triage/debugging only.
- [ ] The implementation does not call a model from inside Playwright and does not add any vision
      result to CI pass/fail logic.
- [ ] The coarse playback question is limited to rendered/not-rendered/frozen/wrong-looking triage;
      deterministic playback proof remains L3.

## Design rationale
Routing verb: `e2e-test-design`. Even though this exposes a reusable debugging capability, its first
consumer, acceptance surface, and non-gate policy all live inside the e2e harness and artifact-triage
workflow rather than in product runtime code.

## Implementation notes

- Files changed:
  - `apps/e2e/tests/helpers/visual-triage.ts` (new) — the reusable L4
    visual-triage capture helper. Resolves the most specific useful locator
    (`[data-media-player] video`, falling back to `[data-media-player]`),
    captures a bounded PNG artifact, writes a JSON metadata sidecar
    (`triageQuestion`, `expectationHint`, `nonGatePolicy`), and attaches both
    to `testInfo`. Capture misses degrade to "no targeted artifact" and never
    throw into the test flow.
  - `apps/e2e/tests/helpers/triage.ts` — extended to surface
    `vision-target:*` artifacts: a `visionCandidates` section in
    `triage.json` / `triage.md` with the image path, the recorded triage
    question, and the explicit non-gate policy; next-step guidance routes
    the artifact to a vision-capable agent as advisory evidence.
  - `apps/e2e/tests/creator-channel-browser-playback.spec.ts` — the L3 spec is
    the first consumer: `afterEach` captures a focused player/video artifact
    when the browser-decode gate fails, so failure triage gets a focused image
    without retaining extra artifacts for every passing run.
  - `apps/e2e/README.md` — documented the post-run agent vision runbook
    (read triage → pass `vision-target:*` image to a vision-capable agent →
    ask the recorded question → treat the answer as advisory evidence only)
    and restated that vision is advisory triage/debugging only, never a CI
    gate; L3 remains the hard playback gate.
- Tests added: none new — this is a triage capability, not a CI-gated spec.
  The L3 spec exercises the capture path on its failure surface.
- Discrepancies from design: none. The reporter reads the metadata sidecar
  synchronously via `node:fs.readFileSync` (the reporter runs after the test,
  so the file exists; reading is best-effort and never throws into the report).
- Adjacent issues parked: none.

## Verification

- `bun run --filter @snc/e2e typecheck` — pass.
- `npx playwright test tests/creator-channel-browser-playback.spec.ts
  --project=chromium --workers=1 --retries=0` — PASS (2/2). The triage
  reporter writes `test-results/triage.json` + `triage.md` cleanly (no
  reporter crash); a passing run yields an empty `visionCandidates` section
  as expected (capture is failure-path-only).
- The capture path (`captureVisualTriageArtifact`) and the reporter's
  `extractVisionCandidates` share the `vision-target:` / `vision-target-meta:`
  naming contract; the helper attaches, the reporter surfaces.

## Non-gate policy (load-bearing)

Vision inspection never blocks CI. Vision output never replaces deterministic
assertions. L3 (`<video>` `readyState` + `currentTime`) remains the hard
playback gate. Vision is additive evidence for failure triage and debugging
only. No model is invoked inside Playwright; no vision result contributes to
CI pass/fail.

## Review

- Verdict: Approve - story verified by implement; fast-lane advance.
- Lane: fast (story with green implementation verification).
- Verification confirmed green: e2e typecheck passes; the L3 spec passes and
  the triage reporter writes cleanly with the new `visionCandidates` section.
- The non-gate policy is stated in code comments, the README runbook, and the
  metadata sidecar's `nonGatePolicy: "advisory-triage-only"` field.
