#!/usr/bin/env python3
"""Audit `[handle]{N}` citation handle deployment across this project's memory + research tiers.

Counts citation handles per file, per tier. Handles are the substrate's sub-document
link addressing (the `[handle]{N}` wire-form per research-band-spec.md §4.2); deployment
is the cheapest forward-compatibility win for future indexer primitives (graph adjacency,
BM25/FTS5, vector retrieval).

Usage:
    python3 scripts/audit-handles.py                       # summary
    python3 scripts/audit-handles.py --by-file             # per-file detail
    python3 scripts/audit-handles.py --by-handle           # per-handle frequency
    python3 scripts/audit-handles.py --collisions          # flag handle collisions (uniqueness)
    python3 scripts/audit-handles.py --diff <baseline.json> # delta against a prior baseline
    python3 scripts/audit-handles.py --json                # machine-readable

Coordinates with `scripts/lint-research-claims.py` (citation-chain verifier at
attestation-tier) and `scripts/scan-memory.py --face=references` (citation-chain
verifier at reference-tier). This script measures *deployment* — the others
verify *resolution*.
"""

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

CITATION_RE = re.compile(r"\[([\w-]+)\]\{(\d+)\}")

# Handle DEFINITION sites (distinct from body citations, which CITATION_RE matches):
# a per-corpus INDEX entry `### N. Title — `handle`` and an attestation filename
# `.research/attestation/<handle>.md`. Used by the collision check (harvested from
# VIGIL's reference-lint citation-handle-uniqueness check per the convergence epic).
INDEX_ENTRY_RE = re.compile(r"^###\s+\d+\..*—\s*`([\w-]+)`\s*$", re.MULTILINE)
SOURCE_HANDLE_FM_RE = re.compile(r"^source_handle:\s*([\w-]+)\s*$", re.MULTILINE)

SKIP_DIRS = {
    ".git", ".godot", ".import", "bin", "obj", "node_modules",
    "dist", "build", "scratchpad", "agents", ".bun-cache", ".tanstack",
}

# Single-scope (this project). Tier path → label.
SCOPES = {
    "platform": REPO_ROOT,
}

TIER_PATHS = [
    (".memory/decisions", "decisions"),
    (".memory/sessions", "sessions"),
    (".work/active", "active-items"),
    (".work/archive", "archive-items"),
    (".work/backlog", "backlog-items"),
    (".work/releases", "releases-items"),
    (".research/notes", "research-notes"),
    (".research/precis", "research-precis"),
    (".research/analysis", "research-analysis"),
    (".research/reference", "research-reference"),
]


def walk_md_files(root):
    if not root.is_dir():
        return
    for md in root.rglob("*.md"):
        if any(part in SKIP_DIRS for part in md.parts):
            continue
        yield md


def _strip_code_blocks(text):
    """Mask fenced code blocks and inline backtick code."""
    out = []
    in_block = False
    for line in text.split("\n"):
        if line.lstrip().startswith("```"):
            in_block = not in_block
            out.append("")
            continue
        if in_block:
            out.append("")
            continue
        out.append(re.sub(r"`[^`\n]+`", lambda m: " " * len(m.group(0)), line))
    return "\n".join(out)


def count_handles(md_file):
    """Return list of (handle, n) tuples for body citations in a markdown file."""
    try:
        text = md_file.read_text(encoding="utf-8")
    except OSError:
        return []
    # Skip frontmatter
    if text.startswith("---\n"):
        end = text.find("\n---\n", 4)
        if end != -1:
            text = text[end:]
    text = _strip_code_blocks(text)
    return [(m.group(1), int(m.group(2))) for m in CITATION_RE.finditer(text)]


