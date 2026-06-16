---
provenance: agent-synthesis
campaign: liquidsoap-version-capability-audit
updated: 2026-06-16
stage: evaluate
isolation: synthesis-output + seed only (no briefs / attestations / decomposition)
---

# Campaign evaluation (isolated-context gate)

The `evaluate` stage ran with structural isolation — only the parent synthesis + the engagement
seed, Read-only, no specialist briefs / attestations / decomposition rationale (the FR.1 fence).

**Verdict: APPROVED.**

## Per-component assessment

1. **Coverage — strong.** All three seed questions addressed (version delta + 2.5.0; upgrade
   recommendation with adversarial refutation + regression read; stack-wide SRS/ffmpeg gap audit
   mapped to backlog). The mixed-scope discovery (captions/subtitles correction) is explicitly
   surfaced as discovery, not silently absorbed. No unacknowledged omissions.
2. **Coherence — strong.** Single load-bearing frame ("latent today, activates when the editorial
   design reaches for the primitive") recurs consistently. Facet join-seams clean and visible.
3. **Contradictions — exemplary.** Dedicated section; both contradictions (DVR-as-rewind; "possible
   ≠ production-safe on 2.4.2") are substantive, named side-by-side, not resolved-by-paraphrase —
   including a self-qualifying contradiction against the commissioning spike position.
4. **Groundedness — strong.** Consistent source-bound citation posture; honest epistemic markers
   (#5194 flagged code-read-not-repro; open questions carried). Two spot-check candidates flagged
   (not revision demands): the density of issue/PR numbers, and the `canvas→yuv420p` rename
   attribution. The recommendation honestly attributes "upgrade now" to operator decision + verified
   evidence, not dressed as a pure finding.
5. **Recommendations — none required** (APPROVED). The two spot-check candidates were handed to the
   lead spot-check stage, which discharged them (see `## Spot-check` below).

## Spot-check (lead categorical pass, full substrate access)

The evaluator's two groundedness candidates, resolved against source:

- **Issue/PR number density** (#5194, #5051, #5032, #5103, #5237, #5133/#5136/#5137, #3267): each
  resolves to the changelog attestation `liquidsoap-changes-main` and/or the source-diff attestation
  `liquidsoap-src-version-delta`. The adversarial-read stage independently re-verified the
  load-bearing ones in source (request.queue.remove present v2.4.5 / absent v2.4.2; #5051 `do_detach`
  present v2.4.3 / absent v2.4.2; #5194 `pending_abort_track` v2.4.5-only; harbor fix v2.4.5-only).
  **One correction applied** from the adversarial pass (R1): the `harbor.remove_http_handler` fix was
  mislabeled #5237 in the parent's table — #5237 is `request.queue.remove`'s issue; the harbor fix
  carries no issue number. Corrected (number dropped).
- **`canvas`→`yuv420p` 2.5.0 rename** attributes to `[liquidsoap-src-main]{2}` (the origin/main
  source-direct attestation), where the `content_video.ml` `let name` flip was read — a
  chain-confirmation, source-grounded, not inference.

Also applied from the adversarial pass: R3 (softened a mild "cheapest unused latency win"
comparative-superlative to discipline-clean relative-anchor framing).

## Gate summary

| Gate | Outcome |
|---|---|
| lint (floor) | exit 0, no unresolved/colliding handles (one citation-target error caught + fixed: specialist-brief handles → source-direct attestation handles) |
| adversarial-read | APPROVED + 1 required fix (R1, applied) + 3 polish (R3 applied) — independently re-verified load-bearing claims in source |
| evaluate (isolated) | APPROVED, 2 spot-check candidates (discharged) |
| spot-check (lead) | clean after R1/R3 |

Full rigor discharged. The campaign output stands.
