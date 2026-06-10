---
id: vendor-ard-kernel-in-tree
kind: story
stage: done
tags: [workflow]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-06-06
updated: 2026-06-06
parent: ard-upgrade-v0-4-1
---

# Vendor the ARD v0.4.1 `kernel/` surface in-tree

Copy ARD v0.4.1's `kernel/` consumption surface into platform's tree so platform consumes the framework as **data + verbatim + verify** rather than hand-narrated prose (per `platform-0014`). Boundary-respecting: the artifacts are **copied in**; nothing links to or imports root's `ard/` submodule. This is the unblocker for child #4 (refactor `lint-research-claims.py` to data-source from `catalogs.json`). It does **not** rewire any lint or slim the prose rule files — those are children #4 and #5.

The upstream source surface (ARD v0.4.1 `kernel/`): `catalogs.json`, `discipline.md`, `conformance/` (`run.py` + fixtures + `expected.json`), `schema/attestation.schema.json`, `templates/`, and the reference `lint-citations.py`. Each upstream artifact carries an `ARD-Version:` stamp.

## Resolved decisions

1. **In-tree location → top-level `ard-kernel/`.** Chosen for a *byte-faithful* vendor: the verbatim-vendor discipline demands an exact copy (verifiable by `diff -r` / checksum), which a top-level dir allows via a real `cp -r` — versus hand-transcribing a 481-line `catalogs.json` through an LLM context, which is error-prone and against the discipline. The location is durable on its own merits: it parallels how the monorepo carries `ard/` at root, is the standard placement for vendored upstream code, and keeps a pristine dir for clean `git diff`/`cp -r` re-syncs on the next ARD bump. *(`.claude/ard-kernel/` and `scripts/ard-kernel/` — the consumer-proximate option — were considered; both are read-only to bash in this worktree, precluding a faithful copy. If the team later prefers consumer-proximity, `git mv ard-kernel scripts/ard-kernel` in a full checkout is trivial and child #4 references accordingly.)* `conformance/run.py` defaults to linting its sibling `../lint-citations.py`, so the whole dir is self-validating at this path.
2. **Lint reconciliation → vendor the kernel lint as the pristine conformance baseline; keep platform's `scripts/` lints as production.** `ard-kernel/lint-citations.py` stays pristine (the upgrade-diff anchor + what `run.py` validates 16/16 by construction). Platform's `scripts/lint-citations.py` + `scripts/lint-research-claims.py` remain its production tools; child #4 makes the latter data-source from `ard-kernel/catalogs.json`. **Finding for #4 (recorded in the parent feature):** platform's `scripts/lint-citations.py` is **261 diff-lines behind** the v0.4.1 reference (it hardcodes `PATTERN_CATEGORIES`; the reference data-sources from `catalogs.json` with fallback) — so the cleanest #4/#5 move may be to *replace* `scripts/lint-citations.py` with the vendored reference verbatim, which would subsume the child-#2 SSRF hand-patch.

## Landed + verified

Vendored to **`ard-kernel/`** (23 files: 22 from ARD v0.4.1 `kernel/` + `LICENSE`). Verification:

- **Byte-fidelity** — `diff -r <ARD>/kernel ard-kernel` reports only the added `LICENSE`; every other file is byte-identical to upstream.
- **Stamp uniformity** — every `.md`/`.py` carries `ARD-Version: 0.4.1`; the three JSON files (`catalogs.json`, `conformance/expected.json`, `schema/attestation.schema.json`) are unstamped by nature (version lives in upstream `ard.json`).
- **Self-contained** — no parent-path or root-absolute links; `README.md` uses external `https://` URLs only, so the dir stands alone.
- **Conformance** — `python3 ard-kernel/conformance/run.py` → **16/16 checks passed** (9 statuses · 1 thin · 6 pattern categories) against the pristine vendored reference lint.

## Tasks

- [x] **Pick + create the in-tree kernel location** (decision 1 → `ard-kernel/`) and copy the full ARD v0.4.1 `kernel/` surface in (`catalogs.json`, `discipline.md`, `lint-citations.py`, `README.md`, `conformance/`, `schema/`, `templates/`).
- [x] **MIT attribution** — `ard-kernel/LICENSE` (ARD's MIT license, Copyright 2026 Kevin Cook); the vendored `README.md` carries the upstream attribution.
- [x] **`ARD-Version: 0.4.1` stamps** — `grep -r ARD-Version ard-kernel` returns 0.4.1 for every stamped file; JSON files unstamped by nature (version in upstream `ard.json`).
- [x] **Conformance baseline** — `ard-kernel/conformance/run.py` → 16/16 against the pristine vendored reference lint.
- [x] **Flag the discipline-bundle reconciliation** — `ard-kernel/discipline.md` is the verbatim source the `research-discipline` skill should inject; the skill's switch from its inlined content is **flagged, not performed** (rides with #4/#5 or a follow-on).
- [x] **Confirm `platform-0014` consistency** — 0014 says "vendored in-tree" (path-agnostic); the concrete `ard-kernel/` path is recorded here and in the parent feature. No 0014 edit needed.

## Explicitly out

- No rewrite of `lint-research-claims.py` to read `catalogs.json` (child #4).
- No slimming/bumping of the three `research-band-*.md` prose rule files (child #5).
- No change to the `research-discipline` skill's injected content (flagged here, executed in a later child).

## Risks

- **Duplicate-lint drift** — vendoring the kernel `lint-citations.py` next to platform's two existing lints risks three citation linters. Keep the kernel copy as a conformance *reference* only, clearly labelled, or skip it; don't let it become a third production lint.
- **Stamp/version skew** — if any artifact is copied from a different tag than 0.4.1, the `ARD-Version` grep will catch it; treat a non-uniform stamp as a vendoring error.
- **Boundary slip** — easy to accidentally reference root's `ard/` path while copying; verify the vendored copy stands alone (no `../../../ard` paths, no link to root) per the project boundary.

## Review result

Passed 2026-06-06 (read-through) on objective evidence: byte-identical `diff -r` vs upstream `kernel/`, uniform `ARD-Version: 0.4.1` stamps, clean doc-links (17 md files), and conformance 16/16. **Not release-bound by design** — vendored reference substrate, no deploy surface; `release_binding` stays `null`.

## Revisit if

- Child #4 chooses to consume `catalogs.json` from a different location than this story lands it — reconcile the path.
- A future ARD re-sync replaces these artifacts — this is the surface to `git diff` against the new tag.

Position: ard-plugin-consumption (`.research/analysis/positions/ard-plugin-consumption.md`)
