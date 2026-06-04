#!/usr/bin/env python3
"""Project per-corpus Tag vocabulary (active) + per-piece Themes: into a union view.

Crawls .research/reference/**/INDEX.md files and:
  - Parses each corpus's "Tag vocabulary (active)" section (category headers + tags)
  - Parses per-piece Themes: fields within INDEX entries

Four operating modes:

  Default (no args):    all tags grouped by category, with per-tag corpus list
  <tag> argument:       project a specific tag — corpora + pieces that use it
  --synonyms:           flag near-synonyms for consolidation review
  --new:                list [NEW]-marked tags pending consolidation review

Usage:
    python3 scripts/reference-tag-view.py
    python3 scripts/reference-tag-view.py <tag>
    python3 scripts/reference-tag-view.py --synonyms
    python3 scripts/reference-tag-view.py --new
    python3 scripts/reference-tag-view.py --corpus <slug>
    python3 scripts/reference-tag-view.py --json
    python3 scripts/reference-tag-view.py <tag> --json
"""

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
# Platform research-band reference root. Tuple shape preserved against future
# multi-root needs.
REFERENCE_ROOTS = (
    PROJECT_ROOT / ".research" / "reference",
)

# Wiki INDEX files are generated and have no tag vocabulary — skip them.
# Pattern: any INDEX.md sitting under a /wiki/ subdirectory.
SKIP_PATTERN = re.compile(r"/wiki/")


# ---------------------------------------------------------------------------
# Parsing helpers
# ---------------------------------------------------------------------------

def corpus_slug(index_path: Path) -> str:
    """Return a human-readable corpus slug from an INDEX.md path.

    Slug is the path under whichever REFERENCE_ROOTS entry contains the INDEX.

    E.g.:
      .research/reference/papers/hipporag/INDEX.md       → papers/hipporag
      .research/reference/ghg-protocol/scope-2/INDEX.md   → ghg-protocol/scope-2
      .research/reference/books/truth-and-method/INDEX.md → books/truth-and-method
    """
    for root in REFERENCE_ROOTS:
        try:
            rel = index_path.parent.relative_to(root)
        except ValueError:
            continue
        return str(rel)
    # Fallback: project-relative path (shouldn't happen in normal use).
    return str(index_path.parent.relative_to(PROJECT_ROOT))


def parse_tag_vocabulary(text: str) -> dict[str, list[str]]:
    """Parse the '## Tag vocabulary (active)' section.

    Returns {category: [tag, ...]}. Category is the bolded prefix on each
    bullet line, e.g. '- **Engine / platform:**'. Tags are backtick-wrapped.
    Lines that are not bullet-category lines (intro prose, subsection headers,
    plain text) are parsed for raw backtick tags and added to a synthetic
    '' (uncategorised) category so nothing is silently dropped.

    Handles the bevan/ shape where the section just defers to kennedy/ (no
    actual bullet lines) — that results in an empty or minimal return.
    """
    # Locate the section
    section_match = re.search(
        r"^##\s+Tag vocabulary \(active\)",
        text,
        re.MULTILINE | re.IGNORECASE,
    )
    if not section_match:
        return {}

    # Extract text from section start to the next ## heading (or EOF)
    section_start = section_match.end()
    next_h2 = re.search(r"^##", text[section_start:], re.MULTILINE)
    if next_h2:
        section_text = text[section_start : section_start + next_h2.start()]
    else:
        section_text = text[section_start:]

    categories: dict[str, list[str]] = {}

    # Match lines of the form:   - **Category name:** `tag1`, `tag2`, ...
    # Also handles lines that start the category list on the same line.
    bullet_re = re.compile(
        r"^-\s+\*\*([^*:]+?)(?:\s*/\s*[^*:]+?)?\*\*\s*:\*?\*?\s*(.*)",
        re.MULTILINE,
    )
    # Simpler pattern: - **Label:** content
    bullet_re2 = re.compile(
        r"^-\s+\*\*([^*]+)\*\*:?\s*(.*)",
        re.MULTILINE,
    )

    tag_re = re.compile(r"`([^`]+)`")

    matched_spans: list[tuple[int, int]] = []

    for m in bullet_re2.finditer(section_text):
        category_raw = m.group(1).strip().rstrip(":")
        rest = m.group(2)
        tags = tag_re.findall(rest)
        if tags:
            categories.setdefault(category_raw, []).extend(tags)
            matched_spans.append((m.start(), m.end()))

    # Collect any backtick tags from non-bullet lines (intro lines, etc.)
    # to avoid silently dropping them.
    uncategorised: list[str] = []
    lines = section_text.splitlines()
    for line in lines:
        stripped = line.strip()
        # Skip lines that look like bullets (already handled above)
        if re.match(r"^-\s+\*\*", stripped):
            continue
        # Skip section headers
        if re.match(r"^###", stripped):
            continue
        tags_in_line = tag_re.findall(stripped)
        if tags_in_line:
            uncategorised.extend(tags_in_line)

    # Remove uncategorised tags that already appear in a category.
    all_categorised = {t for tags in categories.values() for t in tags}
    remaining = [t for t in uncategorised if t not in all_categorised]
    if remaining:
        categories.setdefault("(uncategorised)", []).extend(remaining)

    return categories


