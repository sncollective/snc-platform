---
id: lint-research-claims-data-source-catalogs
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

# Data-source `lint-research-claims.py` from `ard-kernel/catalogs.json`

The original child-#4 target. `scripts/lint-research-claims.py` carries its pattern categories as a hardcoded `PATTERN_SPECS` dict (`scripts/lint-research-claims.py:60`) and names its non-broken citation-chain statuses inline. Per `platform-0014`, it should **read its category + chain-status sets from the vendored `ard-kernel/catalogs.json`** (data mode), so a future ARD inventory bump is picked up by re-syncing one file rather than editing the lint. Keep a built-in fallback so the lint still runs if the catalog is absent (the kernel reference's pattern).

Split from child #4; sibling story replaces `scripts/lint-citations.py` with the vendored reference. This is the genuine code-refactor half — it needs codebase grounding.

## What the catalog provides (grounding pointer)

`ard-kernel/catalogs.json` carries (among others) the lint pattern-category set and the citation-chain status set the reference `ard-kernel/lint-citations.py` already consumes — read how that reference loads them (its `--catalogs` arg + `json.load` + fallback block) as the working pattern to mirror, rather than inventing a loader.

## Resolved during implement

- **Category-id alignment (rename).** Two of the lint's six `PATTERN_SPECS` keys diverged from the canonical catalog ids — `decimal-with-paper-attribution`→`decimal-with-attribution`, `file-word-count`→`count-without-unit-citation`. Data-sourcing the *enumeration* requires the matchers be keyed by the canonical ids, so both keys (and their per-category suppression-rule comparisons) were renamed. Nothing else in the repo referenced the old labels (safe); the only output change vs `HEAD` is those two label strings — all flagging behavior is otherwise identical (verified by output diff).
- **`run.py` conformance does not apply here.** `ard-kernel/conformance/run.py` is the *citation*-lint harness — it invokes with `--analysis-dir`/`--no-url-check` and parses the citation-lint JSON schema (`results[].citations`). `lint-research-claims.py` is a different, richer SNC lint with its own CLI + output schema, so run.py can't validate it. Verification is instead its own tests + before/after output-equivalence on `.research/analysis`.

## Tasks

- [x] **Ground the current lint** — `PATTERN_SPECS` (matchers + severities) at top; `RESOLVED_STATUSES` set; consumption in `lint_patterns` (with per-category suppression checks); broken-chain checks use `RESOLVED_STATUSES`.
- [x] **Add a catalog loader** — `load_catalog_config(catalogs_path)` mirrors `ard-kernel/lint-citations.py`'s loader: sources category ids + non-broken statuses from `ard-kernel/catalogs.json`, falls back to built-ins on missing/unreadable/malformed. Added `--catalogs` (default = vendored path); rebinds the module sets once at startup.
- [x] **Preserve the SNC matchers** — the regexes + severities stay in `PATTERN_SPECS`; only the category *enumeration* + non-broken-status *set* are data-sourced. A catalog category with no local matcher emits a `[note]` (none fire today — all 6 matched).
- [x] **Verification (not run.py — see above)** — output vs `HEAD` differs only in the 2 renamed labels; data-sourced output is **identical** to fallback output (catalog matches built-ins); no missing-matcher `[note]`.
- [x] **Tests** — `scripts/tests/test_lint_research_claims_catalog.py` (5 cases: canonical-key alignment, catalog-sourced categories + statuses, fallback on absent + malformed catalog). 5/5 pass.
- [x] **Update CLAUDE.md** — `lint-research-claims.py` entry notes the data-sourcing + `--catalogs` + fallback.

## Risks

- **Silent fallback masking drift** — if the loader silently falls back when the catalog is malformed, the lint looks fine while ignoring the v0.4.1 inventory. Emit a visible note on fallback (the reference does this), don't fail silent.
- **Matcher/category coupling** — a category named in `catalogs.json` with no local matcher (or vice versa) should surface, not crash. The reference prints a `[note]` for catalog categories with no matcher — mirror that.
- **Scope creep into prose** — this story is the lint only; folding v0.4.1 inventory growth into the `research-band-*.md` prose rule files is child #5. Don't conflate.

## Review result

Passed 2026-06-06 (read-through) on objective evidence: output vs `HEAD` differs only in the 2 intended canonical-id renames (otherwise behavior-preserving), data-sourced output identical to fallback, 5/5 catalog-sourcing tests. **Not release-bound** — dev/CI tooling, no deploy surface.

## Revisit if

- Child #5 (prose slim) changes how the rule files describe the lint's catalog-sourcing — keep this story's CLAUDE.md/rule edits consistent with #5.
- The vendored `ard-kernel/` is relocated — update the catalog path the loader reads.

Position: ard-plugin-consumption (`.research/analysis/positions/ard-plugin-consumption.md`)
