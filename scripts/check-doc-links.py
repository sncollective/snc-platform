#!/usr/bin/env python3
"""Check cross-references between markdown docs for broken links.

Full-repo mode scans .md files under docs/, the output/substrate bands
(.memory/, .work/, .research/), and canon files (CLAUDE.md, AGENTS.md,
.claude/**), verifying that referenced targets exist.

This is a self-contained project: its docs must stand alone in a standalone
clone. The boundary walk below identifies any nested `.memory/`-bearing
sub-project and flags markdown links that escape its root; in a self-contained
project there are no nested sub-projects, so the walk simply finds nothing.

Usage:
    python3 scripts/check-doc-links.py                   # full scan + boundary check
    python3 scripts/check-doc-links.py --files a.md b.md  # staged-file mode (pre-commit hook)
"""

import argparse
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DOCS_DIR = REPO_ROOT / "docs"

# Project-rooted prefixes we treat as absolute references in backtick paths.
# `.memory/`, `.work/`, `.research/`, and `.claude/` cover memory-tier,
# item-tier, research-band, and agent-config files that canon docs reference.
ROOTED_GROUP = r"(?:docs|apps|packages|reference|\.memory|\.work|\.research|\.claude)"

# Patterns that capture doc references
# 1. Backtick paths: `.memory/decisions/foo.md`, `.work/active/baz.md`
BACKTICK_RE = re.compile(rf"`({ROOTED_GROUP}/[^\s`]+\.md)`")
# 2. Markdown links: [text](foo.md) or [text](../.work/active/bar.md)
MD_LINK_RE = re.compile(r"\[[^\]]*\]\(([^)]+\.md)\)")
# Inline code span — strip before extracting MD_LINK_RE so example
# markdown inside backticks (`[text](path.md)`) isn't flagged.
INLINE_CODE_RE = re.compile(r"`[^`\n]*`")


def is_historical_or_glob(raw: str) -> bool:
    """Skip glob patterns in backtick refs."""
    return "*" in raw or "?" in raw


def is_template_placeholder(raw: str) -> bool:
    """Skip paths containing template-shape markers — `[slug]`, `<version>`, `{name}`."""
    return ("[" in raw and "]" in raw) or ("<" in raw and ">" in raw) or ("{" in raw and "}" in raw)


# Tiers that are point-in-time snapshots rather than current-state — internal
# references are historical by design; the reader knows the file describes a
# past moment. `sessions/` lives under `.memory/`; `archive/` + `releases/`
# live under `.work/`. Active / canon / decisions / research are current-state
# and remain under the coherence check.
MEMORY_SNAPSHOT_TIERS = frozenset({"sessions"})
WORK_SNAPSHOT_TIERS = frozenset({"archive", "releases"})


def is_snapshot_tier(filepath: Path) -> bool:
    """Return True if filepath lives under a snapshot tier under any `.memory/` or `.work/` root."""
    parts = filepath.parts
    for i, part in enumerate(parts):
        if i + 1 >= len(parts):
            continue
        nxt = parts[i + 1]
        if part == ".memory" and nxt in MEMORY_SNAPSHOT_TIERS:
            return True
        if part == ".work" and nxt in WORK_SNAPSHOT_TIERS:
            return True
    return False


