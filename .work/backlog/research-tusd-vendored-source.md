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
- **Pin:** we run `tusproject/tusd:latest` (docker-compose) — **UNPINNED.** This is itself a
  finding: an unpinned `:latest` on a load-bearing upload path means our behavior can drift on any
  pull, and there is no exact version to clone-and-read against. **Sub-action:** pin tusd to a
  specific version (a small deploy story), then clone github.com/tus/tusd at that tag. Go.

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
