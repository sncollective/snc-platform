#!/usr/bin/env python3
"""Project .work/active/ and .work/backlog/ items into a tag-filtered view.

Scans items under this project's work tiers, filters by tag, and prints a
grouped markdown view to stdout. Designed to replace ad-hoc grep for "show me
everything tagged X" queries under the item/tag model defined in
.claude/rules/item-convention.md and tag-taxonomy.md.

Items live under `.work/{active,backlog,releases,archive}/`. Active and archive
tiers are kind-grouped (`epics/`, `features/`, `stories/`); backlog is flat.

Usage:
    python3 scripts/tag-view.py <tag>
    python3 scripts/tag-view.py content
    python3 scripts/tag-view.py refactor --tier=backlog
    python3 scripts/tag-view.py user-station --stage=implementing
    python3 scripts/tag-view.py content --include-done
    python3 scripts/tag-view.py workflow --kind=story
    python3 scripts/tag-view.py content --release-binding=0.2.1
    python3 scripts/tag-view.py workflow --group=stage
    python3 scripts/tag-view.py --ready                  # active items with deps satisfied
    python3 scripts/tag-view.py --blocked                # active items with an unmet dep
    python3 scripts/tag-view.py --ready refactor         # ready items also tagged refactor
    python3 scripts/tag-view.py --blocking some-slug     # items that depend on some-slug
"""

import argparse
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
# Single local scope — this project's own work tiers under REPO_ROOT.
SCOPE = "project"
ACTIVE_KIND_DIRS = ("epics", "features", "stories")
ALL_TIER_DIRS = ("active", "backlog", "releases", "archive")
TERMINAL_TIERS = ("releases", "archive")
READY_STAGES = ("drafting", "implementing", "review")


def parse_frontmatter(text: str, path: Path) -> dict | None:
    """Extract the YAML-ish frontmatter block at file start. Returns None if missing or malformed."""
    if not text.startswith("---\n"):
        return None
    end = text.find("\n---\n", 4)
    if end == -1:
        return None
    block = text[4:end]
    fm: dict = {}
    for line in block.splitlines():
        line = line.rstrip()
        if not line or line.startswith("#"):
            continue
        if line[:1] in (" ", "\t"):
            # Nested / continuation YAML (list items, block scalars). This
            # parser only models top-level scalar fields; indented lines are
            # not malformed, just unmodelled — skip them silently.
            continue
        m = re.match(r"^([\w-]+):\s*(.*)$", line)
        if not m:
            print(f"warning: malformed frontmatter line in {path}: {line!r}", file=sys.stderr)
            continue
        key, value = m.group(1), m.group(2).strip()
        if value.startswith("[") and value.endswith("]"):
            inner = value[1:-1].strip()
            fm[key] = [v.strip().strip("\"'") for v in inner.split(",") if v.strip()] if inner else []
        elif value in ("null", "~", ""):
            fm[key] = None
        else:
            fm[key] = value.strip("\"'")
    return fm


def iter_active_items():
    active = REPO_ROOT / ".work" / "active"
    if not active.is_dir():
        return
    for kind_dir in ACTIVE_KIND_DIRS:
        dir_path = active / kind_dir
        if not dir_path.is_dir():
            continue
        for path in sorted(dir_path.glob("*.md")):
            yield path


def iter_backlog_items():
    backlog = REPO_ROOT / ".work" / "backlog"
    if not backlog.is_dir():
        return
    for path in sorted(backlog.glob("*.md")):
        yield path


def load_item(path: Path) -> dict | None:
    try:
        text = path.read_text()
    except OSError as e:
        print(f"warning: could not read {path}: {e}", file=sys.stderr)
        return None
    fm = parse_frontmatter(text, path)
    if fm is None:
        return None
    fm["__path"] = path
    return fm


def matches_tag(item: dict, tag: str) -> bool:
    tags = item.get("tags") or []
    if isinstance(tags, str):
        tags = [tags]
    return tag in tags


