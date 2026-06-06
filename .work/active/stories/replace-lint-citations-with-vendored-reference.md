---
id: story-replace-lint-citations-with-vendored-reference
kind: story
stage: implementing
tags: [workflow]
release_binding: null
created: 2026-06-06
updated: 2026-06-06
related_decisions: [platform-0014]
parent: ard-upgrade-v0-4-1
---

# Replace `scripts/lint-citations.py` with the vendored v0.4.1 reference

Platform's `scripts/lint-citations.py` is **261 diff-lines behind** the ARD v0.4.1 reference: it hardcodes `PATTERN_CATEGORIES`, while the reference data-sources its category + chain-status sets from `catalogs.json` (with a built-in fallback) and adds a `--catalogs` arg. Now that the pristine reference is vendored at `ard-kernel/lint-citations.py` (child #3, conformance 16/16), the citation lint should **be** that reference rather than a hand-maintained fork. This **subsumes the child-#2 SSRF patch** — the v0.4.1 reference already carries the hardened `url_alive`.

Split from child #4 (the other half is `lint-research-claims.py` data-sourcing). This one is near-mechanical; the data-sourcing refactor of platform's richer lint is its sibling story.

## Open decision (resolve at implement, needs caller grounding)

**How `scripts/lint-citations.py` resolves to the vendored reference.** Options:
- **Thin shim** — `scripts/lint-citations.py` becomes a small wrapper that execs/imports `ard-kernel/lint-citations.py` (keeps the `scripts/` CLI entrypoint stable for existing callers; single source of truth in `ard-kernel/`).
- **Caller redirect + delete** — update every caller to invoke `ard-kernel/lint-citations.py` directly, then delete `scripts/lint-citations.py`.
- **Symlink** — `scripts/lint-citations.py` → `../ard-kernel/lint-citations.py` (within-project, boundary-legal; simplest, but a Python symlink resolving `__file__`-relative `catalogs.json` must still find `ard-kernel/catalogs.json`).

Ground the callers first (`grep -rn lint-citations` across `scripts/`, pre-commit config, CI, CLAUDE.md, the research skills) to pick the option that keeps them working. The reference resolves `catalogs.json` relative to its own location, so it must run from `ard-kernel/` to pick up the vendored catalog — a factor in the shim-vs-redirect choice.

## Tasks

- [ ] **Ground callers** — enumerate everything that invokes `scripts/lint-citations.py` (scripts, pre-commit, CI, docs, skills).
- [ ] **Pick the resolution approach** (open decision) and apply it so the citation lint is the vendored v0.4.1 reference, data-sourced from `ard-kernel/catalogs.json`.
- [ ] **Confirm SSRF parity** — the reference's `url_alive` carries the same v0.4.1 SSRF fence as the child-#2 hand-patch; verify no regression (offline guard behavior unchanged: `file://` / metadata / private refused).
- [ ] **Re-point or retire the child-#2 test** — `scripts/tests/test_lint_citations_url_alive.py` targeted `scripts/lint-citations.py`; re-point it at whatever the lint now resolves to (or fold into the kernel conformance), so the SSRF guard stays covered.
- [ ] **Conformance** — `ard-kernel/conformance/run.py` stays 16/16; if a `scripts/` entrypoint remains, run.py `--lint` against it also passes.
- [ ] **Update CLAUDE.md** — the `lint-citations.py` description ("the zero-dependency ARD reference citation-chain lint") should reflect the new resolution (vendored reference / shim location).

## Risks

- **Caller breakage** — a missed caller (CI, pre-commit) silently stops linting. The grounding task is load-bearing; verify each caller post-change.
- **`catalogs.json` resolution** — the reference finds its catalog `__file__`-relative; a shim/symlink that changes the effective dir can make it fall back to built-ins silently. Verify it actually reads `ard-kernel/catalogs.json` (not the fallback) after the change.
- **Losing the SSRF test coverage** — don't delete the child-#2 test without re-pointing it.

## Revisit if

- The vendored `ard-kernel/` is later relocated (e.g. `git mv` to `scripts/ard-kernel/`) — the resolution path here moves with it.
