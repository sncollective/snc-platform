#!/usr/bin/env python3
"""Lint research-tier briefs for anchor-and-drift fabrication patterns + citation-chain integrity.

Per `.claude/rules/research-band-spec.md` §4 (the anti-fabrication core) and
`.claude/rules/research-band-catalogs.md` §3 (lint pattern catalog +
citation-chain integrity check).

Two layers of mechanical defense complementing the architectural attestation primitive (F2)
and human Phase 10 spot-check (per the discipline):

1. Pattern flagger — regex-based detection of high-risk claim shapes that historically
   hosted anchor-and-drift fabrication (decimals with paper attributions; specific version
   numbers; file/word/page counts; comparative superlatives; named-feature claims; composed
   effort estimates).

2. Citation-chain verifier — every `[handle]{N}` resolves to an attestation file at the
   expected path; the attestation's source_handle matches the citation handle; provenance
   markers present.

Output: JSON to stdout (machine-readable) + markdown summary (human-readable, default to
stderr or --summary-file). Lint-only-warn by default (per F3/DD4); --exit-code-on opts into
blocking for explicit CI / pre-commit / workflow contexts.

Usage:
    python3 scripts/lint-research-claims.py [path-or-glob ...]
    python3 scripts/lint-research-claims.py --severity-min high --format json
    python3 scripts/lint-research-claims.py --exit-code-on high  # block on high-severity
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

# Citation handle regex per the citation wire-form (`.claude/rules/research-band-spec.md` §10.4)
CITATION_REGEX = re.compile(r"\[([\w-]+)\]\{(\d+)\}")

# Intra-program cite-through handle shape: `[cN-fM-*]{N}` resolving to a campaign
# specialist brief rather than an attestation file (per lint-research-claims-intra-program
# -citation-resolver backlog item). Strip the leading `cN-` to get the specialist filename.
INTRA_PROGRAM_PREFIX = re.compile(r"^c\d+-(.+)$")

# Citation-chain statuses that are NOT broken chains: resolved at attestation-tier; resolved as
# a recognized analytical-tier intra-program reference; or resolved to an attestation that is
# valid but deliberately marked reduced-substrate (search-summary / snippet depth — the
# substrate-confidence axis per `.claude/rules/research-band-catalogs.md` §2).
RESOLVED_STATUSES = {"resolved", "intra-program-resolved", "reduced-substrate-attestation"}

# Intra-program handle parse: `cN-<rest>` where rest is `parent`, `position-*`, or `fM-<slug>`
# (the slug may be an abbreviation of the specialist filename, so resolve by fM number).
INTRA_PROGRAM_HANDLE = re.compile(r"^(c\d+)-(.+)$")
FACET_PREFIX = re.compile(r"^(f\d+)\b")

# Pattern flagger — per-category regex specs.
# Severity reflects empirical reproduction risk per the four-reproduction substrate;
# tuned high-recall per F3/DD1 (accept false positives; T3 suppression manages noise).
PATTERN_SPECS = {
    "decimal-with-attribution": {
        "severity": "high",
        "description": "Decimal % adjacent to comparison/improvement language (43.3% / KAG / HippoRAG shape)",
        "regex": re.compile(
            r"\d+(?:\.\d+)?\s*%\s+(?:on|over|vs|versus|compared|improvement|better|gain|cheaper|faster|relative)\b",
            re.IGNORECASE,
        ),
    },
    "version-number": {
        "severity": "medium",
        "description": "Specific version number; risk of training-recall version-swap",
        "regex": re.compile(r"\bv?\d+\.\d+(?:\.\d+){0,2}(?:[-+]\w+)?\b"),
    },
    "count-without-unit-citation": {
        "severity": "medium",
        "description": "Specific count claim (files/words/pages/lines/chars)",
        "regex": re.compile(
            r"\b\d+(?:[\.,]?\d+)?[KMG]?\s+(?:files?|words?|pages?|lines?|chars?|stars?|commits?|contributors?)\b",
            re.IGNORECASE,
        ),
    },
    "comparative-superlative": {
        "severity": "high",
        "description": "Comparative superlative; risk of unsupported categorical claim",
        "regex": re.compile(
            r"\b(?:the\s+only\s+\w+|only\s+\w+\s+(?:that|with|which)\s|strongest\s+\w+|lowest\s+(?:effort|cost|friction)|highest\s+\w+|cleanest\s+(?:articulation|implementation|approach)|best[\s-]fit\b)",
            re.IGNORECASE,
        ),
    },
    "named-feature-claim": {
        "severity": "medium",
        "description": "Tool/system X 'has/supports/delivers Y native(ly)' — risk of training-recall feature attribution",
        "regex": re.compile(
            r"\b\w+\s+(?:has|supports|delivers|provides|enables|implements)\s+\w+(?:\s+\w+){0,3}\s+(?:native|natively|out[\s-]of[\s-]the[\s-]box|directly)\b",
            re.IGNORECASE,
        ),
    },
    "composed-effort-estimate": {
        "severity": "high",
        "description": "Effort estimate (developer-days, weeks, lines) — composed by definition",
        "regex": re.compile(
            r"\b(?:\d+[-–]\d+|\d+\s*(?:to|or)\s*\d+|~?\d+)\s*(?:developer[-\s])?days?\b"
            r"|\b(?:\d+[-–]\d+|~?\d+)\s*weeks?\b"
            r"|~?\d+\s*lines?\s+of\s+(?:python|code|\w+)?",
            re.IGNORECASE,
        ),
    },
}

SEVERITY_RANK = {"low": 0, "medium": 1, "high": 2}

# Per platform-0014, the pattern-category *enumeration* + the non-broken citation-status
# set are sourced from the vendored ARD catalog (`ard-kernel/catalogs.json`) at runtime,
# so a MINOR ARD inventory bump is a data change consumed here with no code edit. The
# matchers + severities in PATTERN_SPECS and the membership of RESOLVED_STATUSES above are
# SNC deployment latitude and the built-in fallback when the catalog is absent.
DEFAULT_CATALOGS_PATH = Path(__file__).resolve().parent.parent / "ard-kernel" / "catalogs.json"


def load_catalog_config(catalogs_path: Path) -> tuple[dict, set]:
    """Return (active pattern specs, non-broken citation-status set) sourced from the
    catalog's `lint` section. The category ids are the invariant; the per-category matcher
    + severity stay local (PATTERN_SPECS). Falls back to the built-in defaults when the
    catalog is missing/unreadable, so the lint keeps working without the data file."""
    try:
        with open(catalogs_path, encoding="utf-8") as fh:
            lint = json.load(fh)["lint"]
        cat_ids = [c["id"] for c in lint["pattern_categories"]]
        non_broken = {s["id"] for s in lint["citation_chain_statuses"] if not s["broken"]}
    except (OSError, KeyError, ValueError):
        return dict(PATTERN_SPECS), set(RESOLVED_STATUSES)
    specs = {cid: PATTERN_SPECS[cid] for cid in cat_ids if cid in PATTERN_SPECS}
    missing = [cid for cid in cat_ids if cid not in PATTERN_SPECS]
    if missing:
        print(f"[note] catalogs.json declares {len(missing)} pattern categor(ies) with no "
              f"matcher in this lint: {', '.join(missing)} — add a matcher to cover them.",
              file=sys.stderr)
    return specs, (non_broken or set(RESOLVED_STATUSES))


def parse_frontmatter(text: str) -> dict | None:
    """Lightweight YAML frontmatter parser; returns top-level scalar fields or None."""
    if not text.startswith("---\n"):
        return None
    end = text.find("\n---\n", 4)
    if end == -1:
        end = text.find("\n---", 4)
        if end == -1:
            return None
    fm_text = text[4:end]
    fm = {}
    for line in fm_text.split("\n"):
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or stripped.startswith("-"):
            continue
        if ":" not in line:
            continue
        k, _, v = line.partition(":")
        k = k.strip()
        v = v.strip()
        if v.startswith('"') and v.endswith('"'):
            v = v[1:-1]
        elif v.startswith("'") and v.endswith("'"):
            v = v[1:-1]
        fm[k] = v
    return fm


def frontmatter_end_line(lines: list[str]) -> int:
    """Return index after frontmatter, or 0 if no frontmatter."""
    if not lines or lines[0].rstrip() != "---":
        return 0
    for i in range(1, len(lines)):
        if lines[i].rstrip() == "---":
            return i + 1
    return 0


def code_block_mask(lines: list[str]) -> list[bool]:
    """Return per-line mask: True if inside a fenced code block."""
    mask = [False] * len(lines)
    in_block = False
    for i, line in enumerate(lines):
        if line.lstrip().startswith("```"):
            in_block = not in_block
            mask[i] = True  # the fence line itself
        else:
            mask[i] = in_block
    return mask


def is_blockquote(line: str) -> bool:
    return line.lstrip().startswith(">")


def is_in_url(line: str, pos: int) -> bool:
    """Check if position `pos` in line is inside a URL."""
    # Find URLs; check if pos overlaps any
    for m in re.finditer(r"https?://\S+", line):
        if m.start() <= pos < m.end():
            return True
    return False


def is_in_inline_code(line: str, pos: int) -> bool:
    """Check if position `pos` is inside backtick-quoted inline code."""
    in_code = False
    for i, ch in enumerate(line):
        if ch == "`":
            in_code = not in_code
        if i == pos:
            return in_code
    return False


def lint_patterns(brief_path: Path, lines: list[str], frontmatter: dict | None) -> list[dict]:
    """Run pattern flagger across brief; return findings list."""
    findings = []
    is_attestation = bool(frontmatter and frontmatter.get("provenance") == "source-direct")
    fm_end = frontmatter_end_line(lines)
    in_code = code_block_mask(lines)

    for line_idx, line in enumerate(lines):
        if line_idx < fm_end:
            continue
        if in_code[line_idx]:
            continue

        in_bq = is_blockquote(line)

        for category, spec in PATTERN_SPECS.items():
            for match in spec["regex"].finditer(line):
                # Per-category suppression rules
                if category == "version-number":
                    if is_in_url(line, match.start()):
                        continue
                    if is_in_inline_code(line, match.start()):
                        continue
                if category == "count-without-unit-citation":
                    if is_attestation:
                        # Inside attestation files, structural-metadata file/word/page counts are source-attested
                        continue
                    if is_in_inline_code(line, match.start()):
                        continue
                if category == "composed-effort-estimate":
                    if in_bq:
                        # Quoted from source; not a composed estimate
                        continue
                    if is_attestation:
                        continue
                if category == "decimal-with-attribution":
                    if is_attestation:
                        # Attestation files quote decimals from source; that's the discipline
                        continue
                if category == "comparative-superlative":
                    if in_bq:
                        # Quoted from source
                        continue

                excerpt_start = max(0, match.start() - 20)
                excerpt_end = min(len(line), match.end() + 20)
                excerpt = line[excerpt_start:excerpt_end].strip()

                findings.append(
                    {
                        "category": category,
                        "severity": spec["severity"],
                        "line": line_idx + 1,
                        "matched": match.group(0),
                        "excerpt": excerpt,
                    }
                )

    return findings


def repo_root(brief_path: Path) -> Path:
    """Find the ancestor dir containing `.research/` — anchors canonical lookups to the repo
    root rather than cwd. Walk the brief's ancestors first, then cwd's; fall back to cwd."""
    candidates = list(brief_path.resolve().parents) + [Path.cwd().resolve()] + list(Path.cwd().resolve().parents)
    for base in candidates:
        if (base / ".research").is_dir():
            return base
    return Path.cwd()


def find_attestation(handle: str, brief_path: Path, override: Path | None) -> Path | None:
    """Find the attestation file for a citation handle. Try override → sibling sources/ →
    canonical attestation tier (repo-root-anchored, not cwd-relative)."""
    if override is not None:
        candidate = override / f"{handle}.md"
        if candidate.exists():
            return candidate

    sibling = brief_path.parent / "sources" / f"{handle}.md"
    if sibling.exists():
        return sibling

    canonical = repo_root(brief_path) / ".research" / "attestation" / f"{handle}.md"
    if canonical.exists():
        return canonical

    return None


def find_intra_program(handle: str, brief_path: Path) -> Path | None:
    """Resolve an intra-program analytical-tier reference (NOT an attestation). These are valid
    `[handle]{N}` references at the analytical tier and must not report as `unresolved-handle`:

    - **position** — `positions/<handle>.md`.
    - **campaign specialist** — `[cN-fM-<slug>]` → `campaigns/*-cN-*/specialists/fM-*.md`. The
      handle slug is often an *abbreviation* of the filename (`c2-f3-gadamer-ricoeur` →
      `f3-gadamer-ricoeur-consolidation.md`), so resolve by campaign-number + facet-number, which
      are unique. Exact-slug glob is the fallback.
    - **campaign parent** — `[cN-parent]` / `[cN-position-*]` → `campaigns/*-cN-*/parent.md`
      (position candidates live in the campaign synthesis)."""
    root = repo_root(brief_path)
    campaigns = root / ".research" / "analysis" / "campaigns"

    position = root / ".research" / "analysis" / "positions" / f"{handle}.md"
    if position.exists():
        return position

    m = INTRA_PROGRAM_HANDLE.match(handle)
    if not m:
        return None
    cn, rest = m.group(1), m.group(2)

    if rest == "parent" or rest.startswith("position"):
        parents = sorted(campaigns.glob(f"*-{cn}-*/parent.md"))
        if parents:
            return parents[0]

    facet = FACET_PREFIX.match(rest)
    if facet:
        specs = sorted(campaigns.glob(f"*-{cn}-*/specialists/{facet.group(1)}-*.md"))
        if specs:
            return specs[0]

    exact = sorted(campaigns.glob(f"*/specialists/{rest}.md"))
    if exact:
        return exact[0]

    return None


def is_thin_attestation(att_path: Path) -> bool:
    """GR.5: an attestation that passes citation-chain integrity (file exists; source_handle
    matches; provenance present) but whose body paraphrases at whole-source granularity with
    NO per-section anchors (`##` headings) AND NO key-passage blockquotes — so it cannot support
    per-claim citation walks at section granularity. Per `.claude/rules/research-band-catalogs.md`
    §1 (GR.5 failure shape)."""
    try:
        lines = att_path.read_text().split("\n")
    except Exception:  # noqa: BLE001
        return False
    body = lines[frontmatter_end_line(lines):]
    has_blockquote = any(is_blockquote(line) for line in body)
    has_section = any(line.lstrip().startswith("##") for line in body)
    return not (has_blockquote or has_section)


def lint_citations(
    brief_path: Path,
    lines: list[str],
    attestation_dir: Path | None,
) -> list[dict]:
    """Run citation-chain verifier; return findings list."""
    findings = []
    fm_end = frontmatter_end_line(lines)
    in_code = code_block_mask(lines)

    for line_idx, line in enumerate(lines):
        if line_idx < fm_end:
            continue
        if in_code[line_idx]:
            continue

        for match in CITATION_REGEX.finditer(line):
            handle = match.group(1)
            n = int(match.group(2))

            attestation_path = find_attestation(handle, brief_path, attestation_dir)
            if attestation_path is None:
                intra = find_intra_program(handle, brief_path)
                if intra is not None:
                    findings.append(
                        {
                            "handle": handle,
                            "n": n,
                            "line": line_idx + 1,
                            "status": "intra-program-resolved",
                            "attestation_path": str(intra),
                        }
                    )
                    continue
                findings.append(
                    {
                        "handle": handle,
                        "n": n,
                        "line": line_idx + 1,
                        "status": "unresolved-handle",
                        "attestation_path": None,
                    }
                )
                continue

            att_text = attestation_path.read_text()
            att_fm = parse_frontmatter(att_text)

            if not att_fm:
                findings.append(
                    {
                        "handle": handle,
                        "n": n,
                        "line": line_idx + 1,
                        "status": "missing-provenance",
                        "attestation_path": str(attestation_path),
                        "detail": "attestation file has no frontmatter",
                    }
                )
                continue

            if att_fm.get("source_handle") != handle:
                findings.append(
                    {
                        "handle": handle,
                        "n": n,
                        "line": line_idx + 1,
                        "status": "mismatched-source-handle",
                        "attestation_path": str(attestation_path),
                        "detail": f"attestation source_handle: {att_fm.get('source_handle')!r} != citation handle: {handle!r}",
                    }
                )
                continue

            prov = att_fm.get("provenance")
            if prov != "source-direct":
                # An attestation deliberately marked reduced-substrate (search-summary / snippet
                # depth — the substrate-confidence axis per `.claude/rules/research-band-catalogs.md`
                # §2) is a valid-but-lower-depth
                # resolution, not a broken chain. Flag it distinctly so the depth is visible.
                if prov and ("search-summary" in prov or "snippet" in prov):
                    findings.append(
                        {
                            "handle": handle,
                            "n": n,
                            "line": line_idx + 1,
                            "status": "reduced-substrate-attestation",
                            "attestation_path": str(attestation_path),
                            "detail": f"reduced-substrate provenance: {prov!r} (not source-direct)",
                        }
                    )
                    continue
                findings.append(
                    {
                        "handle": handle,
                        "n": n,
                        "line": line_idx + 1,
                        "status": "missing-provenance",
                        "attestation_path": str(attestation_path),
                        "detail": f"attestation provenance: {prov!r} != 'source-direct'",
                    }
                )
                continue

            findings.append(
                {
                    "handle": handle,
                    "n": n,
                    "line": line_idx + 1,
                    "status": "resolved",
                    "attestation_path": str(attestation_path),
                }
            )

    return findings


def lint_brief(
    brief_path: Path,
    attestation_dir: Path | None,
    severity_min: str,
    skip_citations: bool,
) -> dict:
    """Lint a single brief; return structured findings."""
    text = brief_path.read_text()
    frontmatter = parse_frontmatter(text)
    lines = text.split("\n")

    pattern_findings = lint_patterns(brief_path, lines, frontmatter)
    citation_findings = [] if skip_citations else lint_citations(brief_path, lines, attestation_dir)

    min_rank = SEVERITY_RANK[severity_min]
    pattern_findings = [f for f in pattern_findings if SEVERITY_RANK[f["severity"]] >= min_rank]

    # GR.5 thin-attestation check: each unique resolved attestation, once.
    thin_findings: list[dict] = []
    seen_attestations: set[str] = set()
    for c in citation_findings:
        if c["status"] != "resolved":
            continue
        ap = c["attestation_path"]
        if ap is None or ap in seen_attestations:
            continue
        seen_attestations.add(ap)
        if is_thin_attestation(Path(ap)):
            thin_findings.append({"attestation_path": ap, "status": "thin-attestation", "severity": "medium"})

    summary = {
        "total_pattern_flags": len(pattern_findings),
        "high_severity": sum(1 for f in pattern_findings if f["severity"] == "high"),
        "medium_severity": sum(1 for f in pattern_findings if f["severity"] == "medium"),
        "low_severity": sum(1 for f in pattern_findings if f["severity"] == "low"),
        "total_citation_checks": len(citation_findings),
        "broken_chains": sum(1 for f in citation_findings if f["status"] not in RESOLVED_STATUSES),
        "intra_program_resolved": sum(1 for f in citation_findings if f["status"] == "intra-program-resolved"),
        "reduced_substrate": sum(1 for f in citation_findings if f["status"] == "reduced-substrate-attestation"),
        "thin_attestations": len(thin_findings),
    }

    return {
        "brief_path": str(brief_path),
        "brief_provenance": frontmatter.get("provenance") if frontmatter else None,
        "pattern_findings": pattern_findings,
        "citation_findings": citation_findings,
        "thin_findings": thin_findings,
        "summary": summary,
    }


def render_markdown(results: list[dict]) -> str:
    """Human-readable markdown summary across results."""
    out = ["# Research-claim lint summary\n"]

    n_briefs = len(results)
    total_pattern = sum(r["summary"]["total_pattern_flags"] for r in results)
    total_high = sum(r["summary"]["high_severity"] for r in results)
    total_chains = sum(r["summary"]["total_citation_checks"] for r in results)
    total_broken = sum(r["summary"]["broken_chains"] for r in results)
    total_intra = sum(r["summary"].get("intra_program_resolved", 0) for r in results)
    total_reduced = sum(r["summary"].get("reduced_substrate", 0) for r in results)
    total_thin = sum(r["summary"].get("thin_attestations", 0) for r in results)

    out.append(f"\n- {n_briefs} brief(s) linted")
    out.append(f"\n- {total_pattern} pattern flag(s) ({total_high} high-severity)")
    out.append(f"\n- {total_chains} citation chain check(s); {total_broken} broken, {total_intra} intra-program-resolved, {total_reduced} reduced-substrate")
    out.append(f"\n- {total_thin} thin attestation(s) (GR.5)")
    out.append("\n")

    flagged = [
        r for r in results
        if r["summary"]["total_pattern_flags"] > 0
        or r["summary"]["broken_chains"] > 0
        or r["summary"].get("thin_attestations", 0) > 0
    ]
    if not flagged:
        out.append("\nAll briefs clean.\n")
        return "".join(out)

    for r in flagged:
        out.append(f"\n## {r['brief_path']}\n")
        if r["pattern_findings"]:
            out.append("\n### Pattern flags\n\n")
            for f in r["pattern_findings"]:
                out.append(f"- L{f['line']} **{f['severity']}** [{f['category']}]: `{f['matched']}`\n")
        broken_citations = [c for c in r["citation_findings"] if c["status"] not in RESOLVED_STATUSES]
        if broken_citations:
            out.append("\n### Citation-chain issues\n\n")
            for c in broken_citations:
                detail = c.get("detail", "")
                out.append(f"- L{c['line']} `[{c['handle']}]{{{c['n']}}}` — **{c['status']}** {detail}\n")
        if r.get("thin_findings"):
            out.append("\n### Thin attestations (GR.5)\n\n")
            for t in r["thin_findings"]:
                out.append(f"- **thin-attestation** `{t['attestation_path']}` — no per-section anchors or key-passage blockquotes\n")

    return "".join(out)


def collect_files(paths: list[str]) -> list[Path]:
    """Collect markdown files from path arguments (files, dirs, or globs)."""
    files: list[Path] = []
    for arg in paths:
        p = Path(arg)
        if p.is_file() and p.suffix == ".md":
            files.append(p)
        elif p.is_dir():
            files.extend(sorted(p.rglob("*.md")))
        else:
            # Try as glob from cwd
            for matched in sorted(Path(".").glob(arg)):
                if matched.suffix == ".md":
                    files.append(matched)
    return files


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Lint research-tier briefs for anchor-and-drift fabrication patterns + citation-chain integrity.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("paths", nargs="*", default=[".research/analysis"], help="Path(s), dir(s), or glob(s) to lint (default: .research/analysis)")
    parser.add_argument("--attestation-dir", type=Path, help="Override default attestation lookup path")
    parser.add_argument("--format", choices=["json", "markdown", "both"], default="both", help="Output format (default: both)")
    parser.add_argument("--summary-file", type=Path, help="Write markdown summary to file (default: stderr)")
    parser.add_argument("--severity-min", choices=["low", "medium", "high"], default="low", help="Filter pattern findings (default: low)")
    parser.add_argument("--no-citation-check", action="store_true", help="Skip citation-chain verifier")
    parser.add_argument("--exit-code-on", choices=["high", "medium", "low", "none"], default="none", help="Exit code 1 if findings at-or-above severity (default: none)")
    parser.add_argument("--catalogs", type=Path, default=DEFAULT_CATALOGS_PATH, help="ARD catalog data to source the pattern-category + non-broken-status sets from (default: vendored ard-kernel/catalogs.json; falls back to built-ins if absent)")
    args = parser.parse_args()

    # Source the category enumeration + non-broken-status set from the vendored catalog
    # (platform-0014). Rebinds the module defaults once at startup so the lint functions
    # pick up the catalog-driven sets; a missing catalog falls back to the built-ins.
    global PATTERN_SPECS, RESOLVED_STATUSES
    PATTERN_SPECS, RESOLVED_STATUSES = load_catalog_config(args.catalogs)

    files = collect_files(args.paths)
    if not files:
        print("No markdown files found to lint.", file=sys.stderr)
        return 0

    results = []
    for f in files:
        try:
            results.append(lint_brief(f, args.attestation_dir, args.severity_min, args.no_citation_check))
        except Exception as e:  # noqa: BLE001 - lint script should be resilient
            print(f"WARNING: failed to lint {f}: {e}", file=sys.stderr)

    if args.format in ("json", "both"):
        json.dump(results, sys.stdout, indent=2)
        print()

    if args.format in ("markdown", "both"):
        md = render_markdown(results)
        if args.summary_file:
            args.summary_file.write_text(md)
        else:
            print(md, file=sys.stderr)

    if args.exit_code_on != "none":
        threshold = SEVERITY_RANK[args.exit_code_on]
        for r in results:
            for f in r["pattern_findings"]:
                if SEVERITY_RANK[f["severity"]] >= threshold:
                    return 1
            for c in r["citation_findings"]:
                if c["status"] not in RESOLVED_STATUSES:
                    return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