NEW_TAG_RE = re.compile(r"`([^`]+)`\s*\[NEW\]")


def parse_new_marked_tags(text: str) -> set[str]:
    """Return set of tag names marked [NEW] in the Tag vocabulary section.

    Tags carry [NEW] when coined during ingest — they're pending consolidation
    review per reference-conventions.md §Per-corpus INDEX shape. Promotion
    drops the [NEW] suffix; rejection merges or removes the tag.
    """
    section_match = re.search(
        r"^##\s+Tag vocabulary \(active\)",
        text,
        re.MULTILINE | re.IGNORECASE,
    )
    if not section_match:
        return set()

    section_start = section_match.end()
    next_h2 = re.search(r"^##", text[section_start:], re.MULTILINE)
    if next_h2:
        section_text = text[section_start : section_start + next_h2.start()]
    else:
        section_text = text[section_start:]

    return {m.group(1) for m in NEW_TAG_RE.finditer(section_text)}


def parse_themes_from_index(text: str) -> list[tuple[str, list[str]]]:
    """Parse per-piece Themes: field lines.

    Returns [(piece_title, [tag, ...]), ...].

    The Themes: field appears as:
        - **Themes:** tag1, tag2, tag3
    or occasionally in YAML-ish frontmatter of the note itself (handled
    separately in parse_themes_from_reading_note). Here we only look at
    INDEX-body Themes: fields.
    """
    results: list[tuple[str, list[str]]] = []

    # Find piece titles from INDEX heading entries (### Title) or bullet
    # title lines. We track the most recently seen "piece" context.
    current_title: str | None = None
    h3_re = re.compile(r"^###\s+(.+)", re.MULTILINE)
    themes_re = re.compile(r"^-\s+\*\*Themes:\*\*\s+(.+)", re.MULTILINE)

    # Build a list of (position, kind, content)
    events: list[tuple[int, str, str]] = []
    for m in h3_re.finditer(text):
        events.append((m.start(), "title", m.group(1).strip()))
    for m in themes_re.finditer(text):
        events.append((m.start(), "themes", m.group(1).strip()))

    events.sort(key=lambda e: e[0])

    current_title = None
    for _pos, kind, content in events:
        if kind == "title":
            current_title = content
        elif kind == "themes" and current_title is not None:
            tags = [t.strip().strip("`") for t in content.split(",") if t.strip()]
            if tags:
                results.append((current_title, tags))

    return results


