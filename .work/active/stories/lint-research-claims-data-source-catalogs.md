---
id: story-lint-research-claims-data-source-catalogs
kind: story
stage: implementing
tags: [workflow]
release_binding: null
created: 2026-06-06
updated: 2026-06-06
related_decisions: [platform-0014]
parent: ard-upgrade-v0-4-1
---

# Data-source `lint-research-claims.py` from `ard-kernel/catalogs.json`

The original child-#4 target. `scripts/lint-research-claims.py` carries its pattern categories as a hardcoded `PATTERN_SPECS` dict (`scripts/lint-research-claims.py:60`) and names its non-broken citation-chain statuses inline. Per `platform-0014`, it should **read its category + chain-status sets from the vendored `ard-kernel/catalogs.json`** (data mode), so a future ARD inventory bump is picked up by re-syncing one file rather than editing the lint. Keep a built-in fallback so the lint still runs if the catalog is absent (the kernel reference's pattern).

Split from child #4; sibling story replaces `scripts/lint-citations.py` with the vendored reference. This is the genuine code-refactor half — it needs codebase grounding.

## What the catalog provides (grounding pointer)

`ard-kernel/catalogs.json` carries (among others) the lint pattern-category set and the citation-chain status set the reference `ard-kernel/lint-citations.py` already consumes — read how that reference loads them (its `--catalogs` arg + `json.load` + fallback block) as the working pattern to mirror, rather than inventing a loader.

## Tasks

- [ ] **Ground the current lint** — read `scripts/lint-research-claims.py` end to end: how `PATTERN_SPECS` is structured + consumed, where the non-broken statuses are named, what the SNC-tuned regex matchers are (these are SNC deployment latitude — they stay local; only the *category set* + *status set* come from the catalog).
- [ ] **Add a catalog loader** — read the category + chain-status member sets from `ard-kernel/catalogs.json`, with a built-in fallback to the current hardcoded sets when the catalog is missing/unreadable (mirror `ard-kernel/lint-citations.py`'s loader + `--catalogs` flag).
- [ ] **Preserve the SNC matchers** — the regex/heuristic matchers (deployment latitude) stay in the script; only the category *enumeration* + status *enumeration* become data-sourced. Don't move the matchers into the catalog.
- [ ] **Wire conformance into the check path** — make `ard-kernel/conformance/run.py --lint scripts/lint-research-claims.py` (or the relevant invocation) a runnable parity check; confirm verdicts hold.
- [ ] **Tests** — cover catalog-present (categories sourced from data) and catalog-absent (falls back, lint still runs) paths; extend the `scripts/tests/` stdlib-unittest convention established in child #2.
- [ ] **Update CLAUDE.md / rule references** — the `lint-research-claims.py` description should note it now data-sources its category/status sets from `ard-kernel/catalogs.json`.

## Risks

- **Silent fallback masking drift** — if the loader silently falls back when the catalog is malformed, the lint looks fine while ignoring the v0.4.1 inventory. Emit a visible note on fallback (the reference does this), don't fail silent.
- **Matcher/category coupling** — a category named in `catalogs.json` with no local matcher (or vice versa) should surface, not crash. The reference prints a `[note]` for catalog categories with no matcher — mirror that.
- **Scope creep into prose** — this story is the lint only; folding v0.4.1 inventory growth into the `research-band-*.md` prose rule files is child #5. Don't conflate.

## Revisit if

- Child #5 (prose slim) changes how the rule files describe the lint's catalog-sourcing — keep this story's CLAUDE.md/rule edits consistent with #5.
- The vendored `ard-kernel/` is relocated — update the catalog path the loader reads.
