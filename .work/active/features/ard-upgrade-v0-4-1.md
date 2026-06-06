---
id: feature-ard-upgrade-v0-4-1
kind: feature
stage: drafting
tags: [workflow]
release_binding: null
created: 2026-06-06
updated: 2026-06-06
related_decisions: [platform-0013]
parent: null
---

# Upgrade platform's ARD adoption from v0.1 to v0.4.1

Platform's research band is pinned at **ARD v0.1** (declared in all three `research-band-*.md` rule files + `platform-0013`). Upstream is at **v0.4.1** — four releases ahead. This feature re-vendors platform's adoption to v0.4.1.

## Why now

Accumulated drift across four upstream releases, plus one item that is **security-relevant and affects platform today**:

- Platform's `scripts/lint-citations.py:104` `url_alive()` is the **pre-v0.4.1, un-hardened** liveness probe — a bare `urllib.request.urlopen(HEAD)` with no scheme allow-list and no private-IP guard. A hostile/compromised attestation `source_url` can aim the linter at the cloud-metadata endpoint (`169.254.169.254`) or internal addresses (SSRF). Low severity (local dev tool; attacker must land a crafted attestation) but real, and closed by v0.4.1.

## The version gap (v0.1 → v0.4.1)

All bumps are **MINOR/PATCH** — per ARD's SemVer this is a *free upgrade, not a migration*. The `[handle]{N}` wire-form and the normative-minimum attestation frontmatter are unchanged, so existing attestations/citations keep working.

| Release | Type | What landed | Platform gap |
|---|---|---|---|
| v0.2 | MINOR | Failure-shape inventory 14→22 (`WM.1–3` populate the Warrant/meta locus; `GR.1c`/`GR.6`/`GR.7`/`CO.2`/`CO.3` added); per-class **IP profile + raw-layer treatment** in the source-class catalog; two non-broken citation-chain statuses named (`intra-program-resolved`, `reduced-substrate-attestation`) | `research-band-catalogs.md` §1 missing 8 shapes; §2 missing IP-profile layer; §3 statuses unnamed |
| v0.3.0 | MINOR | **Consumption contract**: `kernel/` vendorable surface, `ard.json` manifest, `kernel/catalogs.json` (catalogs as data), `kernel/discipline.md` (verbatim drift fence), `kernel/schema/`, `kernel/conformance/` fixtures+runner, per-artifact `ARD-Version:` stamps | Platform hand-copies prose; no `ARD-Version` stamp; not consuming `kernel/` |
| v0.4.0 | MINOR | **Typed cross-references** (`related:` frontmatter, SPEC §10.5 + 12-predicate vocab CATALOGS §9); 6th citation-chain check **handle uniqueness** (`colliding-handle`) | No §10.5 / predicate catalog in vendored rules. *Note: platform already grew handle-uniqueness independently in `audit-handles.py --collisions` — capability exists, vendored text doesn't reflect it* |
| v0.4.1 | PATCH | **SSRF-hardened `url_alive`** (http(s) scheme allow-list, public-IP-only resolution, per-redirect re-validation) | `lint-citations.py` is the un-hardened version (see Why now) |

Note: platform's vendored copy is already a **hybrid** — it carries the v0.2 *locus-of-failure coordinate system* (`AQ/GR/CX/CO/FR/PR/WM`) but only the v0.1 *inventory content* (14 shapes, `WM` empty). The recoordination was hand-applied; the inventory growth was not.

## Resolved decision — consumption model: **Path B (kernel contract, in-tree)**

Platform adopts the v0.3+ **`kernel/` consumption contract**, vendored in-tree — moving off the hand-narrated-prose model that caused this drift. Rationale: the prose model is exactly what let platform fall four releases behind silently; ARD's `ard.json` declares the catalogs as `data` mode ("do not re-author by hand") and `discipline.md` as `verbatim` ("never re-narrate"); and this aligns platform with root's consumption model (root-0054) for one mental model across the monorepo.

**Project-boundary constraint (load-bearing):** platform cannot link to or depend on root's `ard/` submodule. Path B here means **copy the `kernel/` artifacts into platform's tree** and consume the *local* copies — not reference root. Self-containment is preserved; platform carries its own in-tree `kernel/` (the boundary tax B accepts).

