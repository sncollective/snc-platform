---
id: stack-library-gap-audit
kind: feature
stage: done
tags: [research, content, streaming]
parent: null
depends_on: []
release_binding: null
gate_origin: null
research_origin: vendored-source-research-mode
research_refs: [stack-library-gap-audit]
created: 2026-06-18
updated: 2026-06-18
research_dials:
  scope_authority: mixed
  verification_rigor: full
  intent: inform-decision
  output_kind: [gap-audit-brief]
---

# [research] Stack-library gap audit: where our code misunderstands or over-engineers (tusd / SRS / Hono)

## Brief

Applies the **Liquidsoap version-capability-audit pattern** — source-confirmed library behavior
cross-checked against *our actual codebase* — to find where we have **misunderstood** a library's
behavior (our code assumes something the source contradicts) or **over-engineered** around it
(defensive scaffolding / abstraction the library already handles). Also audits each library's
tech-reference skill for drift against source. Companion to the per-library vendored-source orient
items; this one is codebase-facing, not skill-facing-only.

Triggered by the pg-boss orient (which already corrected one misunderstanding — a heartbeat
anti-pattern claim — and surfaced the auto-migrate-on-start hazard). This audit ranges the same
lens across the next-highest-signal subset.

**Engagement entry:** `/agentic-research:research-orchestrator`. `[research]` — grounds decisions,
does not bind to a release; verification gates run inline.

## Scope (this pass — highest-signal subset)

Three libraries, chosen for likelihood of harboring misunderstanding/over-engineering against our
code. Garage + imgproxy deferred (lower-urgency per their own backlog items; trigger if a specific
behavior bites).

### tusd (resumable upload server) — pin resolve: `:latest` → **v2.9.2**
- **Acquire:** `tusproject/tusd:latest` is UNPINNED (image label resolves v2.9.2; upstream is now
  v2.10.0 — we drift one minor behind on a load-bearing upload path). Clone github.com/tus/tusd at
  the resolved tag.
- **Our code:** `apps/api/src/routes/tusd-hooks.routes.ts` (the hook receiver), `app.ts` (wiring),
  `apps/web/src/contexts/upload-context.tsx` (the uppy-tus client). Skill: `tusd-v2`.
- **Audit targets:** hook lifecycle + ordering (pre-create / post-finish / post-terminate) and the
  failure contract (what happens to an upload if our hook 500s) — do we handle it as source says?
  S3-backend multipart assembly + `.info` sidecar + partial cleanup vs how we expect Garage's S3
  surface to behave. Any over-built hook handling we don't need.

### SRS (streaming server) — pin resolve: `:6` → resolve actual `v6.x` from container/image
- **Acquire:** `ossrs/srs:6` is major-only (image labels only the Ubuntu base; resolve the actual
  SRS v6.x by querying the running container's API or the image git SHA). Clone github.com/ossrs/srs
  at that tag.
- **Our code:** `apps/api/src/middleware/verify-srs-callback.ts`, `services/stream-lifecycle.ts`,
  `services/streaming-connect.ts`, `services/stream-keys.ts`, `routes/streaming.routes.ts`,
  `config.ts`, and `srs.conf`. Skill: `srs-v6`. Position: `srs-streaming-server.md`.
- **Audit targets:** the open questions the Liquidsoap audit could not close from docs (max
  streams/vhosts for dynamic channels; `on_forward` vs `http_hooks` lifecycle; the transcode
  `vcodec` set). The callback contract (`on_publish`/`on_unpublish`) — does `verify-srs-callback`
  + `stream-lifecycle` match the source-confirmed callback semantics, or did we misread them?
  Over-built callback/secret handling vs what SRS actually guarantees.

### Hono (API framework) — pin: `^4.12.8` (confirm lockfile resolution)
- **Acquire:** clone github.com/honojs/hono at the locked tag. The API-reference skill the user
  flagged.
- **Our code:** the 41 `*.routes.ts` under `apps/api/src/routes/` + the service layer. Skill:
  `hono-v4`. Positions: `api-source-of-truth.md` + `route-handler-ceremony.md` (both currently
  "status quo / neutral / deferred" — prime candidates for over-engineering review).
- **Audit targets:** the **explicit 6-step route-handler ceremony** and the **hand-written
  three-layer pattern** — are these carrying weight Hono's own primitives (factory, middleware,
  `hono-openapi` validator, RPC types) would carry for free? Where does our ceremony duplicate what
  the framework does? Where does the `hono-v4` skill drift from the v4.12.8 source/API?