def load_index(index_path: Path) -> dict | None:
    """Load and parse an INDEX.md file.

    Returns a dict with:
      corpus: str
      path: Path
      tag_vocabulary: {category: [tag]}  — from Tag vocabulary (active) section
      piece_themes: [(title, [tag])]      — from per-piece Themes: fields
      parse_warning: str | None
    """
    try:
        text = index_path.read_text(encoding="utf-8")
    except OSError as e:
        print(f"warning: could not read {index_path}: {e}", file=sys.stderr)
        return None

    slug = corpus_slug(index_path)
    tag_vocab = parse_tag_vocabulary(text)
    piece_themes = parse_themes_from_index(text)
    new_tags = parse_new_marked_tags(text)

    # Warn if neither section found (likely a wiki-generated INDEX without vocabulary)
    warning = None
    if not tag_vocab and not piece_themes:
        warning = "no tag vocabulary or Themes fields found"

    return {
        "corpus": slug,
        "path": index_path,
        "tag_vocabulary": tag_vocab,
        "piece_themes": piece_themes,
        "new_tags": new_tags,
        "parse_warning": warning,
    }


def discover_index_files() -> list[Path]:
    """Recursively find all INDEX.md files under each REFERENCE_ROOTS entry, skipping wiki dirs.

    Roots walked in declaration order; a missing root is tolerated. The `/wiki/`
    skip drops generated wiki INDEX files that carry no tag vocabulary.
    """
    paths = []
    for root in REFERENCE_ROOTS:
        if not root.is_dir():
            continue
        for p in sorted(root.rglob("INDEX.md")):
            if SKIP_PATTERN.search(str(p)):
                continue
            paths.append(p)
    return paths


# ---------------------------------------------------------------------------
# Aggregation
# ---------------------------------------------------------------------------

def build_union(
    corpora: list[dict],
    corpus_filter: str | None = None,
) -> dict:
    """Build a union data structure across all (or filtered) corpora.

    Returns:
      {
        # tag → {category, corpora_vocab, corpora_themes, pieces}
        # corpora_vocab: set of corpus slugs where tag appears in vocab section
        # corpora_themes: set of corpus slugs where tag appears in Themes: fields
        # pieces: [(corpus, title)] list of pieces tagged with this tag
        "tags": {
            tag: {
                "categories": set[str],        # from vocab sections
                "corpora_vocab": set[str],
                "corpora_themes": set[str],
                "pieces": [(corpus, title)],
            }
        },
        # category → [tag]  (ordered by first seen)
        "categories": defaultdict[str, list[str]],
        # warnings: [(corpus, warning)]
        "warnings": [(corpus, warning)],
      }
    """
    tags: dict[str, dict] = {}
    categories: dict[str, list[str]] = {}
    warnings: list[tuple[str, str]] = []
    new_tags: dict[str, set[str]] = defaultdict(set)

    def ensure_tag(tag: str) -> dict:
        if tag not in tags:
            tags[tag] = {
                "categories": set(),
                "corpora_vocab": set(),
                "corpora_themes": set(),
                "pieces": [],
            }
        return tags[tag]

    for corpus_data in corpora:
        slug = corpus_data["corpus"]
        if corpus_filter and slug != corpus_filter and not slug.startswith(corpus_filter + "/"):
            continue

        if corpus_data["parse_warning"]:
            warnings.append((slug, corpus_data["parse_warning"]))

        # Tag vocabulary
        for category, vocab_tags in corpus_data["tag_vocabulary"].items():
            if category not in categories:
                categories[category] = []
            for tag in vocab_tags:
                rec = ensure_tag(tag)
                rec["categories"].add(category)
                rec["corpora_vocab"].add(slug)
                if tag not in categories[category]:
                    categories[category].append(tag)

        # Piece themes
        for title, piece_tags in corpus_data["piece_themes"]:
            for tag in piece_tags:
                rec = ensure_tag(tag)
                rec["corpora_themes"].add(slug)
                rec["pieces"].append((slug, title))

        # [NEW]-marked tags
        for tag in corpus_data.get("new_tags", set()):
            new_tags[tag].add(slug)

    return {
        "tags": tags,
        "categories": categories,
        "warnings": warnings,
        "new_tags": dict(new_tags),
    }