def format_item_line(item: dict) -> str:
    path = item["__path"].relative_to(REPO_ROOT)
    kind = item.get("kind")
    kind_badge = f"[{kind}] " if kind else ""
    slug = item.get("id") or item["__path"].stem
    timestamp_key = "updated" if "updated" in item else "created"
    timestamp = item.get(timestamp_key)
    ts_str = f" — {timestamp_key} {timestamp}" if timestamp else ""
    return f"- {kind_badge}{slug} — `{path}`{ts_str}"


def matches_kind(item: dict, kind: str | None) -> bool:
    if kind is None:
        return True
    return item.get("kind") == kind


def matches_release_binding(item: dict, binding_filter: str | None) -> bool:
    if binding_filter is None:
        return True
    binding = item.get("release_binding")
    if binding_filter == "null":
        return binding is None
    if binding_filter == "any":
        return binding is not None
    return binding == binding_filter


def collect_matches(
    tag: str,
    include_active: bool,
    include_backlog: bool,
    stage_filter: str | None,
    include_done: bool,
    kind_filter: str | None,
    binding_filter: str | None,
) -> dict:
    """Return {"active": {stage: [items]}, "backlog": [items]} or {} when empty."""
    active: dict[str, list[dict]] = {}
    backlog: list[dict] = []
    if include_active:
        for path in iter_active_items():
            item = load_item(path)
            if not item or not matches_tag(item, tag):
                continue
            if not matches_kind(item, kind_filter):
                continue
            if not matches_release_binding(item, binding_filter):
                continue
            stage = item.get("stage") or "unknown"
            if not include_done and stage == "done":
                continue
            if stage_filter and stage != stage_filter:
                continue
            active.setdefault(stage, []).append(item)
    if include_backlog:
        for path in iter_backlog_items():
            item = load_item(path)
            if not item or not matches_tag(item, tag):
                continue
            if not matches_kind(item, kind_filter):
                continue
            if not matches_release_binding(item, binding_filter):
                continue
            if stage_filter:
                continue
            backlog.append(item)
    if active or backlog:
        return {"active": active, "backlog": backlog}
    return {}


def render_by_project(buckets: dict) -> list[str]:
    lines: list[str] = []
    stage_order = ["drafting", "implementing", "review", "done", "unknown"]
    active = buckets["active"]
    backlog = buckets["backlog"]
    if active:
        lines.append("## Active")
        lines.append("")
        ordered = [s for s in stage_order if s in active] + [s for s in active if s not in stage_order]
        for stage in ordered:
            lines.append(f"### {stage}")
            lines.append("")
            for item in sorted(active[stage], key=lambda i: i.get("id") or ""):
                lines.append(format_item_line(item))
            lines.append("")
    if backlog:
        lines.append("## Backlog")
        lines.append("")
        for item in sorted(backlog, key=lambda i: str(i["__path"])):
            lines.append(format_item_line(item))
        lines.append("")
    return lines


def render_by_stage(buckets: dict) -> list[str]:
    lines: list[str] = []
    stage_order = ["drafting", "implementing", "review", "done", "unknown"]
    by_stage: dict[str, list[dict]] = {}
    backlog_flat: list[dict] = []
    for stage, items in buckets["active"].items():
        for item in items:
            by_stage.setdefault(stage, []).append(item)
    for item in buckets["backlog"]:
        backlog_flat.append(item)
    ordered = [s for s in stage_order if s in by_stage] + [s for s in by_stage if s not in stage_order]
    for stage in ordered:
        lines.append(f"## {stage}")
        lines.append("")
        for item in sorted(by_stage[stage], key=lambda i: i.get("id") or ""):
            lines.append(format_item_line(item))
        lines.append("")
    if backlog_flat:
        lines.append("## backlog")
        lines.append("")
        for item in sorted(backlog_flat, key=lambda i: str(i["__path"])):
            lines.append(format_item_line(item))
        lines.append("")
    return lines