def audit(scopes_filter):
    """Walk scopes × tiers; return nested dict of (scope, tier, file) → cite list."""
    results = {}
    for scope_name, scope_root in SCOPES.items():
        if scopes_filter and scope_name not in scopes_filter:
            continue
        if not scope_root.is_dir():
            continue
        scope_data = {}
        for rel_tier_path, tier_label in TIER_PATHS:
            tier_root = scope_root / rel_tier_path
            if not tier_root.is_dir():
                continue
            tier_data = {}
            for md_file in walk_md_files(tier_root):
                cites = count_handles(md_file)
                if cites:
                    rel = str(md_file.relative_to(REPO_ROOT))
                    tier_data[rel] = cites
            if tier_data:
                # Merge into label (research-notes vs research-reference may share label across tiers)
                scope_data.setdefault(tier_label, {}).update(tier_data)
        results[scope_name] = scope_data
    return results


def summarize(results):
    """Per-scope, per-tier counts."""
    summary = {"by_scope": {}, "totals": {"files_with_handles": 0, "total_cites": 0, "unique_handles": 0}}
    all_handles = set()
    for scope_name, scope_data in results.items():
        scope_summary = {"by_tier": {}, "files_with_handles": 0, "total_cites": 0}
        for tier_label, tier_data in scope_data.items():
            files_n = len(tier_data)
            cites_n = sum(len(v) for v in tier_data.values())
            scope_summary["by_tier"][tier_label] = {
                "files_with_handles": files_n,
                "total_cites": cites_n,
            }
            scope_summary["files_with_handles"] += files_n
            scope_summary["total_cites"] += cites_n
            for cites in tier_data.values():
                for handle, _ in cites:
                    all_handles.add(handle)
        summary["by_scope"][scope_name] = scope_summary
        summary["totals"]["files_with_handles"] += scope_summary["files_with_handles"]
        summary["totals"]["total_cites"] += scope_summary["total_cites"]
    summary["totals"]["unique_handles"] = len(all_handles)
    return summary


def render_summary(summary, top_handles=None):
    lines = []
    lines.append(f"# Citation handle audit\n")
    t = summary["totals"]
    lines.append(f"- {t['files_with_handles']} file(s) with handles")
    lines.append(f"- {t['total_cites']} total citation(s)")
    lines.append(f"- {t['unique_handles']} unique handle(s)\n")

    lines.append("## By scope and tier\n")
    lines.append("| Scope | Tier | Files | Cites |")
    lines.append("|---|---|---|---|")
    for scope_name, scope_summary in summary["by_scope"].items():
        for tier_label, tier_data in sorted(scope_summary["by_tier"].items()):
            lines.append(
                f"| {scope_name} | {tier_label} | {tier_data['files_with_handles']} | {tier_data['total_cites']} |"
            )

    if top_handles:
        lines.append("\n## Top handles by usage")
        for handle, count in top_handles[:20]:
            lines.append(f"- `{handle}` — {count} cite(s)")

    return "\n".join(lines)


def render_by_file(results):
    lines = []
    for scope_name, scope_data in results.items():
        for tier_label, tier_data in sorted(scope_data.items()):
            for rel, cites in sorted(tier_data.items()):
                handles = ", ".join(f"[{h}]{{{n}}}" for h, n in cites)
                lines.append(f"[{scope_name}/{tier_label}] {rel}: {len(cites)} cite(s) — {handles}")
    return "\n".join(lines)


def collect_handle_frequency(results):
    counter = Counter()
    for scope_data in results.values():
        for tier_data in scope_data.values():
            for cites in tier_data.values():
                for handle, _ in cites:
                    counter[handle] += 1
    return counter.most_common()


def collect_handle_definitions(scope_root):
    """Map handle → list of (kind, location) definition sites across a scope's `.research/`.

    Definition sites are per-corpus INDEX entries and attestation filenames — the places a
    handle is *minted*, distinct from where it is *cited*. Returns a separate `mismatches`
    list for attestation files whose `source_handle:` frontmatter differs from the filename.
    """
    defs = defaultdict(list)
    mismatches = []

    ref_root = scope_root / ".research" / "reference"
    if ref_root.is_dir():
        for index in ref_root.rglob("INDEX.md"):
            if any(part in SKIP_DIRS for part in index.parts):
                continue
            try:
                text = index.read_text(encoding="utf-8")
            except OSError:
                continue
            loc = str(index.relative_to(REPO_ROOT))
            for m in INDEX_ENTRY_RE.finditer(text):
                defs[m.group(1)].append(("index", loc))

    att_root = scope_root / ".research" / "attestation"
    if att_root.is_dir():
        for att in sorted(att_root.glob("*.md")):
            loc = str(att.relative_to(REPO_ROOT))
            defs[att.stem].append(("attestation", loc))
            try:
                m = SOURCE_HANDLE_FM_RE.search(att.read_text(encoding="utf-8"))
            except OSError:
                m = None
            if m and m.group(1) != att.stem:
                mismatches.append((att.stem, m.group(1), loc))

    return defs, mismatches