# ---------------------------------------------------------------------------
# Near-synonym detection
# ---------------------------------------------------------------------------

def normalise(tag: str) -> str:
    """Strip hyphens and lowercase for drift comparison."""
    return tag.lower().replace("-", "").replace("_", "")


def plural_stem(tag: str) -> str:
    """Crude plural normalisation: strip trailing 's' or 'es'."""
    if tag.endswith("ies"):
        return tag[:-3] + "y"
    if tag.endswith("es") and len(tag) > 4:
        return tag[:-2]
    if tag.endswith("s") and len(tag) > 3:
        return tag[:-1]
    return tag


def find_synonyms(tags: list[str]) -> list[tuple[str, str, str]]:
    """Return [(tag_a, tag_b, reason), ...] for likely near-synonyms.

    Three heuristics:
    1. Singular/plural: after stripping trailing s/es/ies, stems match.
    2. Hyphen-drift: tags are identical after removing hyphens/underscores.
    3. Prefix similarity: one tag is a prefix of the other (length-aware;
       only when shorter tag >= 6 chars and prefix covers >= 75% of longer).
    """
    pairs: list[tuple[str, str, str]] = []
    seen: set[frozenset] = set()
    sorted_tags = sorted(tags)

    for i, a in enumerate(sorted_tags):
        for b in sorted_tags[i + 1 :]:
            key = frozenset([a, b])
            if key in seen:
                continue

            # Heuristic 1: singular/plural
            if plural_stem(a) == plural_stem(b) and a != b:
                pairs.append((a, b, "singular/plural"))
                seen.add(key)
                continue

            # Heuristic 2: hyphen/underscore drift
            norm_a = normalise(a)
            norm_b = normalise(b)
            if norm_a == norm_b and a != b:
                pairs.append((a, b, "hyphen-drift"))
                seen.add(key)
                continue

            # Heuristic 3: prefix similarity (only for non-trivially short tags)
            shorter, longer = (a, b) if len(a) <= len(b) else (b, a)
            if len(shorter) >= 6 and longer.startswith(shorter) and len(shorter) / len(longer) >= 0.75:
                pairs.append((a, b, "prefix-similarity"))
                seen.add(key)

    return pairs


# ---------------------------------------------------------------------------
# Rendering — default mode
# ---------------------------------------------------------------------------

def render_default(union: dict, json_out: bool) -> str:
    tags = union["tags"]
    categories = union["categories"]
    warnings = union["warnings"]

    if json_out:
        out = {}
        for category, cat_tags in sorted(categories.items()):
            out[category] = {}
            for tag in cat_tags:
                rec = tags[tag]
                all_corpora = sorted(rec["corpora_vocab"] | rec["corpora_themes"])
                out[category][tag] = {
                    "corpora": all_corpora,
                    "piece_count": len(rec["pieces"]),
                }
        # Tags appearing only in Themes (not in any vocab section)
        orphan_tags = {
            t: rec for t, rec in tags.items()
            if not rec["corpora_vocab"]
        }
        if orphan_tags:
            out["(themes-only — not in any vocab)"] = {
                tag: {
                    "corpora": sorted(rec["corpora_themes"]),
                    "piece_count": len(rec["pieces"]),
                }
                for tag, rec in sorted(orphan_tags.items())
            }
        return json.dumps(out, indent=2, sort_keys=False) + "\n"

    lines: list[str] = ["# Reference tag vocabulary — union view", ""]

    if warnings:
        lines.append("_Parse warnings (skipped or empty sections):_")
        for corpus, warning in warnings:
            lines.append(f"  - `{corpus}`: {warning}")
        lines.append("")

    if not categories and not tags:
        lines.append("_No tag vocabulary found across reference corpora._")
        return "\n".join(lines).rstrip() + "\n"

    # Categories from vocab sections
    for category, cat_tags in sorted(categories.items()):
        lines.append(f"## {category}")
        lines.append("")
        for tag in cat_tags:
            rec = tags[tag]
            all_corpora = sorted(rec["corpora_vocab"] | rec["corpora_themes"])
            corpus_str = ", ".join(f"`{c}`" for c in all_corpora)
            piece_note = f" ({len(rec['pieces'])} pieces)" if rec["pieces"] else ""
            lines.append(f"- `{tag}` — {corpus_str}{piece_note}")
        lines.append("")

    # Tags that appear only in Themes fields (not in any vocab section)
    orphan_tags = sorted(
        t for t, rec in tags.items() if not rec["corpora_vocab"]
    )
    if orphan_tags:
        lines.append("## (themes-only — not in any vocab section)")
        lines.append("")
        for tag in orphan_tags:
            rec = tags[tag]
            all_corpora = sorted(rec["corpora_themes"])
            corpus_str = ", ".join(f"`{c}`" for c in all_corpora)
            lines.append(f"- `{tag}` — {corpus_str} ({len(rec['pieces'])} pieces)")
        lines.append("")

    return "\n".join(lines).rstrip() + "\n"


