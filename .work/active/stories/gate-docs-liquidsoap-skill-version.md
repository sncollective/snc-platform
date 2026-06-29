---
id: gate-docs-liquidsoap-skill-version
kind: story
stage: review
tags: [documentation]
parent: null
depends_on: []
release_binding: 0.4.0
gate_origin: docs
created: 2026-06-29
updated: 2026-06-29
---

# Liquidsoap skill still says production runs 2.4.2

## Severity
Medium

## Drift type
skill-stale

## Location
`.claude/skills/liquidsoap-v2/SKILL.md:14`; contradicting: `liquidsoap/Dockerfile:1`

## Evidence
The skill says "we run 2.4.2 (production container)" and frames 2.4.5 as upstream/latest/pending. The bundle pins `FROM savonet/liquidsoap:v2.4.5`.

## Remediation direction
Update the Liquidsoap skill and referenced caveats to state the current 2.4.5 baseline and preserve 2.4.2 notes only as historical/research context.

## Implementation (2026-06-29)
- Updated `.claude/skills/liquidsoap-v2/SKILL.md` to state the current production baseline is Liquidsoap 2.4.5, grounded in `liquidsoap/Dockerfile`.
- Kept 2.4.2 spike observations as historical/research context rather than describing them as the running container version.
- Updated the Dynamic Topology caveats in `.claude/skills/liquidsoap-v2/reference.md` so they describe the current 2.4.5 baseline while preserving the historical 2.4.2 risk notes.
- Verification: documentation-only change; checked `liquidsoap/Dockerfile:1` pins `savonet/liquidsoap:v2.4.5`.