def find_collisions(scopes_filter):
    """Flag handle collisions: a handle minted by 2+ INDEX entries (two sources claiming the
    same handle), or an attestation whose `source_handle:` frontmatter ≠ its filename. A handle
    must resolve to exactly one source, so collisions break the citation chain's stability."""
    findings = []
    for scope_name, scope_root in SCOPES.items():
        if scopes_filter and scope_name not in scopes_filter:
            continue
        if not scope_root.is_dir():
            continue
        defs, mismatches = collect_handle_definitions(scope_root)
        for stem, fm_handle, loc in mismatches:
            findings.append((scope_name, "frontmatter-mismatch",
                f"{loc}: filename handle `{stem}` ≠ `source_handle: {fm_handle}`"))
        for handle, sites in sorted(defs.items()):
            index_sites = [loc for kind, loc in sites if kind == "index"]
            if len(index_sites) > 1:
                findings.append((scope_name, "duplicate-index-handle",
                    f"`{handle}` minted in {len(index_sites)} INDEX entries: " + ", ".join(index_sites)))
    return findings


def render_collisions(findings):
    if not findings:
        return "# Citation-handle collisions\n\nNone — every handle resolves to a single source."
    lines = [f"# Citation-handle collisions ({len(findings)})\n"]
    for scope_name, category, message in findings:
        lines.append(f"- [{scope_name}] **{category}**: {message}")
    return "\n".join(lines)


def diff_against_baseline(current_summary, baseline_path):
    try:
        with baseline_path.open() as f:
            baseline = json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        print(f"Failed to load baseline: {e}", file=sys.stderr)
        return ""
    base_t = baseline.get("totals", {})
    cur_t = current_summary["totals"]
    lines = ["# Diff against baseline\n"]
    for k in ("files_with_handles", "total_cites", "unique_handles"):
        delta = cur_t.get(k, 0) - base_t.get(k, 0)
        lines.append(f"- {k}: {base_t.get(k, 0)} → {cur_t.get(k, 0)} ({delta:+d})")
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--by-file", action="store_true", help="Per-file listing")
    parser.add_argument("--by-handle", action="store_true", help="Per-handle frequency listing")
    parser.add_argument("--collisions", action="store_true", help="Flag handle collisions (a handle minted by 2+ INDEX entries; attestation source_handle ≠ filename)")
    parser.add_argument("--json", action="store_true", help="Machine-readable summary JSON")
    parser.add_argument("--diff", type=Path, help="Compare against a baseline JSON dump")
    parser.add_argument("--exit-code-on-collision", action="store_true", help="Exit 1 if any collision is found (for CI / pre-commit)")
    args = parser.parse_args()

    scopes_filter = None

    if args.collisions:
        findings = find_collisions(scopes_filter)
        if args.json:
            print(json.dumps([{"scope": s, "category": c, "message": m} for s, c, m in findings], indent=2))
        else:
            print(render_collisions(findings))
        return 1 if (findings and args.exit_code_on_collision) else 0

    results = audit(scopes_filter)
    summary = summarize(results)
    top_handles = collect_handle_frequency(results)

    if args.json:
        print(json.dumps(summary, indent=2))
        return 0

    if args.diff:
        print(diff_against_baseline(summary, args.diff))
        print()

    print(render_summary(summary, top_handles=top_handles))

    if args.by_file:
        print("\n## Per-file detail\n")
        print(render_by_file(results))

    if args.by_handle:
        print("\n## Per-handle frequency\n")
        for handle, count in top_handles:
            print(f"- `{handle}`: {count}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