def render_flat(buckets: dict) -> list[str]:
    lines: list[str] = []
    rows: list[tuple[str, dict]] = []
    for stage, items in buckets["active"].items():
        for item in items:
            rows.append((stage, item))
    for item in buckets["backlog"]:
        rows.append(("backlog", item))
    for stage, item in sorted(rows, key=lambda r: (r[0], r[1].get("id") or "")):
        lines.append(format_item_line(item) + f" _({stage})_")
    if rows:
        lines.append("")
    return lines


# --- Dependency-graph queries (depends_on DAG) ---
# ready/blocked/blocking semantics: an item is terminal by tier
# (releases/archive) or by stage (done); a dependency is satisfied when its
# target resolves to a terminal item; an unknown dep id is treated as
# unsatisfied.


def iter_all_items():
    """Yield (tier, path) for every item .md across all `.work/` tiers.

    Used to build a cross-tier index so depends_on targets resolve and
    terminal-by-tier status is known. Recursive to tolerate kind-subdirs
    (active/archive) and per-version release dirs.
    """
    for tier in ALL_TIER_DIRS:
        base = REPO_ROOT / ".work" / tier
        if not base.is_dir():
            continue
        for path in sorted(base.rglob("*.md")):
            yield tier, path


def build_index() -> dict[str, dict]:
    """Map id -> item across all tiers, tagging __tier.

    First-wins on duplicate ids. Items without an id (e.g. release bundle
    files keyed by version) are skipped — they are not dependency targets.
    """
    index: dict[str, dict] = {}
    for tier, path in iter_all_items():
        item = load_item(path)
        if not item:
            continue
        item["__tier"] = tier
        item_id = item.get("id")
        if item_id and item_id not in index:
            index[item_id] = item
    return index


def get_depends_on(item: dict) -> list[str]:
    """Normalize the depends_on field to a list of ids.

    Tolerates an inline `# comment` after a scalar (the frontmatter parser
    doesn't strip them), so `depends_on: null  # was: foo` reads as no dep.
    """
    deps = item.get("depends_on")
    if deps is None:
        return []
    if isinstance(deps, str):
        scalar = deps.split("#", 1)[0].strip()
        if scalar in ("", "null", "~", "[]"):
            return []
        return [scalar]
    return [d for d in deps if d]


def is_terminal(item: dict) -> bool:
    if item.get("__tier") in TERMINAL_TIERS:
        return True
    return item.get("stage") == "done"


def unmet_deps(item: dict, index: dict[str, dict]) -> list[str]:
    """Subset of depends_on whose targets are non-terminal or unknown."""
    out: list[str] = []
    for dep_id in get_depends_on(item):
        dep = index.get(dep_id)
        if dep is None or not is_terminal(dep):
            out.append(dep_id)
    return out


def passes_filters(
    item: dict, tag: str | None, kind_filter: str | None, binding_filter: str | None
) -> bool:
    if tag is not None and not matches_tag(item, tag):
        return False
    if not matches_kind(item, kind_filter):
        return False
    if not matches_release_binding(item, binding_filter):
        return False
    return True


