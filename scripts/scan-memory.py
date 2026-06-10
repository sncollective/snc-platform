#!/usr/bin/env python3
"""Scan .memory/, .work/, and .research/ for coherence problems.

Walks this project's own `.memory/` + `.work/` + `.research/` bands under the
project root. Six faces:
  - orphans          — files no other file references
  - schema           — frontmatter conformance against item-convention + the research-band catalogs
  - references       — citation-handle [handle]{N} + typed-edge related:.to: resolution
                       (.research/ tier only — narrower than scripts/check-doc-links.py
                       which handles markdown-link / backtick-path resolution everywhere)
  - durable-refs     — durable→.work/ markdown links / link-checked backtick paths
                       (durability-gradient enforcement per document-evolution.md
                       §Reference direction; durable = .memory/decisions/ + .claude/ +
                       .research/, .memory/sessions/ exempt; only concrete refs, not
                       convention templates)
  - stale-positions  — revisit_if conditions on decisions / research / analysis tier
                       parsed for structural-trip signals; flagged for human review
  - substrate-test   — per-descriptive-tier-artifact substrate-test prompt packets
                       written to scratchpad for sub-agent triage (opt-in; no inline LLM call)

Default face set: orphans + schema (cheap, no opt-in needed). references / durable-refs /
stale-positions / substrate-test are opt-in via --face. The lighter faces compose with the existing
check-doc-links.py + plugin lint (agentic-research) surfaces:

  - check-doc-links.py — broken markdown links (auto-runs in pre-commit)
  - plugin lint (agentic-research plugin's scripts/lint-citations.py) — anchor-and-drift
                              fabrication patterns + citation-chain integrity at attestation tier
                              (.research/attestation/<handle>.md scope)
  - scan-memory.py (this) — orphans + schema + .research/-tier reference resolution
                            + stale-position revisit_if + substrate-test packet generation
                            (walks .memory/, .work/, and .research/)

Usage:
    python3 scripts/scan-memory.py                                     # default faces
    python3 scripts/scan-memory.py --face=orphans                      # just orphans
    python3 scripts/scan-memory.py --face=durable-refs                 # durability-gradient worklist
    python3 scripts/scan-memory.py --face=stale-positions              # opt-in heavy face
    python3 scripts/scan-memory.py --face=substrate-test --out=.memory/scratchpad
                                                                       # write packets for triage
    python3 scripts/scan-memory.py --face=all                          # everything (heavier)
"""

import argparse
import re
import sys
from datetime import date
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent

SKIP_DIRS = {
    "node_modules", "dist", "build", ".output", ".next", ".vinxi",
    "coverage", ".bun-cache", ".tanstack", ".git",
    "scratchpad", "agents",
}

# Files relative to a .memory/ root that are expected to be unreferenced.
ORPHAN_EXEMPT_RELATIVE = {
    "log.md",
}

# Tier prefixes whose contents are standalone-by-design and exempt from
# orphan-check. Items live under `.work/`; project-meta (decisions, sessions)
# lives under `.memory/`.
#
#   archive/   — terminal, no incoming refs expected after archival (.work/)
#   backlog/   — parked ideas, unreferenced until promoted to active (.work/)
#   sessions/  — append-only episodic records, discoverable by date not link (.memory/)
#   releases/  — bundle files linked only via per-item `release_binding:` (.work/)
#   active/    — features and stories may legitimately be standalone (parent: null)
#                per item-convention; noise > signal at scale (.work/)
#   decisions/ — structured records findable by ID and tag;
#                decisions are entity pages, not narrative docs (.memory/)
ORPHAN_EXEMPT_WORK_TIERS = ("archive", "backlog", "releases", "active")
ORPHAN_EXEMPT_MEMORY_TIERS = ("sessions", "decisions")

# Mapping from active/archive kind-directory name to the singular kind value.
KIND_FROM_DIR = {"epics": "epic", "features": "feature", "stories": "story"}

VALID_STAGES = {"drafting", "implementing", "review", "done", "planned", "quality-gate", "released"}
VALID_KINDS = {"epic", "feature", "story", "release"}

VALID_PROVENANCE = {
    "source-direct", "agent-authored-from-raw", "agent-synthesis",
    "generated-listing", "hybrid-curated",
}

# Canonical `source_class` soft enum — the ARD baseline (mirrors the agentic-research plugin's
# catalogs.json §source_class; platform carries no in-tree ARD kernel, consuming ARD v0.5.1
# transitively via the plugin). Values outside it surface as informational consolidation
# candidates (soft-enum drift) per ARD's closed-with-extension recipe.
KNOWN_SOURCE_CLASSES = {
    "paper", "book-chapter", "essays", "tool-doc", "blog-post",
    "github-readme", "wiki-page", "light-form", "standard", "talk-podcast",
}
INDEX_SOURCE_CLASS_RE = re.compile(r"^-\s+\*\*Source class:\*\*\s+(.+?)\s*$", re.MULTILINE)

# Typed-edge predicates (the closed-with-extension subset per the typed-edge
# `related:` convention). Extensions are allowed but logged as informational, not error.
TYPED_EDGE_PREDICATES = {
    "cites", "citesAsEvidence", "extends", "refutes", "usesMethodIn",
    "obtainsBackgroundFrom", "grounds", "supports", "objects-to",
    "related", "implements", "contrasts",
}

MD_LINK_RE = re.compile(r"\[[^\]]*\]\(([^)]+\.md)\)")
BACKTICK_PATH_RE = re.compile(r"`([^\s`]+\.md)`")
CITATION_RE = re.compile(r"\[([\w-]+)\]\{(\d+)\}")
INDEX_ENTRY_RE = re.compile(
    r"^###\s+(\d+)\.\s+(.+?)\s+—\s+`([\w-]+)`\s*$",
    re.MULTILINE,
)
PENDING_RE = re.compile(r"^\s*\(pending\)\s*$", re.IGNORECASE)

