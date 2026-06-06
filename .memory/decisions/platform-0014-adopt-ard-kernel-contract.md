---
id: platform-0014
title: Adopt the ARD `kernel/` consumption contract (v0.4.1), vendored in-tree
status: active
created: 2026-06-06
updated: 2026-06-06
supersedes: []
superseded_by: null
related: [platform-0013]
revisit_if:
  - "ARD ships a MAJOR version — that is a migration (wire-form / attestation-frontmatter change), not a free kernel re-sync; re-vendor the verbatim surface + schema and reconcile"
  - "The in-tree kernel/ copy fails upstream conformance (kernel/conformance/run.py) — re-sync the vendored surface to the pinned tag"
  - "Platform drifts ≥2 ARD MINOR/PATCH releases behind — schedule a kernel re-sync proactively (the lesson of the v0.1→v0.4.1 lag this decision corrects)"
  - "Standalone-clone self-containment is no longer a goal for platform — the in-tree kernel/ copy could be dropped in favour of consuming root's ard/ submodule directly"
---

## Context

Platform adopted ARD at [platform-0013](platform-0013-adopt-work-research-bands.md) by **vendoring hand-narrated prose** — `research-band-spec.md` (← ARD SPEC) + `research-band-catalogs.md` (← ARD CATALOGS) + `research-band-platform.md` (deployment mapping) — pinned at **v0.1**, with upstream revisions arriving as a deliberate prose re-vendor.

That model let the copy fall **silently four releases behind**: upstream is now **v0.4.1** while platform still declares v0.1. The drift was invisible because nothing mechanical tracked it — a maintainer had to notice by hand, and didn't. Critically, the lag carried a real exposure: platform's `lint-citations.py` is the pre-v0.4.1 `url_alive`, an un-hardened SSRF surface.

ARD's **v0.3.0 consumption contract** exists precisely to stop adopters re-deriving the framework from prose: `kernel/catalogs.json` projects the catalogs as data, `kernel/discipline.md` is the verbatim anti-fabrication bundle, `kernel/conformance/` mechanically validates a vendored copy, and per-artifact `ARD-Version:` stamps make a copy self-describing. Root already adopted this contract (root-0054). Every bump v0.1→v0.4.1 is MINOR/PATCH — a free upgrade, not a migration.

## Decision

Platform moves off the prose-vendor model and **adopts the ARD `kernel/` consumption contract at v0.4.1**, vendored **in-tree**:

- **`kernel/catalogs.json` — consumed as data.** `lint-research-claims.py` is refactored to read its pattern-category + chain-status sets from it, replacing the hardcoded `PATTERN_SPECS`. Catalog re-syncs become a one-file replace, not a prose edit.
- **`kernel/discipline.md` — vendored verbatim.** The anti-fabrication bundle the `research-discipline` skill injects is copied unaltered (never re-narrated — the drift fence).
- **`kernel/conformance/` — the verify surface.** `run.py` + golden fixtures validate the vendored copy against ARD's canonical verdicts.
- **`ARD-Version:` stamps** on each vendored artifact, so a stale copy is self-describing (`grep -r ARD-Version`).
- **The three `research-band-*.md` rule files stay** (they are auto-loaded Claude Code rules) but **slim** toward an SNC-operationalization layer over the data — they stop carrying re-narrated catalog members.

### What this revises in platform-0013

This decision **revises two parts** of platform-0013, leaving the rest intact:

- The **ARD adoption level** — consumption model: *prose-vendor → kernel-contract*. (Tiers 1/2/4 still describe the adoption; the *mechanism* changes.)
- The **version pin** — *v0.1 → v0.4.1*.

platform-0013's band layout (`.work/` + `.research/` shape), self-containment posture, verification-stack wiring, and discipline-propagation mechanism **all stand unchanged**.

### Boundary constraint (load-bearing)

Platform is a standalone-cloneable submodule and **must not link to or depend on root's `ard/` submodule**. "In-tree" means the `kernel/` artifacts are **copied into platform's tree** and the local copies are consumed — not referenced out. MIT attribution travels with the copy, as today. This is the boundary tax the kernel-contract accepts: platform carries its own `kernel/` rather than sharing root's.

## Alternatives considered

- **Path A — continue the prose-vendor model** (hand-update the three rule files to v0.4.1 + patch the lint). Lighter, no tooling refactor. **Rejected:** it reproduces the exact silent-drift that left platform four releases stale, and works against ARD's own v0.3 design intent (`ard.json` marks catalogs as `data` = "do not re-author by hand", discipline as `verbatim` = "never re-narrate").

## Consequences

- One-time tooling work: refactor the lint from hardcoded `PATTERN_SPECS` to data-sourced, and wire `conformance/run.py` into the check path.
- Duplication tax: platform carries an in-tree `kernel/` copy distinct from root's (boundary-mandated).
- Net win: future ARD upgrades become `git diff` the kernel tag + re-run conformance, not a prose hunt — drift is mechanically caught, not maintainer-noticed.

## Revisit if

See frontmatter `revisit_if`.
