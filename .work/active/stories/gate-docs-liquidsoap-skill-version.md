---
id: gate-docs-liquidsoap-skill-version
kind: story
stage: drafting
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