# durable-refs face: durability-gradient enforcement per document-evolution.md
# §Reference direction. Durable tiers must not link into the transient `.work/`
# tier — such links rot when items archive or re-path. Mirrors check-doc-links.py
# extraction so illustrative example links (inline-code-wrapped) and convention
# templates (`.work/active/<slug>.md`) are not flagged — only concrete refs.
INLINE_CODE_RE = re.compile(r"`[^`\n]*`")
BACKTICK_WORK_RE = re.compile(r"`(\.work/[^\s`]+\.md)`")
WORK_TARGET_RE = re.compile(r"(?:^|/)\.work/")


def _is_template_placeholder(raw):
    """True for paths carrying template-shape markers — `[slug]`, `<version>`, `{name}`."""
    return ("[" in raw and "]" in raw) or ("<" in raw and ">" in raw) or ("{" in raw and "}" in raw)


# This is a self-contained project: there is a single local scope rooted at
# REPO_ROOT. The band-discovery helpers return [REPO_ROOT] when the band is
# present, [] otherwise — the downstream walks tolerate an absent band.


def find_memory_roots():
    """Return [REPO_ROOT] if this project has a .memory/ band, else []."""
    return [REPO_ROOT] if (REPO_ROOT / ".memory").is_dir() else []


def find_research_roots():
    """Return [REPO_ROOT] if this project has a .research/ band, else []."""
    return [REPO_ROOT] if (REPO_ROOT / ".research").is_dir() else []


def find_work_roots():
    """Return [REPO_ROOT] if this project has a .work/ band, else []."""
    return [REPO_ROOT] if (REPO_ROOT / ".work").is_dir() else []


def scope_label(project_root):
    return "project"


def walk_md_files(root):
    for md in root.rglob("*.md"):
        if any(part in SKIP_DIRS for part in md.parts):
            continue
        yield md


def parse_frontmatter(filepath):
    """Return (frontmatter_dict, body) or (None, full_text) if no/invalid frontmatter."""
    try:
        text = filepath.read_text(encoding="utf-8")
    except OSError:
        return None, ""
    if not text.startswith("---\n"):
        return None, text
    end = text.find("\n---\n", 4)
    if end == -1:
        end = text.find("\n---", 4)
        if end == -1:
            return None, text
    fm_text = text[4:end]
    body = text[end:]
    try:
        fm = yaml.safe_load(fm_text) or {}
    except yaml.YAMLError:
        return None, text
    if not isinstance(fm, dict):
        return None, text
    return fm, body


def extract_references(filepath):
    """Return set of absolute-path Paths referenced from a file.

    Sources: markdown links, backtick-wrapped paths, known frontmatter list fields
    (related_designs, related_decisions, related[].to).
    """
    refs = set()
    fm, body = parse_frontmatter(filepath)
    file_dir = filepath.parent

    # Frontmatter structured references
    if fm:
        for path_str in _as_list(fm.get("related_designs")):
            if isinstance(path_str, str):
                refs |= _resolve_reference(path_str, file_dir)
        for decision_id in _as_list(fm.get("related_decisions")):
            if isinstance(decision_id, str):
                # e.g. "platform-0007" → .memory/decisions/platform-0007-*.md
                refs |= _resolve_decision_id(decision_id)
        # Typed-edge related: per the typed-edge `related:` convention
        for entry in _as_list(fm.get("related")):
            if isinstance(entry, dict):
                target = entry.get("to")
                if isinstance(target, str):
                    refs |= _resolve_related_target(target, file_dir)

    # Prose references
    text = body if fm is not None else filepath.read_text(encoding="utf-8", errors="replace")
    for match in MD_LINK_RE.finditer(text):
        raw = match.group(1)
        if raw.startswith(("http://", "https://", "#", "mailto:")):
            continue
        if "[" in raw and "]" in raw:
            continue
        if "*" in raw or "?" in raw:
            continue
        target = raw.split("#", 1)[0]
        if not target:
            continue
        refs |= _resolve_reference(target, file_dir)
    for match in BACKTICK_PATH_RE.finditer(text):
        raw = match.group(1)
        if "[" in raw and "]" in raw:
            continue
        if "*" in raw or "?" in raw:
            continue
        refs |= _resolve_reference(raw, file_dir)
    return refs


def _as_list(value):
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def _resolve_reference(raw, file_dir):
    out = set()
    try:
        out.add((file_dir / raw).resolve())
    except OSError:
        pass
    # Project-rooted fallback for top-level prefixes
    if raw.startswith(("docs/", "apps/", "packages/", "reference/", ".memory/",
                       ".work/", ".claude/", "scripts/", ".research/")):
        try:
            out.add((REPO_ROOT / raw).resolve())
        except OSError:
            pass
    return out


def _resolve_decision_id(decision_id):
    """Map a decision id (e.g. `0007-<slug>` stem prefix) to its decision file path."""
    out = set()
    decisions_dir = REPO_ROOT / ".memory" / "decisions"
    if decisions_dir.is_dir():
        for match in decisions_dir.glob(f"{decision_id}-*.md"):
            out.add(match.resolve())
    return out


def _resolve_related_target(target, file_dir):
    """Resolve a typed-edge related: to: target. Accepts slug or relative path."""
    out = set()
    if target.endswith(".md") or "/" in target:
        out |= _resolve_reference(target, file_dir)
    else:
        # Bare slug — try decision-id form first, then fall back to known item IDs
        # under `.work/<tier>/`.
        out |= _resolve_decision_id(target)
        if not out:
            for tier in ("active", "archive", "backlog"):
                tier_dir = REPO_ROOT / ".work" / tier
                if not tier_dir.is_dir():
                    continue
                for match in tier_dir.rglob(f"{target}.md"):
                    out.add(match.resolve())
    return out


