---
id: slim-bump-research-band-rules-v0-4-1
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

# Slim + bump the research-band rule files to v0.4.1

The final child of the ARD upgrade. The three `.claude/rules/research-band-*.md` files still declare **v0.1** and re-narrate catalog content that now lives as data in `ard-kernel/catalogs.json` (per `platform-0014`). Fold the v0.4.1 doctrine in and slim toward the data.

The catalog *members* are now vendored data (`ard-kernel/catalogs.json`) + consumed by the lints (children 4a/4b); the rule files keep the **SNC-operationalization layer** (the prose an agent reads to apply the discipline) but stop hand-maintaining the member lists that drift.

## Resolved — defer-to-data

The enumerable member lists (the 22-shape inventory, the 12 predicates, the chain-status set) are **deferred to `ard-kernel/catalogs.json`**; the rule files keep the SNC-operational prose + the platform-fenced-shape map. The big §1 table was slimmed from 14 re-narrated rows to the **9 shapes platform's verification stack actually fences**, with the full inventory + the v0.2 additions explicitly named-as-deferred.

## Tasks

- [x] **`research-band-platform.md`** — §Version pin bumped to v0.4.1 + kernel-contract consumption (`ard-kernel/`: data + verbatim + conformance) noted; adopt line bumped; boundary (no link to root's `ard/`) reaffirmed.
- [x] **`research-band-spec.md`** — version header + VENDORED banner → v0.4.1; §2 inventory → 22 shapes across all 7 loci (WM populated), deferred to catalog data; **§10.5 Typed cross-references** added; §11 relabeled version-agnostic; all `#11-known-limitations-at-v01` anchors fixed; stray "v0.1 adopter/analog/baseline" de-versioned.
- [x] **`research-band-catalogs.md`** — banner/title/footer → v0.4.1 SNC-operationalization framing; §1 slimmed to the platform-fenced-shape map + defer-to-data; §2 per-class **IP profile + raw-layer** note; §3 **6th check `colliding-handle`** + the two non-broken statuses named + data-source note; **§9 typed-edge predicates** (deferred to `typed_edge_predicates` data).
- [x] **Verify** — `check-doc-links.py` clean (20 refs OK incl. the new §10.5 anchor); no residual v0.1 version markers (the one remaining `v0.1` mention is the accurate historical "unpopulated at v0.1"). `scan-memory --face=schema` covers `.research/`/`.work/` frontmatter, not `.claude/rules/`, so it doesn't apply to these files.

## Finding

The vendored `ard-kernel/catalogs.json` `source_classes` carries only `class`/`handle_convention`/`load_bearing` — **not** the v0.2 per-class IP-profile layer (that's upstream CATALOGS prose, not projected to the kernel data). So §2's IP-profile note is kept as SNC-operational prose (platform's retention stance + the upstream pointer), not deferred to data. If a future ARD kernel projects IP profiles into the data, §2 can defer then.

## Risks

- **`.claude/rules/` write path** — read-only to bash in this worktree; edits go through the Edit tool (works). If a full mechanical rewrite is needed it may be cleaner in a bash-writable checkout.
- **Over-slimming** — the rule files are auto-loaded agent context; cutting too much (leaving only a JSON pointer) degrades the in-context discipline. Keep the operational prose; defer only the enumerable member lists.
- **Boundary** — the rule files must not link to root's `ard/`; they reference the in-tree `ard-kernel/` only.

## Review result

Passed 2026-06-06 (read-through) on objective evidence: all three files declare v0.4.1, member lists deferred to `ard-kernel/catalogs.json`, §10.5 + §9 + the 6th `colliding-handle` check added, doc-links 20/20 OK, no residual v0.1 markers (one accurate historical mention). **Not release-bound** — agent-facing doctrine, no deploy surface.

## Revisit if

- A future ARD re-sync changes catalog members — if §1/§9 were deferred to `ard-kernel/catalogs.json`, the rule files need no edit (the win); if re-narrated, they do.

Position: ard-plugin-consumption (`.research/analysis/positions/ard-plugin-consumption.md`)
