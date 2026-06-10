---
status: settled
authored: 2026-06-10
provenance: agent-synthesis
revisit_if:
  - ARD ships a MAJOR version (migration required) — re-read the release notes and update .research/CONVENTIONS.md; MAJOR = wire-form / attestation-frontmatter change, not a free kernel re-sync
  - The plugin's ARD pin advances significantly — check .research/CONVENTIONS.md's pin statement and engagement entry section; keep them aligned with the plugin's ard.json adopts.version
  - Standalone-clone self-containment is no longer a goal for platform — the plugin-as-external-tool model could be reconsidered (e.g. if platform stops being a submodule)
  - The agentic-research plugin's discipline propagation proves unreliable for platform's research sub-contexts — the committed-agents + skills-frontmatter mechanism is the known-good fallback, recoverable from git history
---

# Position: ARD consumption via the agentic-research plugin (no in-tree kernel)

**Status: settled.** Platform consumes ARD v0.5.1 transitively through the agentic-research
plugin's drift-fenced vendored kernel. The prior in-tree `ard-kernel/` vendor is retired.

## The stance

**Platform carries no in-tree ARD kernel copy and no ARD submodule.** The framework architecture
(anti-fabrication core, verification stack, control-space model, data contracts), the baseline
catalogs, the lint, and the discipline bundle are all provided by the agentic-research plugin
as an external tool installed alongside the platform sub-project.

The working contract for how platform uses the research band is `.research/CONVENTIONS.md`,
which names the plugin-provided surfaces (lint, catalogs, discipline bundle) as external tools.

## Evolution to the current model

### Origin: bespoke prose vendor (ARD v0.1)

Platform first adopted ARD by vendoring hand-narrated prose — `research-band-spec.md` (← ARD
SPEC) + `research-band-catalogs.md` (← ARD CATALOGS) + `research-band-platform.md` (deployment
mapping) — pinned at v0.1. This model let the copy fall **silently four releases behind**:
upstream reached v0.4.1 while platform still declared v0.1. The drift was invisible because
nothing mechanical tracked it. Critically, the lag carried a real exposure: platform's
`lint-citations.py` shim was the pre-v0.4.1 `url_alive`, an un-hardened SSRF surface.

### Intermediate: in-tree kernel contract (ARD v0.4.1)

Platform moved to ARD's `kernel/` consumption contract at v0.4.1, vendored in-tree at
`platform/ard-kernel/`. This solved the silent-drift problem: `kernel/catalogs.json` was
consumed as data (not re-narrated), `kernel/discipline.md` was vendored verbatim (never
re-narrated — the drift fence), `kernel/conformance/run.py` validated the vendored copy.

This model's load-bearing cost: **a per-project kernel copy to maintain**. Platform carried its
own `ard-kernel/` distinct from root's, because the project-boundary constraint (standalone-clone
self-containment) prohibited referencing root's `ard/` submodule. Every ARD bump required a
deliberate kernel re-sync.

### Current: plugin-provided kernel (ARD v0.5.1)

The agentic-research plugin packages a drift-fenced vendored kernel alongside its orchestration
and discipline surfaces. Platform adopts the plugin as an **external tool** — referenced by name,
not by path. This preserves the standalone-clone self-containment constraint (in a standalone
clone, the plugin is still installed as an external tool) while eliminating the per-project
kernel copy.

The rejected in-tree vendor (`ard-kernel/`) and its maintenance burden are gone. The discipline
propagation mechanism also upgraded: the orchestrator inlines the discipline bundle into every
authoring dispatch (no committed `.claude/agents/` definitions with `skills:` frontmatter).

## Why the in-tree vendor was the right intermediate step

The prose-vendor model's silent-drift failure justified moving to the kernel contract. The
in-tree kernel was the right mechanism at v0.4.1: it solved silent drift mechanically, and the
standalone-clone constraint made the plugin-as-external-tool model unavailable until the plugin
existed and could be referenced that way. The v0.4.1→v0.5.1 upgrade to plugin consumption was
enabled by the plugin's own maturation, not a reversal of the prior decision's reasoning.

## Rejected alternatives (historical and current)

### Continue the prose-vendor model (to v0.4.1)

Lighter, no tooling refactor — just update the three rule files to v0.4.1 and patch the lint.
**Rejected:** It reproduced the exact silent-drift that left platform four releases stale, and
works against ARD's own v0.3.0 design intent (`ard.json` marks catalogs as `data` = "do not
re-author by hand", discipline as `verbatim` = "never re-narrate").

### Persist the in-tree kernel vendor (at v0.5.1)

Keep `ard-kernel/` and re-sync it to v0.5.1 rather than switching to plugin consumption.

**Rejected at v0.5.1:** The plugin now provides the same drift-fenced kernel without a
per-project copy to maintain. The standalone-clone concern (the original justification for
in-tree) is resolved by treating the plugin as an external tool — in a standalone clone,
the plugin is installed externally, not via a path inside the project tree. Carrying a
redundant in-tree copy alongside the plugin would create two competing kernel surfaces with
no benefit.

### Reference root's ard/ submodule directly

Would eliminate the per-project copy. **Rejected:** Violates the project-boundary
constraint — a markdown link or import path from inside `platform/` that escapes the submodule
root is forbidden. A standalone clone of `platform/` does not include root's `ard/` submodule.

## Platform constraints it sets

- Platform's research lint is invoked via the plugin's `scripts/lint-citations.py` — no
  platform-local shim.
- ARD version pin: **v0.5.1** (from the plugin's `ard.json` `adopts.version`).
- The agentic-research plugin's `research-orchestrator` skill is the engagement entry for
  `[research]`-tagged work items.
- `.research/CONVENTIONS.md` is the working contract — it names the plugin-provided surfaces
  and carries the MIT attribution obligation.
