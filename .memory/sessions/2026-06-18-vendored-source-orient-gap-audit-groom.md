# Session: vendored-source orient + stack gap audit + backlog groom (2026-06-18)

Three linked arcs, all on `platform` `main`: a vendored-source orient of pg-boss, a codebase gap
audit across tusd/SRS/Hono, and a full backlog grooming sweep. Plus reconciliation of the original
vendored-source campaign against what the audit produced.

## 1. pg-boss vendored-source orient

Picked up `research-pg-boss-vendored-source` from the backlog → scoped to a `[research]` feature →
ran it through `agentic-research:research-orchestrator` (vendored-source mode, full rigor).

- Cloned pg-boss at the lockfile-pinned tag **12.15.0** (DB schema version 30, decoupled from npm
  version). Light path — one ~6.4k-LOC TS tree, authored inline.
- Source-oriented the `pg-boss-v12` skill with a "Source-confirmed internals" section: SKIP LOCKED
  fetch + state-based visibility (no lease), the two timeout sweeps + client-side abort +
  failWip-on-shutdown, the `failJobs` retry/backoff/dead-letter SQL, the poll loop + four-layer
  concurrency, partition model + **auto-migrate-on-`boss.start()`**.
- **Corrected** a wrong pre-existing skill claim: the heartbeat anti-pattern said sub-monitor
  heartbeat "provides no benefit" — source shows detection is floored by the maintenance-sweep
  cadence, not `heartbeatSeconds`.
- **Operative finding:** a pg-boss dependency bump silently runs a PostgreSQL schema migration on
  next start against the shared app DB — review a bump like a DB migration.
- Verification (full): lint clean, adversarial-read APPROVED (13/13 source claims), isolated
  evaluate APPROVED, spot-check. Attestation: `pg-boss-src-12-15-0`.

## 2. Stack-library gap audit (tusd / SRS / Hono)

Applied the Liquidsoap-audit pattern — source-confirmed behavior × *our code* — to the
highest-signal subset (garage/imgproxy deferred). 3 parallel specialists, each cloning at the
pinned version + cross-checking our code, then adversarial verification.

- Sources: tusd **v2.9.2**, SRS **v6.0.48** (running container is v6.0.184 — no such git tag; line
  numbers are .48-relative, behaviors stable across the v6 minor line), Hono **v4.12.12**.
- **Headline: no behavioral misunderstanding survived verification.** The one specialist
  "misunderstanding" finding (hono required-casts) was **empirically refuted** by the adversarial
  reader running `tsc` after stripping the casts — flipped to "vestigial cruft."
- Yield: 1 unpinned image (tusd), 3 skill-drift corrections (srs on_forward, tusd post-finish, srs
  on_unpublish), 1 cast-cleanup. Closed the Liquidsoap audit's open SRS questions (no
  max_streams/vhosts cap; on_forward vs http_hooks lifecycle; vcodec passthrough).
- Output: `.research/analysis/briefs/stack-library-gap-audit-landscape.md` + 3 attestations.

### Fixes landed directly (high-value)
- Pinned `tusproject/tusd:latest` → `:v2.9.2` in docker-compose.
- Corrected `srs-v6` reference.md: `on_forward` returning `code:1` rejects the **entire publish**
  (not "skips forwarding"). Our prod code already returns `code:0`, so this prevents a future
  mistake, not a live bug.

### Handed off to backlog (3 items, `research_origin: stack-library-gap-audit`)
- `research-handoff-stack-library-gap-audit-1` [prose]: tusd post-finish fire-and-forget skill fix
- `research-handoff-stack-library-gap-audit-2` [prose]: srs on_unpublish swallow gotcha
- `research-handoff-stack-library-gap-audit-3` [refactor]: remove ~122 vestigial `as never` casts
  + correct the `route-handler-ceremony` position's premise

## 3. Vendored-source campaign reconciliation
- **Closed** `research-tusd-vendored-source` (fully covered by the tusd attestation + the pin fix).
- **Trimmed** `research-srs-vendored-source` to its one uncovered surface (WHIP/WHEP, DVR, HLS) —
  the control-surface questions are now closed; the delivery surface gates 3 live backlog items.
- garage + imgproxy items left untouched (not yet audited).

## 4. Backlog groom (175 → 170)
Full sweep + grounded deep-pass. 7 confirmed dispositions: 1 archived-done
(`editorial-config-review-followups`), 4 merged (emissions schema slice; calendar mobile pair;
two streaming-docs items into `editorial-docs-streaming-drift`), 1 reframe
(`streaming-chat-moderation-tools` → governance/transparency residue), 1 prune
(`refactor-scan-2026-04-24-findings` discharged sub-sections). VOD-pipeline epic finding
**deferred by choice** (chain is blocked on the Phase 5 playout spike). Report:
`.memory/scratchpad/groom-report-2026-06-18.md`.

## Learnings / notes
- **Archive-stub schema tightened.** The substrate validator now requires archive-tier items to
  carry a valid `kind` ∈ {epic,feature,story,release} + the active-required field set (older
  `kind: backlog` stubs are grandfathered). Archived the done item as `kind: story, stage: done`.
- **Adversarial verification earned its keep** — it overturned a finding (hono casts) by actually
  running `tsc`, not just re-reading. Worth the opus dispatch on the gap audit's medium+ findings.
- The plugin lint resolved from a stale `0.2.0` cache copy rather than installed `0.4.0`; floor
  checks are byte-identical so results stand, but the cache could use a refresh.

## Not mine, left uncommitted
`.devcontainer/devcontainer.json` + `AGENTS.md` carry a pre-existing in-progress **Codex-support**
change (Codex CLI install in the devcontainer + Codex working-notes section). Modified before this
session; left untouched — not part of this session's work.