def check_orphans(memory_roots, work_roots, research_roots):
    """Return list of (scope, relative_path) for orphan files in .memory/, .work/, .research/."""
    all_refs = set()
    for md_file in walk_md_files(REPO_ROOT):
        all_refs |= extract_references(md_file)

    orphans = []
    for project_root in memory_roots:
        memory_dir = project_root / ".memory"
        if not memory_dir.is_dir():
            continue
        for md_file in walk_md_files(memory_dir):
            rel_to_memory = md_file.relative_to(memory_dir)
            if str(rel_to_memory) in ORPHAN_EXEMPT_RELATIVE:
                continue
            if rel_to_memory.parts and rel_to_memory.parts[0] in ORPHAN_EXEMPT_MEMORY_TIERS:
                continue
            if md_file.resolve() not in all_refs:
                orphans.append((scope_label(project_root), str(md_file.relative_to(REPO_ROOT))))

    # .work/ orphan walk: item-tier files. All four tiers are standalone-by-design
    # (see ORPHAN_EXEMPT_WORK_TIERS doc) — items rarely earn incoming refs.
    # Walk anyway for stray files at the .work/ root or in unexpected sub-dirs.
    for project_root in work_roots:
        work_dir = project_root / ".work"
        if not work_dir.is_dir():
            continue
        for md_file in walk_md_files(work_dir):
            rel_to_work = md_file.relative_to(work_dir)
            if rel_to_work.parts and rel_to_work.parts[0] in ORPHAN_EXEMPT_WORK_TIERS:
                continue
            if md_file.resolve() not in all_refs:
                orphans.append((scope_label(project_root), str(md_file.relative_to(REPO_ROOT))))

    # .research/ orphan walk: notes/, precis/, analysis/ only.
    # Skip reference/ (INDEX entries are upstream-only by design — see
    # .research/CONVENTIONS.md §Per-corpus INDEX shape) and reference/<corpus>/NOTES.md
    # (corpus-level extraction housekeeping, not per-piece notes).
    for project_root in research_roots:
        research_dir = project_root / ".research"
        if not research_dir.is_dir():
            continue
        for tier in ("notes", "precis", "analysis"):
            tier_dir = research_dir / tier
            if not tier_dir.is_dir():
                continue
            for md_file in walk_md_files(tier_dir):
                if md_file.resolve() not in all_refs:
                    orphans.append((scope_label(project_root), str(md_file.relative_to(REPO_ROOT))))

    return orphans


def collect_known_item_ids(memory_roots, work_roots):
    """Build set of all item IDs + filename stems across active / archive / backlog
    / releases tiers. Items live under `.work/`; the `.memory/` walk is a no-op
    where no items live there but is kept for robustness."""
    ids = set()
    band_targets = [(memory_roots, ".memory"), (work_roots, ".work")]
    for project_roots, band_name in band_targets:
        for project_root in project_roots:
            band_dir = project_root / band_name
            if not band_dir.is_dir():
                continue
            for tier in ("active", "archive", "backlog", "releases"):
                tier_dir = band_dir / tier
                if not tier_dir.is_dir():
                    continue
                for md_file in walk_md_files(tier_dir):
                    ids.add(md_file.stem)
                    fm, _ = parse_frontmatter(md_file)
                    if fm and isinstance(fm.get("id"), str):
                        ids.add(fm["id"])
    return ids


def check_schema(memory_roots, work_roots, research_roots):
    """Return list of (scope, relative_path, issue) for schema violations.

    Item tiers walk `.work/` (where items live); the `.memory/` walk is kept for
    robustness but is a no-op where no items live there. Research tier walks
    `.research/` as usual.
    """
    issues = []
    known_ids = collect_known_item_ids(memory_roots, work_roots)

    # Item-tier checks across both .memory/ (transitional) and .work/ (destination).
    item_band_targets = []
    for project_root in memory_roots:
        item_band_targets.append((project_root, project_root / ".memory"))
    for project_root in work_roots:
        item_band_targets.append((project_root, project_root / ".work"))

    for project_root, band_dir in item_band_targets:
        scope = scope_label(project_root)
        if not band_dir.is_dir():
            continue

        # Active tier — kind-grouped
        active_dir = band_dir / "active"
        if active_dir.is_dir():
            for kind_dir_name, expected_kind in KIND_FROM_DIR.items():
                kd = active_dir / kind_dir_name
                if not kd.is_dir():
                    continue
                for md_file in walk_md_files(kd):
                    issues.extend(_check_active_item(md_file, scope, expected_kind, known_ids))

        # Archive tier — kind-grouped, schema plus `archived:`
        archive_dir = band_dir / "archive"
        if archive_dir.is_dir():
            for kind_dir_name, expected_kind in KIND_FROM_DIR.items():
                kd = archive_dir / kind_dir_name
                if not kd.is_dir():
                    continue
                for md_file in walk_md_files(kd):
                    issues.extend(
                        _check_active_item(md_file, scope, expected_kind, known_ids, archive=True)
                    )

        # Backlog tier — minimal schema
        backlog_dir = band_dir / "backlog"
        if backlog_dir.is_dir():
            for md_file in walk_md_files(backlog_dir):
                rel = str(md_file.relative_to(REPO_ROOT))
                fm, _ = parse_frontmatter(md_file)
                if fm is None:
                    issues.append((scope, rel, "missing or unparseable frontmatter"))
                    continue
                if "created" not in fm:
                    issues.append((scope, rel, "missing required field: created"))

    # .research/ schema — per .research/CONVENTIONS.md
    for project_root in research_roots:
        scope = scope_label(project_root)
        research_dir = project_root / ".research"
        if not research_dir.is_dir():
            continue

        # INDEX.md per-corpus + per-piece field expectations
        for index_file in research_dir.rglob("INDEX.md"):
            issues.extend(_check_research_index(index_file, scope))

        # source_class soft-enum drift (informational consolidation candidates)
        issues.extend(_check_source_class_consolidation(research_dir, scope))

        # Per-piece notes (skip README — tier-level orientation, not a per-piece note)
        notes_dir = research_dir / "notes"
        if notes_dir.is_dir():
            for md_file in walk_md_files(notes_dir):
                if md_file.name == "README.md":
                    continue
                issues.extend(_check_research_note(md_file, scope))

        # Per-piece precises + per-source captures
        precis_dir = research_dir / "precis"
        if precis_dir.is_dir():
            for md_file in walk_md_files(precis_dir):
                if md_file.name == "README.md":
                    continue
                issues.extend(_check_research_precis(md_file, scope))

        # Analysis-tier
        analysis_dir = research_dir / "analysis"
        if analysis_dir.is_dir():
            for md_file in walk_md_files(analysis_dir):
                if md_file.name == "README.md":
                    continue
                issues.extend(_check_research_analysis(md_file, scope))

    return issues