def find_references(
    filepath: Path, sub_projects: list[Path] | None = None
) -> list[tuple[int, str, str]]:
    """Return list of (line_number, raw_ref, resolved_path_or_None) from a file.

    Snapshot-tier files (`.memory/sessions/`, `.work/archive/`, `.work/releases/`)
    are skipped — their internal references are historical by design and not a
    coherence concern for current-state readers.

    Backtick paths in a nested sub-project file resolve relative to that
    sub-project's root. The self-containment convention forbids cross-boundary
    refs from a sub-project; this aligns the check.
    """
    if is_snapshot_tier(filepath):
        return []
    refs = []
    text = filepath.read_text(encoding="utf-8")
    file_dir = filepath.parent
    project_root = (
        find_sub_project_for(filepath, sub_projects) if sub_projects else None
    ) or REPO_ROOT

    in_fenced = False
    for i, line in enumerate(text.splitlines(), start=1):
        # Skip fenced code blocks — examples inside ``` are not live references.
        if line.lstrip().startswith("```"):
            in_fenced = not in_fenced
            continue
        if in_fenced:
            continue

        # Backtick paths are prose mentions. Accept either repo-rooted or
        # project-rooted resolution — whichever exists. Codebase convention
        # for backticks oscillates depending on the authoring cwd (agents
        # work from both root and sub-project roots); enforcing one is
        # brittle without real cross-boundary signal. The boundary check
        # still enforces the rule for markdown links (clickable refs).
        for match in BACKTICK_RE.finditer(line):
            raw = match.group(1)
            if is_template_placeholder(raw):
                continue
            if is_historical_or_glob(raw):
                continue
            candidates = [REPO_ROOT / raw, project_root / raw]
            resolved = next(
                (str(c) for c in candidates if c.exists()),
                str(candidates[0]),
            )
            refs.append((i, raw, resolved))

        # Strip inline code spans before extracting markdown links — example
        # bad-link snippets in rule files live inside `...`, shouldn't flag.
        link_line = INLINE_CODE_RE.sub(" ", line)

        # Markdown relative links
        for match in MD_LINK_RE.finditer(link_line):
            raw = match.group(1)
            # Skip external URLs (http/https)
            if raw.startswith(("http://", "https://")):
                continue
            if is_template_placeholder(raw):
                continue
            # Skip glob patterns
            if "*" in raw or "?" in raw:
                continue
            # Try file-relative resolution first; fall back to repo-rooted if that
            # doesn't exist and the path looks repo-rooted.
            relative = (file_dir / raw).resolve()
            if relative.exists() or not raw.startswith(
                ("docs/", "apps/", "packages/", "reference/")
            ):
                resolved = relative
            else:
                resolved = REPO_ROOT / raw
            refs.append((i, raw, str(resolved)))

    # Deduplicate (same line, same ref)
    seen = set()
    unique = []
    for line_no, raw, resolved in refs:
        key = (line_no, raw)
        if key not in seen:
            seen.add(key)
            unique.append((line_no, raw, resolved))
    return unique


def find_sub_projects() -> list[Path]:
    """Find any nested sub-project roots (dirs containing .memory/, excluding repo root).

    A self-contained project has no nested sub-projects, so this returns []. The
    walk is kept so the boundary check stays correct if a nested project is ever
    introduced.
    """
    sub_projects = []
    for depth_glob in ("*/.memory", "*/*/.memory", "*/*/*/.memory"):
        for memory_dir in REPO_ROOT.glob(depth_glob):
            if memory_dir.is_dir():
                sub_projects.append(memory_dir.parent)
    return sub_projects


def find_sub_project_for(file_path: Path, sub_projects: list[Path]) -> Path | None:
    """Return the nested sub-project root containing file_path, or None if at the project root."""
    try:
        abs_path = file_path.resolve()
    except OSError:
        return None
    for project_root in sub_projects:
        try:
            abs_path.relative_to(project_root)
            return project_root
        except ValueError:
            continue
    return None


def check_cross_boundary(filepath: Path, project_root: Path) -> list[tuple[int, str, str]]:
    """For files inside a sub-project, find any markdown link that escapes the project root.

    Returns list of (line_number, raw_link, resolved_path) for violations.
    """
    violations = []
    text = filepath.read_text(encoding="utf-8")
    file_dir = filepath.parent

    in_fenced = False
    for i, line in enumerate(text.splitlines(), start=1):
        if line.lstrip().startswith("```"):
            in_fenced = not in_fenced
            continue
        if in_fenced:
            continue
        for match in MD_LINK_RE.finditer(line):
            raw = match.group(1)
            # Skip external URLs and anchors
            if raw.startswith(("http://", "https://", "#", "mailto:")):
                continue
            # Skip template placeholders like [filename] / [slug]
            if "[" in raw and "]" in raw:
                continue
            # Strip URL fragment for resolution
            target = raw.split("#", 1)[0]
            if not target:
                continue
            resolved = (file_dir / target).resolve()
            try:
                resolved.relative_to(project_root)
            except ValueError:
                violations.append((i, raw, str(resolved)))
    return violations


