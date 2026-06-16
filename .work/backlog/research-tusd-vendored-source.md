---
id: research-tusd-vendored-source
tags: [research, content]
release_binding: null
research_origin: vendored-source-research-mode
created: 2026-06-16
---

# [research] Vendored-source acquire + orient: tusd (+ pin the image)

Apply vendored-source research mode to tusd (resumable upload server) — clone at a pinned version,
source-orient the `tusd-v2` tech-reference skill. **Engagement entry:**
`/agentic-research:research-orchestrator`.

## Acquire — and a finding to act on first
- **Pin:** we run `tusproject/tusd:latest` (docker-compose) — **UNPINNED** (currently resolves to
  `v2.9.2`). An unpinned `:latest` on a load-bearing upload path drifts on any pull and gives no
  exact version to clone-and-read against. The operational fix is tracked separately as the deploy
  story `pin-docker-compose-image-versions`; once tusd is pinned, clone github.com/tus/tusd at that
  tag for this source-orient pass. Go.

## Orient (source-grounded internals worth pinning)
- **Hook lifecycle** — pre-create / post-finish / post-terminate semantics and ordering; our hooks
  POST to `/api/tusd/hooks`. Source-confirm the exact hook contract + failure behavior (what happens
  to an upload if a hook 500s).
- **S3 backend behavior** — multipart assembly, the `.info` sidecar, partial-upload cleanup, how it
  interacts with Garage's S3 surface (cross-references the Garage item).
- The tus protocol conformance level tusd implements.

## Grounding
- No existing position (tusd selection is implicit). Companion skill: `uppy-tus-v5` (the client).
- Method: the **vendored-source research mode** (clone-at-pinned-version; source = `source-direct`
  tier, docs = portal tier; the two-pronged applicability gate). Carried in the
  `research_origin: vendored-source-research-mode` frontmatter; the orchestrator reads it at kickoff.

## Applicability check (the gate)
Source-available ✓ (OSS, Go). Behavior/version-internals load-bearing ✓ (hook contract +
S3-backend behavior on the upload path; the unpinned image makes version-precision *urgent*).
Passes — and the pin-the-image sub-action is the clearest "docs don't version-pin elegantly"
instance in our stack.