def _check_active_item(md_file, scope, expected_kind, known_ids, archive=False):
    issues = []
    rel = str(md_file.relative_to(REPO_ROOT))
    fm, _ = parse_frontmatter(md_file)
    if fm is None:
        issues.append((scope, rel, "missing or unparseable frontmatter"))
        return issues

    required = ["id", "kind", "stage", "tags", "release_binding", "created", "updated", "parent"]
    if archive:
        required.append("archived")
    for field in required:
        if field not in fm:
            issues.append((scope, rel, f"missing required field: {field}"))

    if fm.get("kind") and fm["kind"] != expected_kind:
        issues.append((scope, rel, f"kind '{fm['kind']}' mismatches path kind '{expected_kind}'"))
    if fm.get("kind") and fm["kind"] not in VALID_KINDS:
        issues.append((scope, rel, f"invalid kind: {fm['kind']}"))
    if fm.get("stage") and fm["stage"] not in VALID_STAGES:
        issues.append((scope, rel, f"invalid stage: {fm['stage']}"))

    # Archive items should be stage: done
    if archive and fm.get("stage") and fm["stage"] != "done":
        issues.append((scope, rel, f"archive item has non-done stage: {fm['stage']}"))

    # Tags non-empty
    tags = fm.get("tags")
    if tags is not None and not tags:
        issues.append((scope, rel, "tags list is empty"))

    # ID matches filename stem where sensible
    expected_id = f"{expected_kind}-{md_file.stem}"
    if fm.get("id") and fm["id"] != expected_id:
        issues.append((scope, rel, f"id '{fm['id']}' doesn't match expected '{expected_id}'"))

    # Parent resolves
    parent = fm.get("parent")
    if parent and isinstance(parent, str) and parent not in known_ids:
        # try stripping kind prefix
        stripped = parent.split("-", 1)[1] if "-" in parent else parent
        if stripped not in known_ids:
            issues.append((scope, rel, f"parent '{parent}' does not resolve to a known item"))

    # Typed-edge related: vocabulary check
    for edge in _as_list(fm.get("related")):
        if isinstance(edge, dict):
            edge_type = edge.get("type")
            if edge_type and edge_type not in TYPED_EDGE_PREDICATES:
                # Extension allowed per the typed-edge convention, surface as informational
                issues.append(
                    (scope, rel, f"related: type '{edge_type}' not in 12-predicate subset (extension allowed; verify named source-ancestor)")
                )

    return issues


def _check_source_class_consolidation(research_dir, scope):
    """Surface `source_class` values outside the canonical ARD soft enum as consolidation
    candidates (informational — soft-enum drift per ARD's closed-with-extension recipe). Walks
    attestation frontmatter (`source_class:`) + per-corpus INDEX `Source class:` fields."""
    issues = []
    value_to_files = {}

    att_dir = research_dir / "attestation"
    if att_dir.is_dir():
        for md_file in sorted(att_dir.glob("*.md")):
            fm, _ = parse_frontmatter(md_file)
            if not fm:
                continue
            value = fm.get("source_class")
            if value and str(value).strip():
                value_to_files.setdefault(str(value).strip(), []).append(md_file)

    for index_file in research_dir.rglob("INDEX.md"):
        if any(part in SKIP_DIRS for part in index_file.parts):
            continue
        try:
            text = index_file.read_text(encoding="utf-8")
        except OSError:
            continue
        for m in INDEX_SOURCE_CLASS_RE.finditer(text):
            value = m.group(1).strip()
            if value and not PENDING_RE.match(value):
                value_to_files.setdefault(value, []).append(index_file)

    for value, files in sorted(value_to_files.items()):
        if value not in KNOWN_SOURCE_CLASSES:
            rel = str(files[0].relative_to(REPO_ROOT))
            issues.append((scope, rel,
                f"source_class consolidation candidate: '{value}' ({len(files)} file(s)) not in the "
                "canonical ARD soft enum — rename to a canonical value or coin it via the extension recipe"))
    return issues


def _check_research_index(index_file, scope):
    """Validate per-corpus INDEX.md per .research/CONVENTIONS.md §Per-corpus INDEX shape.

    Required per-piece fields: Source class, Author, Source URL, Original date,
    Ingested, Raw fetch, Notes, Themes, Covers. (pending) values are tolerated —
    INDEX is a growing surface; explicit (pending) is a deliberate gap-marker.
    """
    issues = []
    rel = str(index_file.relative_to(REPO_ROOT))
    try:
        text = index_file.read_text(encoding="utf-8")
    except OSError:
        issues.append((scope, rel, "unreadable"))
        return issues

    # Source license callout (informational — recommended but not required)
    if not re.search(r"^>\s*\*\*Source license:\*\*", text, re.MULTILINE):
        issues.append((scope, rel, "missing source license callout (`> **Source license:** <value>.`)"))

    required_fields = [
        "Source class", "Author", "Source URL", "Original date",
        "Ingested", "Raw fetch", "Notes", "Themes", "Covers",
    ]

    entries = list(INDEX_ENTRY_RE.finditer(text))
    if not entries:
        issues.append((scope, rel, "no bibliography entries detected (heading shape `### N. Title — \\`handle\\``)"))
        return issues

    # Block-extract per-entry text and check required fields
    for i, m in enumerate(entries):
        entry_num = m.group(1)
        handle = m.group(3)
        start = m.end()
        end = entries[i + 1].start() if i + 1 < len(entries) else len(text)
        block = text[start:end]
        for field in required_fields:
            field_re = re.compile(rf"^-\s+\*\*{re.escape(field)}:\*\*", re.MULTILINE)
            if not field_re.search(block):
                issues.append((scope, rel, f"entry {entry_num} (`{handle}`): missing field '{field}'"))
    return issues