def render_dependency_view(
    mode: str,
    blocking_id: str | None,
    index: dict[str, dict],
    tag: str | None,
    stage_filter: str | None,
    kind_filter: str | None,
    binding_filter: str | None,
) -> str:
    headers = {
        "ready": "Ready items (active, all dependencies satisfied)",
        "blocked": "Blocked items (active, at least one unmet dependency)",
        "blocking": f"Items blocked by `{blocking_id}`",
    }
    lines: list[str] = [f"# {headers[mode]}", ""]

    rows: list[tuple[dict, list[str]]] = []  # (item, unmet)
    if mode in ("ready", "blocked"):
        for item in index.values():
            if item.get("__tier") != "active":
                continue
            stage = item.get("stage") or "unknown"
            if stage_filter:
                if stage != stage_filter:
                    continue
            elif stage not in READY_STAGES:
                continue
            if not passes_filters(item, tag, kind_filter, binding_filter):
                continue
            unmet = unmet_deps(item, index)
            satisfied = not unmet
            if (mode == "ready") == satisfied:
                rows.append((item, unmet))
    else:  # blocking
        for item in index.values():
            if blocking_id not in get_depends_on(item):
                continue
            if not passes_filters(item, tag, kind_filter, binding_filter):
                continue
            if stage_filter and (item.get("stage") or "unknown") != stage_filter:
                continue
            rows.append((item, unmet_deps(item, index)))

    if not rows:
        lines.append("_No matching items._")
        return "\n".join(lines).rstrip() + "\n"

    for item, unmet in sorted(rows, key=lambda r: r[0].get("id") or ""):
        line = format_item_line(item)
        if mode == "blocked" and unmet:
            line += f" — blocked on: {', '.join(unmet)}"
        if mode == "blocking":
            line += f" — stage {item.get('stage') or 'unknown'}"
        lines.append(line)
    lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def render(
    tag: str,
    include_active: bool,
    include_backlog: bool,
    stage_filter: str | None,
    include_done: bool,
    kind_filter: str | None,
    binding_filter: str | None,
    group_by: str,
) -> str:
    buckets = collect_matches(
        tag=tag,
        include_active=include_active,
        include_backlog=include_backlog,
        stage_filter=stage_filter,
        include_done=include_done,
        kind_filter=kind_filter,
        binding_filter=binding_filter,
    )
    lines: list[str] = [f"# Tag view: {tag}", ""]
    if not buckets:
        lines.append(f"_No items tagged `{tag}` in this project._")
        return "\n".join(lines).rstrip() + "\n"
    if group_by == "project":
        lines.extend(render_by_project(buckets))
    elif group_by == "stage":
        lines.extend(render_by_stage(buckets))
    else:
        lines.extend(render_flat(buckets))
    return "\n".join(lines).rstrip() + "\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("tag", nargs="?", help="Tag to filter by (optional with a dependency query)")
    parser.add_argument(
        "--tier",
        choices=["active", "backlog", "both"],
        default="both",
        help="Which tiers to scan (default: both)",
    )
    parser.add_argument("--stage", help="Filter active items by stage (e.g. implementing, review)")
    parser.add_argument(
        "--include-done",
        action="store_true",
        help="Include items at stage: done (excluded by default)",
    )
    parser.add_argument(
        "--kind",
        choices=["epic", "feature", "story"],
        help="Filter to items of a specific kind",
    )
    parser.add_argument(
        "--release-binding",
        help="Filter by release_binding: a version string, 'null' (unbound), or 'any' (bound to any release)",
    )
    parser.add_argument(
        "--group",
        choices=["project", "stage", "flat"],
        default="project",
        help="Output grouping: active → stage (default), stage, or flat list",
    )
    parser.add_argument(
        "--ready",
        action="store_true",
        help="List active items whose depends_on are all satisfied (depends_on DAG)",
    )
    parser.add_argument(
        "--blocked",
        action="store_true",
        help="List active items with at least one unmet dependency",
    )
    parser.add_argument(
        "--blocking",
        metavar="ID",
        help="List items that depend on ID (its dependents)",
    )
    args = parser.parse_args()

    dep_modes = [
        name for name, on in (("ready", args.ready), ("blocked", args.blocked), ("blocking", bool(args.blocking)))
        if on
    ]
    if len(dep_modes) > 1:
        parser.error("use only one of --ready / --blocked / --blocking at a time")
    if dep_modes:
        index = build_index()
        sys.stdout.write(
            render_dependency_view(
                mode=dep_modes[0],
                blocking_id=args.blocking,
                index=index,
                tag=args.tag,
                stage_filter=args.stage,
                kind_filter=args.kind,
                binding_filter=args.release_binding,
            )
        )
        return
    if not args.tag:
        parser.error("a tag is required unless you pass --ready / --blocked / --blocking")

    include_active = args.tier in ("active", "both")
    include_backlog = args.tier in ("backlog", "both")

    output = render(
        tag=args.tag,
        include_active=include_active,
        include_backlog=include_backlog,
        stage_filter=args.stage,
        include_done=args.include_done,
        kind_filter=args.kind,
        binding_filter=args.release_binding,
        group_by=args.group,
    )
    sys.stdout.write(output)


if __name__ == "__main__":
    main()