What B concretely brings in-tree:
- `kernel/catalogs.json` consumed as **data** — `lint-research-claims.py` refactored to read its category/status sets from it (currently hardcoded `PATTERN_SPECS`, line 60).
- `kernel/discipline.md` vendored **verbatim** — the anti-fabrication bundle the `research-discipline` skill injects.
- `kernel/conformance/` fixtures + `run.py` to mechanically validate the vendored copy.
- Per-artifact `ARD-Version:` stamps so a stale copy is self-describing.
- The three `research-band-*.md` rule files **slim** toward an SNC-operationalization layer over the data (they stay — they're auto-loaded rules — but stop carrying re-narrated catalog members).

To capture this as a durable position: write `.memory/decisions/platform-00NN-adopt-ard-kernel-contract.md` (supersedes the prose-vendor stance in `platform-0013`'s adoption-level section).

## Children (Path B decomposition — pulled via `/scope --parent=ard-upgrade-v0-4-1`)

Code-grounded children are enumerated here, not written at scope time (they need `/design`/`/implement` grounding):

1. ~~**Decision record** — `platform-00NN-adopt-ard-kernel-contract.md`; reconcile `platform-0013`.~~ ✅ Done → `platform-0014-adopt-ard-kernel-contract.md` (platform-0013 carries a forward-pointer). *(doctrine; small)*
2. ~~**SSRF lint patch** — re-vendor hardened `url_alive` into `lint-citations.py`.~~ ✅ Done → story `ssrf-harden-lint-citations-url-alive` (review-passed 2026-06-06 on test evidence; not release-bound — dev/CI tooling; archived at `.work/archive/stories/`).
3. ~~**Vendor `kernel/` in-tree** — copy `catalogs.json` + `discipline.md` + `conformance/` into platform; add `ARD-Version` stamps.~~ ✅ Done → story `vendor-ard-kernel-in-tree` (review-passed 2026-06-06, archived). Vendored verbatim to **top-level `ard-kernel/`** (23 files, byte-identical to upstream `diff -r`, stamps 0.4.1, **conformance 16/16**). Location went top-level (parallels root's `ard/`; bash-writable for faithful re-syncs) rather than `scripts/ard-kernel/` — relocatable via `git mv` later if consumer-proximity is preferred.
4. **Lint catch-up — split into two stories** (both reference the vendored `ard-kernel/`). The child-#3 finding (platform has *two* stale citation lints in `scripts/`) made one combined child the wrong shape:
   - **4a — Replace `scripts/lint-citations.py` with the vendored reference.** ✅ Done · review-passed · archived → story `replace-lint-citations-with-vendored-reference`. `scripts/lint-citations.py` is now a 24-line runpy shim to `ard-kernel/lint-citations.py` (data-sourced, byte-identical delegation verified); subsumes the child-#2 SSRF patch; SSRF test re-pointed (11/11). Conformance 16/16.
   - **4b — Data-source `lint-research-claims.py` from `ard-kernel/catalogs.json`.** ✅ Done · review-passed · archived → story `lint-research-claims-data-source-catalogs`. `load_catalog_config` sources the category enumeration + non-broken-status set from the catalog (+ fallback); SNC matchers stay local; 2 category keys aligned to canonical ids. Output behavior-preserving (diff vs HEAD = only the 2 renamed labels); 5/5 new tests. (Note: `run.py` conformance is citation-lint-specific, doesn't apply to this lint.)
5. **Slim + bump the prose rule files** — fold v0.4.1 content (inventory growth, typed cross-refs §10.5/§9, IP profiles, 6th citation check) into the SNC-operationalization layer; bump version markers + vendor banners. *(doctrine)*

## Scope — what's in

- [x] **Resolve the consumption-model decision** → **Path B (kernel contract, in-tree)**. Decision record `platform-00NN-adopt-ard-kernel-contract.md` still to be written; update `platform-0013` linkage.
- [ ] **SSRF patch** — re-vendor the hardened `url_alive` into `scripts/lint-citations.py` (do this first; isolated, no doctrine change, security fix). Confirm conformance/verdicts on public URLs unchanged.
- [ ] **Inventory growth** (`research-band-catalogs.md`) — add `WM.1–3` + `GR.1c`/`GR.6`/`GR.7`/`CO.2`/`CO.3` to §1 (8 shapes, with fences); add per-class IP-profile + raw-layer layer to §2; name the two non-broken statuses + the `colliding-handle` 6th check in §3.
- [ ] **Typed cross-references** — add SPEC §10.5 + the 12-predicate vocabulary (new §9) to the vendored spec/catalogs; decide whether platform wires `related:` into `.research/` tooling now or defers.
- [ ] **Spec relabel + version bump** — `research-band-spec.md`: "Known limitations **at v0.1**" → version-agnostic; bump version headers + vendor banners across all three files; bump `research-band-platform.md` §Version pin to v0.4.1.
- [ ] **Reconcile `audit-handles.py --collisions`** against the now-vendored `colliding-handle` status (align terminology; note convergent evolution).
- [ ] **Update `platform-0013`** — record the re-vendor; tighten `revisit_if` so accumulated MINOR/PATCH drift (not only MAJOR) trips a re-vendor review.

## Explicitly out

- No change to the `[handle]{N}` wire-form or attestation frontmatter (unchanged across v0.1→v0.4.1 — that's why this is not a migration).
- Not re-running or re-authoring existing `.research/` artifacts — they stay valid; this is doctrine + tooling.

## Sequencing

SSRF patch can land independently and first (security, isolated). The decision gates everything else. Inventory growth + typed-refs + relabel are the doctrine bulk.

## Risks

- **Path B underestimate** — kernel-contract adoption touches tooling (lint catalog-sourcing, conformance runner), not just prose; if chosen, split into children rather than absorbing inline.
- **Self-containment vs kernel reuse tension** — Path B still forbids linking to root's `ard/`; the verbatim copy must be carried in-tree with attribution, same as today's prose.
- **Convergent-evolution mismatch** — platform's `audit-handles.py --collisions` and upstream `colliding-handle` may differ in edge cases (INDEX-minted vs filename-mismatch); reconcile, don't assume identical.

## Done criteria

- Three `research-band-*.md` files + `platform-0013` declare **v0.4.1**; no residual "v0.1" version markers.
- `lint-citations.py` SSRF-hardened; existing verdicts on public URLs unchanged.
- Failure-shape inventory shows 22 shapes; source-class catalog carries IP profiles; citation-chain section names all six checks.
- Consumption-model decision recorded with rationale + `revisit_if`.

## Revisit if

- Upstream ships a **MAJOR** (then it *is* a migration, not a free re-vendor — different shape).
- Path B is chosen and the work exceeds one coherent pass — split into child stories.