def _is_descriptive_layer_path(md_file, research_dir):
    """Per .research/CONVENTIONS.md §Per-source vocab capture shape — capture files at
    .research/precis/<source-slug>-{surfaced,vocab}.md are descriptive-layer captures
    even though they live under precis/."""
    rel = md_file.relative_to(research_dir)
    return rel.parts[0] in ("notes", "precis")


def _check_research_note(md_file, scope):
    """Per-piece note schema per .research/CONVENTIONS.md §Per-piece note shape.

    Validates citation_handle (required) and provenance (validate-when-present;
    opportunistic-sweep posture per the page-level provenance decision means
    missing provenance is expected for untouched artifacts).
    """
    issues = []
    rel = str(md_file.relative_to(REPO_ROOT))
    fm, _ = parse_frontmatter(md_file)
    if fm is None:
        issues.append((scope, rel, "missing or unparseable frontmatter"))
        return issues
    if "citation_handle" not in fm:
        issues.append((scope, rel, "note: missing required field: citation_handle"))
    if "provenance" in fm:
        if fm["provenance"] not in VALID_PROVENANCE:
            issues.append((scope, rel, f"note: invalid provenance: {fm['provenance']}"))
        elif fm["provenance"] != "source-direct":
            issues.append((scope, rel, f"note: provenance '{fm['provenance']}' should be 'source-direct' per .research/CONVENTIONS.md"))
    return issues


def _check_research_precis(md_file, scope):
    """Precis + per-source-capture schema per .research/CONVENTIONS.md.

    Three artifact shapes share .research/precis/:
      <slug>.md                    — precis (source_handle, authored, provenance:agent-authored-from-raw)
      <source-slug>-surfaced.md    — hypothesis capture (source, arc, authored, status, provenance:agent-authored-from-raw)
      <source-slug>-vocab.md       — vocab capture (source, arc, authored, status, provenance:source-direct)
    """
    issues = []
    rel = str(md_file.relative_to(REPO_ROOT))
    fm, _ = parse_frontmatter(md_file)
    if fm is None:
        issues.append((scope, rel, "missing or unparseable frontmatter"))
        return issues

    stem = md_file.stem
    # provenance: validate-when-present per opportunistic-sweep posture
    # (opportunistic-sweep posture); other fields are required.
    if stem.endswith("-surfaced"):
        for field in ("source", "arc", "authored", "status"):
            if field not in fm:
                issues.append((scope, rel, f"hypothesis-capture: missing required field: {field}"))
        if fm.get("provenance") and fm["provenance"] != "agent-authored-from-raw":
            issues.append((scope, rel, f"hypothesis-capture: provenance '{fm['provenance']}' should be 'agent-authored-from-raw'"))
    elif stem.endswith("-vocab"):
        for field in ("source", "arc", "authored", "status"):
            if field not in fm:
                issues.append((scope, rel, f"vocab-capture: missing required field: {field}"))
        if fm.get("provenance") and fm["provenance"] != "source-direct":
            issues.append((scope, rel, f"vocab-capture: provenance '{fm['provenance']}' should be 'source-direct'"))
    else:
        for field in ("source_handle", "authored"):
            if field not in fm:
                issues.append((scope, rel, f"precis: missing required field: {field}"))
        if fm.get("provenance") and fm["provenance"] != "agent-authored-from-raw":
            issues.append((scope, rel, f"precis: provenance '{fm['provenance']}' should be 'agent-authored-from-raw'"))
    if fm.get("provenance") and fm["provenance"] not in VALID_PROVENANCE:
        issues.append((scope, rel, f"invalid provenance: {fm['provenance']}"))
    return issues


def _check_research_analysis(md_file, scope):
    """Analysis-tier schema per .research/CONVENTIONS.md §Analytic-layer ledger shape.

    Required (ledger): arc, authored, status, provenance (agent-synthesis).
    Other analysis-tier artifacts are flexible — only validate provenance.
    """
    issues = []
    rel = str(md_file.relative_to(REPO_ROOT))
    fm, _ = parse_frontmatter(md_file)
    if fm is None:
        # Placeholder files (e.g., empty .gitkeep-stub README) are tolerated
        return issues

    is_ledger = "ledger" in md_file.stem or md_file.parent.name == "hypothesis"
    if is_ledger:
        for field in ("arc", "authored", "status"):
            if field not in fm:
                issues.append((scope, rel, f"ledger: missing required field: {field}"))
        if fm.get("provenance") and fm["provenance"] != "agent-synthesis":
            issues.append((scope, rel, f"ledger: provenance '{fm['provenance']}' should be 'agent-synthesis'"))
    else:
        if "provenance" in fm and fm["provenance"] not in VALID_PROVENANCE:
            issues.append((scope, rel, f"invalid provenance: {fm['provenance']}"))
    return issues


def build_handle_index(research_root):
    """Build (handle → set of valid entry numbers) map from this project's
    `.research/reference/**/INDEX.md`. Citations resolve within the project's own
    reference band.
    """
    index = {}
    research_dir = research_root / ".research"
    if not research_dir.is_dir():
        return index
    for index_file in research_dir.rglob("INDEX.md"):
        try:
            text = index_file.read_text(encoding="utf-8")
        except OSError:
            continue
        for m in INDEX_ENTRY_RE.finditer(text):
            entry_num = int(m.group(1))
            handle = m.group(3)
            index.setdefault(handle, set()).add(entry_num)
    return index


