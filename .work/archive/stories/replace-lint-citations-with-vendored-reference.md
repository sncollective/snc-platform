---
id: replace-lint-citations-with-vendored-reference
kind: story
stage: done
tags: [workflow]
release_binding: 0.4.0
depends_on: []
gate_origin: null
created: 2026-06-06
updated: 2026-06-06
parent: ard-upgrade-v0-4-1
---

# Replace `scripts/lint-citations.py` with the vendored v0.4.1 reference

Platform's `scripts/lint-citations.py` is **261 diff-lines behind** the ARD v0.4.1 reference: it hardcodes `PATTERN_CATEGORIES`, while the reference data-sources its category + chain-status sets from `catalogs.json` (with a built-in fallback) and adds a `--catalogs` arg. Now that the pristine reference is vendored at `ard-kernel/lint-citations.py` (child #3, conformance 16/16), the citation lint should **be** that reference rather than a hand-maintained fork. This **subsumes the child-#2 SSRF patch** — the v0.4.1 reference already carries the hardened `url_alive`.

Split from child #4 (the other half is `lint-research-claims.py` data-sourcing). This one is near-mechanical; the data-sourcing refactor of platform's richer lint is its sibling story.

## Resolved decision — thin shim

`scripts/lint-citations.py` is now a 24-line **runpy shim** delegating to `ard-kernel/lint-citations.py`. Chosen because the callers (`research-orchestrator` skill, `adversarial-reader` agent) reference `scripts/lint-citations.py` by relative path — a shim keeps every caller working with zero edits, single source of truth in `ard-kernel/`. `runpy.run_path(..., run_name="__main__")` makes the reference run with its own `__file__`, so its `--catalogs` default resolves to `ard-kernel/catalogs.json` (data-sourcing works through the shim). Symlink was rejected (`abspath(__file__)` wouldn't resolve the link → catalog falls back to built-ins); caller-redirect+delete was rejected (would force edits to the `.claude/` skill/agent docs for no benefit).

## Tasks

- [x] **Ground callers** — `research-orchestrator` SKILL (runs it over synthesis), `adversarial-reader` agent (thin-attestation check), the child-#2 test, CLAUDE.md (doc). All reference `scripts/lint-citations.py` by path → shim preserves them.
- [x] **Apply the resolution** — `scripts/lint-citations.py` is the shim; the citation lint is now the vendored v0.4.1 reference, data-sourced from `ard-kernel/catalogs.json`. Proven faithful: shim output is **byte-identical** to running the reference directly.
- [x] **Confirm SSRF parity** — the reference's `url_alive` + `_url_allowed` + `_host_is_public` carry the same v0.4.1 fence as the child-#2 hand-patch (same refusal set, per-hop redirect re-validation). Offline guard behavior unchanged.
- [x] **Re-point the child-#2 test** — `scripts/tests/test_lint_citations_url_alive.py` now targets `ard-kernel/lint-citations.py` (the shim runpy-execs as `__main__`, so it's not importable for helpers); renamed `_url_probe_safe` → the reference's `_url_allowed`. **11/11 pass.**
- [x] **Conformance** — `ard-kernel/conformance/run.py` → 16/16 (default target = the vendored reference).
- [x] **Update CLAUDE.md** — `lint-citations.py` entry now describes the shim → vendored reference + data-sourcing.

## Risks

- **Caller breakage** — a missed caller (CI, pre-commit) silently stops linting. The grounding task is load-bearing; verify each caller post-change.
- **`catalogs.json` resolution** — the reference finds its catalog `__file__`-relative; a shim/symlink that changes the effective dir can make it fall back to built-ins silently. Verify it actually reads `ard-kernel/catalogs.json` (not the fallback) after the change.
- **Losing the SSRF test coverage** — don't delete the child-#2 test without re-pointing it.

## Review result

Passed 2026-06-06 (read-through) on objective evidence: shim output is byte-identical to running `ard-kernel/lint-citations.py` directly (faithful delegation incl. catalog resolution), re-pointed SSRF test 11/11, conformance 16/16. **Not release-bound** — dev/CI tooling, no deploy surface.

## Revisit if

- The vendored `ard-kernel/` is later relocated (e.g. `git mv` to `scripts/ard-kernel/`) — the resolution path here moves with it.

Position: ard-plugin-consumption (`.research/analysis/positions/ard-plugin-consumption.md`)