# ---------------------------------------------------------------------------
# Rendering — single-tag projection mode
# ---------------------------------------------------------------------------

def render_tag(tag: str, union: dict, json_out: bool) -> str:
    tags = union["tags"]

    if tag not in tags:
        if json_out:
            return json.dumps({"tag": tag, "found": False}) + "\n"
        return f"# Tag: `{tag}`\n\n_Not found in any reference corpus._\n"

    rec = tags[tag]
    all_corpora = sorted(rec["corpora_vocab"] | rec["corpora_themes"])

    if json_out:
        return json.dumps({
            "tag": tag,
            "found": True,
            "categories": sorted(rec["categories"]),
            "corpora_vocab": sorted(rec["corpora_vocab"]),
            "corpora_themes": sorted(rec["corpora_themes"]),
            "pieces": [{"corpus": c, "title": t} for c, t in rec["pieces"]],
        }, indent=2) + "\n"

    lines: list[str] = [f"# Tag: `{tag}`", ""]

    cats = sorted(rec["categories"])
    if cats:
        lines.append(f"**Categories:** {', '.join(cats)}")
    else:
        lines.append("**Categories:** _(not in any vocab section — themes-only)_")
    lines.append("")

    lines.append(f"**Used in {len(all_corpora)} corpus/corpora:** {', '.join(f'`{c}`' for c in all_corpora)}")
    lines.append("")

    if rec["pieces"]:
        lines.append(f"**Pieces tagged ({len(rec['pieces'])}):**")
        lines.append("")
        # Group by corpus
        by_corpus: dict[str, list[str]] = defaultdict(list)
        for corpus, title in rec["pieces"]:
            by_corpus[corpus].append(title)
        for corpus in sorted(by_corpus):
            lines.append(f"- `{corpus}`")
            for title in by_corpus[corpus]:
                lines.append(f"  - {title}")
    else:
        lines.append("_No per-piece Themes: entries found for this tag._")

    return "\n".join(lines).rstrip() + "\n"


# ---------------------------------------------------------------------------
# Rendering — synonyms mode
# ---------------------------------------------------------------------------