def check_references(memory_roots, research_roots):
    """Resolve [handle]{N} citations + typed-edge related: targets across .research/.

    Distinct from check-doc-links.py (markdown-link / backtick-path resolution); narrower
    in scope (citation-handle to INDEX-entry resolution + related: target resolution).
    Coordinates with the agentic-research plugin's lint-citations.py at the citation-chain
    seam: that script resolves handles to attestation files at .research/attestation/<handle>.md;
    this check resolves to .research/reference/<corpus>/INDEX.md entries. Two
    resolution paths for the same handle form, by design.

    Handles resolve against this project's own reference band: `.research/`
    handles (and any transitional `.memory/research/` handles) resolve against
    `.research/reference/`.
    """
    issues = []
    # Per-project handle indexes
    indexes_by_project = {pr: build_handle_index(pr) for pr in research_roots}

    # Targets to walk paired with their owning project for handle-resolution scope.
    # Project key: the project_root whose INDEX entries should resolve handles in this file.
    targets = []
    for project_root in research_roots:
        research_dir = project_root / ".research"
        if research_dir.is_dir():
            targets.append((scope_label(project_root), research_dir, project_root))
    for project_root in memory_roots:
        rd = project_root / ".memory" / "research"
        if rd.is_dir():
            # .memory/research/ handles resolve against the same project's .research/.
            targets.append((scope_label(project_root), rd, project_root))

    for scope, root, owning_project in targets:
        handle_index = indexes_by_project.get(owning_project, {})
        for md_file in walk_md_files(root):
            rel = str(md_file.relative_to(REPO_ROOT))
            try:
                text = md_file.read_text(encoding="utf-8")
            except OSError:
                continue

            # Skip frontmatter for citation walk (handles in frontmatter are structured fields)
            fm, body = parse_frontmatter(md_file)
            check_text = body if fm is not None else text

            # Skip fenced code blocks
            stripped_text = _strip_code_blocks(check_text)

            for m in CITATION_RE.finditer(stripped_text):
                handle = m.group(1)
                n = int(m.group(2))
                # Suppress the literal placeholder `[handle]{N}` used in convention
                # docs to illustrate the citation form itself.
                if handle == "handle":
                    continue
                if handle not in handle_index:
                    issues.append((scope, rel, f"citation [{handle}]{{{n}}}: handle has no INDEX entry in this project's reference band"))
                elif n not in handle_index[handle]:
                    valid = sorted(handle_index[handle])
                    issues.append((scope, rel, f"citation [{handle}]{{{n}}}: N out of range; valid entries: {valid}"))

            # Typed-edge related: target resolution
            if fm:
                for edge in _as_list(fm.get("related")):
                    if not isinstance(edge, dict):
                        continue
                    target = edge.get("to")
                    if not isinstance(target, str):
                        continue
                    resolved = _resolve_related_target(target, md_file.parent)
                    if not any(p.exists() for p in resolved):
                        issues.append((scope, rel, f"related: to: '{target}' does not resolve to an existing file or known slug"))
    return issues


def _strip_code_blocks(text):
    """Replace fenced code blocks with blank lines and inline backtick code with spaces.
    Preserves line numbering so reported line numbers match source.
    """
    out_lines = []
    in_block = False
    for line in text.split("\n"):
        if line.lstrip().startswith("```"):
            in_block = not in_block
            out_lines.append("")
            continue
        if in_block:
            out_lines.append("")
            continue
        # Inline backtick code → replace with spaces of equal length
        out_lines.append(re.sub(r"`[^`\n]+`", lambda m: " " * len(m.group(0)), line))
    return "\n".join(out_lines)


# Heuristic patterns for revisit_if structural-trip detection.
# Conservative — high-confidence trips only; everything else flagged as candidate-review.
COUNT_THRESHOLD_RE = re.compile(
    r"\b(?:past|crosses|exceeds|grows past|reaches|hits)\s+~?(\d+)\s*(\w+)?",
    re.IGNORECASE,
)
DATE_THRESHOLD_RE = re.compile(
    r"\b(\d+)\s+months?\s+(?:past|after|since)\b",
    re.IGNORECASE,
)


def check_stale_positions(memory_roots, research_roots):
    """Walk decisions / research / analysis tier for revisit_if conditions.

    Per-condition prioritization:
      high   — structurally-tripped (count threshold met, date threshold met)
      medium — candidate-review (mentions checkable signals — counts, dates, named files)
      low    — too vague to check (behavioral patterns — 'agents pick inconsistently', etc.)
    """
    findings = []

    targets = []
    for project_root in memory_roots:
        decisions_dir = project_root / ".memory" / "decisions"
        if decisions_dir.is_dir():
            targets.append((scope_label(project_root), decisions_dir))
        research_tier = project_root / ".memory" / "research"
        if research_tier.is_dir():
            targets.append((scope_label(project_root), research_tier))
    for project_root in research_roots:
        analysis_dir = project_root / ".research" / "analysis"
        if analysis_dir.is_dir():
            targets.append((scope_label(project_root), analysis_dir))

    seen = set()
    for scope, root in targets:
        for md_file in walk_md_files(root):
            if md_file in seen:
                continue
            seen.add(md_file)
            rel = str(md_file.relative_to(REPO_ROOT))
            try:
                text = md_file.read_text(encoding="utf-8")
            except OSError:
                continue
            for cond in _extract_revisit_conditions(text):
                priority = _prioritize_condition(cond)
                findings.append((scope, rel, priority, cond.strip()))
    return findings


def _extract_revisit_conditions(text):
    """Extract bullet-form conditions from a `## Revisit if` section.

    Tolerates `## Revisit if`, `### Revisit if`, and frontmatter `revisit_if:` blocks.
    """
    conditions = []

    # Prose section
    for header_re in (r"^##\s+Revisit if\s*$", r"^###\s+Revisit if\s*$"):
        for sec_match in re.finditer(header_re, text, re.MULTILINE):
            section_start = sec_match.end()
            next_header = re.search(r"^##?\s+\w", text[section_start:], re.MULTILINE)
            section_end = section_start + next_header.start() if next_header else len(text)
            section = text[section_start:section_end]
            for line in section.split("\n"):
                stripped = line.strip()
                if stripped.startswith("- "):
                    cond = stripped[2:].strip()
                    if cond:
                        conditions.append(cond)

    # Frontmatter revisit_if: list
    fm_match = re.match(r"^---\n(.*?)\n---\n", text, re.DOTALL)
    if fm_match:
        try:
            fm = yaml.safe_load(fm_match.group(1))
            if isinstance(fm, dict):
                for cond in _as_list(fm.get("revisit_if")):
                    if isinstance(cond, str):
                        conditions.append(cond)
        except yaml.YAMLError:
            pass
    return conditions