def main():
    parser = argparse.ArgumentParser(description="Check doc cross-references")
    parser.add_argument("--files", nargs="+", metavar="PATH",
                        help="Check only the listed files (pre-commit mode). "
                             "Boundary checks still run for files inside nested sub-projects.")
    args = parser.parse_args()

    sub_projects = find_sub_projects()
    skip_dirs = {"node_modules", "dist", "build", ".output", ".next", ".vinxi",
                 "coverage", ".bun-cache", ".tanstack", "scratchpad", "agents"}

    if args.files:
        staged = []
        for f in args.files:
            p = Path(f) if Path(f).is_absolute() else REPO_ROOT / f
            if p.suffix == ".md" and p.exists():
                staged.append(p.resolve())
        md_files = sorted(set(staged))
        if not md_files:
            return 0
    else:
        memory_dir = REPO_ROOT / ".memory"
        work_dir = REPO_ROOT / ".work"
        research_dir = REPO_ROOT / ".research"
        # Canon files live at the project root (+ any nested sub-project root):
        # CLAUDE.md, AGENTS.md, README.md, and every .md under .claude/.
        canon_files = set()
        for project_root in [REPO_ROOT, *sub_projects]:
            for canon_name in ("CLAUDE.md", "AGENTS.md", "README.md"):
                p = project_root / canon_name
                if p.exists():
                    canon_files.add(p)
            claude_dir = project_root / ".claude"
            if claude_dir.is_dir():
                canon_files |= set(claude_dir.rglob("*.md"))
        md_files = sorted(
            (set(DOCS_DIR.rglob("*.md")) if DOCS_DIR.exists() else set())
            | (set(memory_dir.rglob("*.md")) if memory_dir.exists() else set())
            | (set(work_dir.rglob("*.md")) if work_dir.exists() else set())
            | (set(research_dir.rglob("*.md")) if research_dir.exists() else set())
            | canon_files
        )
        if not md_files:
            print("No markdown files found in docs/, .memory/, .work/, .research/, or canon files")
            return 0

    broken = []
    total_refs = 0

    for filepath in md_files:
        refs = find_references(filepath, sub_projects)
        total_refs += len(refs)
        rel_path = filepath.relative_to(REPO_ROOT)
        for line_no, raw, resolved in refs:
            if not Path(resolved).exists():
                broken.append((str(rel_path), line_no, raw))

    # Report
    if broken:
        print(f"Found {len(broken)} broken reference(s):\n")
        for filepath, line_no, raw in broken:
            print(f"  {filepath}:{line_no}  →  {raw}")
        print()
    else:
        print(f"All {total_refs} references OK across {len(md_files)} files.")

    # Cross-boundary check
    boundary_violations = []
    if args.files:
        # Check only staged files that live inside a sub-project
        for filepath in md_files:
            if any(part in skip_dirs for part in filepath.parts):
                continue
            owning_project = find_sub_project_for(filepath, sub_projects)
            if owning_project is None:
                continue
            violations = check_cross_boundary(filepath, owning_project)
            for line_no, raw, _resolved in violations:
                rel = str(filepath.relative_to(REPO_ROOT))
                boundary_violations.append((rel, line_no, raw, owning_project.name))
    else:
        # Full walk per sub-project (existing behavior)
        for project_root in sub_projects:
            for md_file in project_root.rglob("*.md"):
                if any(part in skip_dirs for part in md_file.parts):
                    continue
                violations = check_cross_boundary(md_file, project_root)
                for line_no, raw, _resolved in violations:
                    rel = str(md_file.relative_to(REPO_ROOT))
                    boundary_violations.append((rel, line_no, raw, project_root.name))

    if boundary_violations:
        print(f"\nFound {len(boundary_violations)} boundary violation(s) "
              "(markdown links escaping a nested sub-project's root):\n")
        for filepath, line_no, raw, project in boundary_violations:
            print(f"  [{project}] {filepath}:{line_no}  →  {raw}")
        print("\n  A project with its own .memory/ must be self-contained: no markdown")
        print("  link from inside its substrate (.memory/, .work/, .research/) may escape")
        print("  its root, so it survives a standalone clone. Convert the link to inline")
        print("  content or drop it if it isn't needed standalone.")
        print()
    elif sub_projects and not args.files:
        project_names = ", ".join(sorted(p.name for p in sub_projects))
        print(f"All sub-project boundaries OK ({project_names}).")

    if broken or boundary_violations:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