def render_synonyms(union: dict, json_out: bool) -> str:
    all_tags = list(union["tags"].keys())
    pairs = find_synonyms(all_tags)

    if json_out:
        return json.dumps(
            [{"tag_a": a, "tag_b": b, "reason": r} for a, b, r in pairs],
            indent=2,
        ) + "\n"

    lines: list[str] = ["# Reference tag vocabulary — near-synonym candidates", ""]
    lines.append("Output is candidates for human consolidation review — not automatic merges.")
    lines.append("Framework-bound tags (kept corpus-local intentionally) should be left as-is.")
    lines.append("")

    if not pairs:
        lines.append("_No near-synonyms detected._")
        return "\n".join(lines).rstrip() + "\n"

    # Group by reason
    by_reason: dict[str, list[tuple[str, str]]] = defaultdict(list)
    for a, b, reason in pairs:
        by_reason[reason].append((a, b))

    reason_labels = {
        "singular/plural": "Singular / plural variants",
        "hyphen-drift": "Hyphen or separator drift",
        "prefix-similarity": "Prefix similarity",
    }

    for reason_key in ["singular/plural", "hyphen-drift", "prefix-similarity"]:
        if reason_key not in by_reason:
            continue
        lines.append(f"## {reason_labels[reason_key]}")
        lines.append("")
        for a, b in sorted(by_reason[reason_key]):
            rec_a = union["tags"][a]
            rec_b = union["tags"][b]
            corpora_a = sorted(rec_a["corpora_vocab"] | rec_a["corpora_themes"])
            corpora_b = sorted(rec_b["corpora_vocab"] | rec_b["corpora_themes"])
            lines.append(f"- `{a}` ({', '.join(corpora_a)})  ↔  `{b}` ({', '.join(corpora_b)})")
        lines.append("")

    return "\n".join(lines).rstrip() + "\n"


# ---------------------------------------------------------------------------
# Rendering — new-tags mode
# ---------------------------------------------------------------------------

def render_new(union: dict, json_out: bool) -> str:
    new_tags = union["new_tags"]
    tags = union["tags"]

    if json_out:
        out = {}
        for tag in sorted(new_tags):
            rec = tags.get(tag, {})
            out[tag] = {
                "corpora": sorted(new_tags[tag]),
                "categories": sorted(rec.get("categories", set())),
            }
        return json.dumps(out, indent=2) + "\n"

    lines: list[str] = ["# Reference tag vocabulary — [NEW]-marked tags pending consolidation", ""]

    if not new_tags:
        lines.append("_No [NEW] tags found across reference corpora._")
        return "\n".join(lines).rstrip() + "\n"

    lines.append("Tags coined during ingest awaiting consolidation review.")
    lines.append("Promotion drops the `[NEW]` suffix; rejection merges or removes the tag.")
    lines.append("")

    for tag in sorted(new_tags):
        rec = tags.get(tag, {})
        corpora = sorted(new_tags[tag])
        categories = sorted(rec.get("categories", set()))
        cat_str = " / ".join(categories) if categories else "(uncategorised)"
        corpora_str = ", ".join(f"`{c}`" for c in corpora)
        lines.append(f"- `{tag}` [{cat_str}] — {corpora_str}")

    lines.append("")
    return "\n".join(lines).rstrip() + "\n"


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "tag",
        nargs="?",
        help="Project a specific tag — list every corpus and reading-note that uses it.",
    )
    parser.add_argument(
        "--synonyms",
        action="store_true",
        help="Flag near-synonyms (singular/plural, hyphen-drift, prefix similarity) for review.",
    )
    parser.add_argument(
        "--new",
        action="store_true",
        help="List [NEW]-marked tags across corpora pending consolidation review.",
    )
    parser.add_argument(
        "--corpus",
        metavar="SLUG",
        help="Scope output to a single corpus (e.g. kennedy, failbetter/blog).",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Machine-readable JSON output.",
    )
    args = parser.parse_args()

    if args.tag and (args.synonyms or args.new):
        parser.error("--synonyms / --new and a tag argument are mutually exclusive.")
    if args.synonyms and args.new:
        parser.error("--synonyms and --new are mutually exclusive.")

    # Discover and load
    index_files = discover_index_files()
    corpora: list[dict] = []
    for p in index_files:
        data = load_index(p)
        if data is not None:
            corpora.append(data)

    if not corpora:
        print("No INDEX.md files found under .research/reference/.", file=sys.stderr)
        sys.exit(1)

    union = build_union(corpora, corpus_filter=args.corpus)

    if args.new:
        output = render_new(union, json_out=args.json)
    elif args.synonyms:
        output = render_synonyms(union, json_out=args.json)
    elif args.tag:
        output = render_tag(args.tag, union, json_out=args.json)
    else:
        output = render_default(union, json_out=args.json)

    sys.stdout.write(output)


if __name__ == "__main__":
    main()