def _prioritize_condition(cond):
    """Assign priority based on heuristic structural-check potential."""
    if COUNT_THRESHOLD_RE.search(cond):
        return "medium"  # structural cue exists; manual check still needed
    if DATE_THRESHOLD_RE.search(cond):
        return "medium"
    behavioral_signals = (
        "stops", "starts", "consistently", "repeatedly", "agents skip",
        "produces friction", "hard to apply", "feels orphan", "becomes urgent",
        "stays minimal", "stays empty", "drift", "calibration", "inconsistent",
    )
    if any(sig in cond.lower() for sig in behavioral_signals):
        return "low"
    return "low"


def _emit_substrate_test_packet(md_file, out_dir):
    """Generate per-artifact substrate-test packet for sub-agent triage.

    Sub-agent wrapping per ARD §5 Discipline propagation (carried via the agentic-research
    plugin; text-bundle inlined; sub-agents don't auto-load rules).

    No inline LLM call from the script — the packet is a self-contained prompt the
    user (or orchestrator) feeds to a sub-agent. Keeps script LLM-free and aligns with
    the scan-memory dispatcher pattern of write-to-scratchpad / human-or-agent-triage.
    """
    rel = md_file.relative_to(REPO_ROOT)
    packet_name = str(rel).replace("/", "__") + ".prompt.md"
    packet_path = out_dir / packet_name

    try:
        artifact_text = md_file.read_text(encoding="utf-8")
    except OSError:
        return None

    packet = (
        f"# Substrate-test packet — {rel}\n\n"
        "Spawn a sub-agent with this packet inlined. The sub-agent does NOT auto-load\n"
        "project rules per ARD §5 Discipline propagation (agentic-research plugin);\n"
        "the substrate-test framing below is the inlined text-bundle.\n\n"
        "## Substrate test (from ARD §4.3 The substrate test)\n\n"
        "Two questions answered yes/no with brief reasoning:\n\n"
        "1. **Could a non-SNC reader use this artifact without knowing SNC exists?**\n"
        "   Reads as the first descriptive-tier engagement with the source, not as\n"
        "   project-pointed editorial. Particular leak-points to check:\n"
        "   - **Stance hedonics** (*\"Useful as...\"*, *\"Earns ingestion as...\"*)\n"
        "   - **Corpus-comparative** (*\"the closest thing in the cooperative-charter corpus to...\"*)\n"
        "   - **Superlative-value** (*\"the cleanest articulation in the corpus of...\"*)\n"
        "   - **Under-specified cross-references** (*\"his media-business essay\"* without naming)\n\n"
        "2. **Does the artifact's prose paraphrase the source rather than synthesize across sources?**\n"
        "   Notes / precises are descriptive-tier — single-source engagement. Cross-source\n"
        "   synthesis belongs at the analytical tier; finding it here is a layer-violation.\n\n"
        "## Verdict format\n\n"
        "```yaml\n"
        "verdict: pass | fail\n"
        "leaks_found: [list of (line_number, leak_type, excerpt)]\n"
        "reasoning: <2-3 sentence summary>\n"
        "```\n\n"
        "## Artifact under review\n\n"
        f"Path: `{rel}`\n\n"
        "```markdown\n"
        f"{artifact_text}\n"
        "```\n"
    )
    packet_path.write_text(packet, encoding="utf-8")
    return packet_path