## Dials (set at scoping, 2026-06-18)
- **scope_authority: mixed** — the per-library audit targets above are fixed must-answer
  deliverables (full rigor); each specialist may additionally discover and pursue unenumerated
  misunderstanding/over-engineering as the source × our-code surface reveals it (the gap audit is
  discovery-shaped — value is partly in gaps we didn't enumerate). Same shape as the Liquidsoap audit.
- **verification_rigor: full** — every "our code misunderstands X" / "X is over-built" claim
  verified against the cloned source with file:line evidence on BOTH sides (library source + our
  code), then adversarially refuted.
- **intent: inform-decision** — grounds future fix/simplify decisions. Not a shippable deliverable.
- **output_kind: gap-audit-brief** — a `.research/analysis/briefs/` landscape scoring per-library
  findings (misunderstanding / over-engineering / skill-drift / confirmed-correct) with severity +
  dual-sided evidence. No code changes, no work items in this engagement — operator triages via a
  later `research-handoff`.

## Decomposition (Checkpoint A)
Three parallel specialist facets, one per library (independent source trees + independent code
surfaces → no facet coupling; by-library is the natural cut). Lead synthesizes the cross-library
brief (common patterns: where docs-tier understanding misled us; the unpinned-image class of risk).
1. **`tusd-gap`** — tusd v2.9.2 source × our upload-hook + client code.
2. **`srs-gap`** — SRS v6.x source × our streaming callback/lifecycle code + srs.conf.
3. **`hono-gap`** — Hono v4.12.8 source × our route/service layer + the two API positions.

## Output destination
`.research/analysis/briefs/stack-library-gap-audit-landscape.md` + per-source attestations under
`.research/attestation/`. On completion, operator-confirmed `research-handoff` may emit fix/simplify
`.work/` items carrying `research_origin: stack-library-gap-audit`.

## Engagement record (closed 2026-06-18)

Closed via `/agentic-research:research-orchestrator`. Dials honored (scope_authority mixed,
verification_rigor full, intent inform-decision, output_kind gap-audit-brief).

- **Fan-out:** 3 parallel research-specialists, one per library. Each cloned its source at the
  pinned version, wrote a source-direct attestation, cross-checked our code with file:line evidence
  on both sides.
  - tusd **v2.9.2** (`@1215a10`) → `tusd-src-2-9-2` attestation
  - SRS **v6.0.48** (`@1d878c2`) → `srs-src-v6` attestation (running container is v6.0.184; no
    such tag — cloned nearest stable, behaviors stable across v6 minor line, line numbers .48-relative)
  - Hono **v4.12.12** (`@c37ba26`) → `hono-src-4-12-8` attestation
- **Verification:** lint clean on all three attestations + the brief (0 broken/thin/unresolved;
  version-number flags are correct pinned facts). Adversarial-read (opus) returned **NEEDS-REVISION**
  and did real work: it **empirically refuted** the hono "required casts" finding by stripping all
  `as never` casts from two route files and re-running `tsc` (passed) — flipping it from
  misunderstanding to removable cruft. Four other findings reworded for precision. Corrected the
  hono attestation's observation 4 toward the verified substrate. Re-verified clean. Spot-check ✓.
- **Output:** `.research/analysis/briefs/stack-library-gap-audit-landscape.md` (scored, dual-sided).
- **Net result:** our code understands these libraries well — no behavioral misunderstanding
  survived verification. Yield: 1 unpinned image (tusd `:latest`, high), 3 skill-drift corrections
  (srs on_forward rejects-publish [high], tusd post-finish fire-and-forget [med], srs on_unpublish
  swallows-errors [med]), and 1 vestigial-cast cleanup (hono, low). Closed the Liquidsoap audit's
  open SRS questions (no max_streams/vhosts cap; on_forward/http_hooks lifecycle; vcodec passthrough).
- **Deferred:** garage, imgproxy (lower-urgency per their backlog items).