def emit_substrate_test_packets(research_roots, out_dir):
    """Walk descriptive-tier (.research/notes/, .research/precis/) and emit packets.

    Skips analytical-tier — substrate-test doesn't apply per ARD §Claim-level provenance
    markers > Where markers apply (carried via the agentic-research plugin).

    Skips per-source-capture vocab files (provenance: source-direct, by definition
    a quote+gloss form; substrate-test heuristic doesn't add signal).
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    written = []
    for project_root in research_roots:
        research_dir = project_root / ".research"
        if not research_dir.is_dir():
            continue
        for tier in ("notes", "precis"):
            tier_dir = research_dir / tier
            if not tier_dir.is_dir():
                continue
            for md_file in walk_md_files(tier_dir):
                if md_file.stem.endswith("-vocab"):
                    continue
                packet = _emit_substrate_test_packet(md_file, out_dir)
                if packet:
                    written.append(packet)
    return written


def check_durable_refs(memory_roots, research_roots):
    """Flag durable→.work/ markdown links and link-checked backtick paths.

    The durability gradient (document-evolution.md §Reference direction): durable
    tiers (.memory/decisions/, .claude/, .research/) must not carry a markdown
    link — or a link-checked backtick path — into the transient .work/ tier.
    Such references rot the moment an item archives or is re-pathed. Transient
    .work/ items freely reference durable substrate; the reverse is the violation.

    .memory/sessions/ is exempt (point-in-time snapshot tier) and is simply not
    walked — only .memory/decisions/ is scanned under .memory/.

    Extraction mirrors check-doc-links.py: fenced code blocks are skipped, inline
    code spans are stripped before markdown-link extraction (so example links like
    `[text](.work/active/features/x.md)` inside backticks are not flagged), and
    template-placeholder / glob paths (`.work/active/<slug>.md`, `**/feature.md`)
    are skipped — those describe the convention, not concrete items, and don't rot.

    Distinct from the references face (which resolves [handle]{N} citations +
    typed-edge related: targets) and from check-doc-links.py (which validates that
    markdown refs resolve). This face is direction-aware: a link into .work/ is a
    violation regardless of whether it currently resolves.
    """
    issues = []
    seen_dirs = set()
    project_roots = []
    for pr in list(memory_roots) + list(research_roots):
        if pr not in project_roots:
            project_roots.append(pr)

    for project_root in project_roots:
        scope = scope_label(project_root)
        durable_dirs = (
            project_root / ".memory" / "decisions",
            project_root / ".claude",
            project_root / ".research",
        )
        for ddir in durable_dirs:
            if not ddir.is_dir():
                continue
            key = ddir.resolve()
            if key in seen_dirs:
                continue
            seen_dirs.add(key)
            for md_file in walk_md_files(ddir):
                issues.extend(_scan_durable_file_for_work_refs(md_file, scope))
    return issues


def _scan_durable_file_for_work_refs(md_file, scope):
    issues = []
    rel = str(md_file.relative_to(REPO_ROOT))
    try:
        text = md_file.read_text(encoding="utf-8")
    except OSError:
        return issues

    in_fenced = False
    for i, line in enumerate(text.splitlines(), start=1):
        if line.lstrip().startswith("```"):
            in_fenced = not in_fenced
            continue
        if in_fenced:
            continue

        # Link-checked backtick paths: project-rooted `.work/...md` form.
        for m in BACKTICK_WORK_RE.finditer(line):
            raw = m.group(1)
            if _is_template_placeholder(raw) or "*" in raw or "?" in raw:
                continue
            issues.append((scope, rel, f"L{i}: backtick path → {raw}"))

        # Markdown links — strip inline code spans first so example bad-link
        # snippets wrapped in `...` aren't flagged.
        link_line = INLINE_CODE_RE.sub(" ", line)
        for m in MD_LINK_RE.finditer(link_line):
            raw = m.group(1)
            if raw.startswith(("http://", "https://", "#", "mailto:")):
                continue
            if _is_template_placeholder(raw) or "*" in raw or "?" in raw:
                continue
            target = raw.split("#", 1)[0]
            if WORK_TARGET_RE.search(target):
                issues.append((scope, rel, f"L{i}: markdown link → {raw}"))
    return issues


def main():
    parser = argparse.ArgumentParser(description="Scan .memory/ + .work/ + .research/ for coherence problems")
    parser.add_argument(
        "--face",
        choices=["orphans", "schema", "references", "durable-refs", "stale-positions", "substrate-test", "all"],
        action="append",
        help="Face(s) to run; repeat the flag for multiple. Default: orphans + schema. "
             "durable-refs flags durable→.work/ links per the durability gradient.",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=REPO_ROOT / ".memory" / "scratchpad",
        help="Output dir for substrate-test packets (default: .memory/scratchpad/)",
    )
    args = parser.parse_args()

    faces = set(args.face) if args.face else {"orphans", "schema"}
    if "all" in faces:
        faces = {"orphans", "schema", "references", "durable-refs", "stale-positions", "substrate-test"}

    memory_roots = find_memory_roots()
    work_roots = find_work_roots()
    research_roots = find_research_roots()

    if not memory_roots and not work_roots and not research_roots:
        print("No .memory/, .work/, or .research/ band found under the project root.", file=sys.stderr)
        return 1

    print(f"scan-memory: faces={','.join(sorted(faces))}\n")

    total = 0
    if "orphans" in faces:
        orphans = check_orphans(memory_roots, work_roots, research_roots)
        if orphans:
            print(f"=== Orphan pages ({len(orphans)}) ===")
            for scope, rel in orphans:
                print(f"  [{scope}] {rel}")
            print()
            total += len(orphans)
        else:
            print("=== Orphan pages: none ===\n")

    if "schema" in faces:
        schema_issues = check_schema(memory_roots, work_roots, research_roots)
        if schema_issues:
            print(f"=== Schema violations ({len(schema_issues)}) ===")
            for scope, rel, issue in schema_issues:
                print(f"  [{scope}] {rel}: {issue}")
            print()
            total += len(schema_issues)
        else:
            print("=== Schema violations: none ===\n")

    if "references" in faces:
        ref_issues = check_references(memory_roots, research_roots)
        if ref_issues:
            print(f"=== Reference resolution ({len(ref_issues)}) ===")
            for scope, rel, issue in ref_issues:
                print(f"  [{scope}] {rel}: {issue}")
            print()
            total += len(ref_issues)
        else:
            print("=== Reference resolution: clean ===\n")

    if "durable-refs" in faces:
        dref_issues = check_durable_refs(memory_roots, research_roots)
        if dref_issues:
            print(f"=== Durable→.work/ references ({len(dref_issues)}) ===")
            for scope, rel, issue in dref_issues:
                print(f"  [{scope}] {rel}: {issue}")
            print()
            total += len(dref_issues)
        else:
            print("=== Durable→.work/ references: none ===\n")

    if "stale-positions" in faces:
        findings = check_stale_positions(memory_roots, research_roots)
        if findings:
            print(f"=== Revisit-if conditions ({len(findings)}) ===")
            for priority in ("medium", "low"):
                bucket = [f for f in findings if f[2] == priority]
                if not bucket:
                    continue
                print(f"\n  {priority}:")
                for scope, rel, _prio, cond in bucket:
                    snippet = cond[:120] + ("…" if len(cond) > 120 else "")
                    print(f"    [{scope}] {rel}: {snippet}")
            print()
            # Don't add to error total — these are advisory by definition
            print(f"  ({len(findings)} conditions surfaced; advisory only — no error contribution)\n")
        else:
            print("=== Revisit-if conditions: none surfaced ===\n")

    if "substrate-test" in faces:
        packet_dir = args.out / f"scan-memory-substrate-test-{date.today().isoformat()}"
        packets = emit_substrate_test_packets(research_roots, packet_dir)
        if packets:
            print(f"=== Substrate-test packets ({len(packets)}) ===")
            print(f"  Written to: {packet_dir.relative_to(REPO_ROOT)}")
            print("  Spawn a sub-agent per packet to verdict; aggregate verdicts manually.")
            print("  Cost-control: this face is opt-in via --face=substrate-test (or --face=all).\n")
        else:
            print("=== Substrate-test packets: no descriptive-tier artifacts to scan ===\n")

    print(f"Total: {total} blocking issue(s).")
    return 1 if total > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
