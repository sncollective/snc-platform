---
name: scan-memory
description: "Periodic lint sweep over .memory/, .work/, and .research/ for this project. Six mechanical faces — cross-references (broken markdown links), orphan pages (content nothing references), schema violations (frontmatter drift from item-convention + the research-band catalogs), citation-handle / typed-edge reference resolution in .research/, durable→.work/ reference-direction violations (durability-gradient enforcement), and revisit-if structural-trip surfacing. Writes findings to .memory/scratchpad/ for review-first triage; no auto-promotion. Use when auditing memory-tier health, as the weekly scheduled entry point, or after heavy memory churn (layout pivots, migrations, convention shifts)."
argument-hint: "[--face=references|orphans|schema|durable-refs|stale-positions|substrate-test|all]"
allowed-tools: Bash, Read, Write
model: haiku
---

# scan-memory — Mechanical Lint Dispatcher

Periodic arm of the memory-lint operation. Six mechanical faces; script-backed, no LLM reasoning at runtime except the opt-in substrate-test face which emits prompt packets for sub-agent triage (still no inline LLM from the script). Complements the commit-time arm wired into pre-commit hooks via [scripts/check-doc-links.py](../../../scripts/check-doc-links.py) and the citation-tier arm via the agentic-research plugin's `scripts/lint-citations.py`.

See:
- [`.work/CONVENTIONS.md`](../../../.work/CONVENTIONS.md) — schema the schema face validates against.
- [.claude/rules/document-evolution.md](../../../.claude/rules/document-evolution.md) §Reference direction — the durability gradient the durable-refs face enforces.
- [`.research/CONVENTIONS.md`](../../../.research/CONVENTIONS.md) — the research-band shapes the schema, references, and substrate-test faces check against.

This project is self-contained. Its `.memory/` is the marker of that commitment: no markdown link from inside its substrate (`.memory/`, `.work/`, `.research/`) may escape the project root, so the project survives a standalone clone. The boundary check is part of `check-doc-links.py`'s walk; in a self-contained project there are no nested sub-projects, so the boundary face simply finds none.

## Step 0: Parse Arguments

`$ARGUMENTS` may contain:

- `--face=references|orphans|schema|durable-refs|stale-positions|substrate-test|all` — which check(s) to run. Default: `references + orphans + schema` (the cheap mechanical core). `durable-refs`, `stale-positions`, and `substrate-test` are opt-in.
- Bare names (`orphans`, etc.) also accepted as positional shortcuts.

If parsing is ambiguous, default to the cheap-mechanical-core face set.

## Step 1: Resolve Output Path

Scratchpad is gitignored; scan-memory writes one aggregated file per run.

```
OUTPUT = .memory/scratchpad/scan-memory-<YYYY-MM-DD>.md
```

If the output file already exists for today, append a timestamped section rather than overwrite — re-runs within a day are diagnostic, not canonical.

Create `.memory/scratchpad/` if it doesn't exist.

## Step 2: Run the Faces

Run in sequence, capturing stdout+stderr. Skip faces the user excluded.

**References face** (commands):
- `python3 scripts/check-doc-links.py` — walks the whole project at once: docs/, the substrate bands (`.memory/`, `.work/`, `.research/`), and canon files (CLAUDE.md, AGENTS.md, README.md, `.claude/**`).

**Orphans, schema, and `.research/`-references faces** (commands):
- Default cheap-mechanical-core (orphans + schema): `python3 scripts/scan-memory.py`
- Add `.research/` reference resolution: `python3 scripts/scan-memory.py --face=orphans --face=schema --face=references`
- Specific face: add one or more `--face=<name>` (repeatable).

**Durable-refs face** (opt-in; blocking):
- `python3 scripts/scan-memory.py --face=durable-refs` — flags markdown links / link-checked backtick `.md` paths from durable tiers (`.memory/decisions/` + `.claude/` + `.research/`) *into* the transient `.work/` tier, per [document-evolution.md](../../../.claude/rules/document-evolution.md) §Reference direction (the durability gradient — such refs rot when items archive/re-path). `.memory/sessions/` is exempt. Extraction mirrors `check-doc-links.py` (fenced-block skip, inline-code strip, template-placeholder + glob skip), so convention templates (`.work/active/<slug>.md`) and illustrative example links are not flagged — only concrete item references. Reports `file: Lnn: <kind> → <target>`, a navigable worklist. Distinct from `check-doc-links.py` (which validates refs resolve) — this face is direction-aware: a link into `.work/` is a violation regardless of whether it currently resolves. Contributes to the blocking-error total; remediate until clean.

**Stale-positions face** (opt-in; advisory):
- `python3 scripts/scan-memory.py --face=stale-positions` — walks `.memory/decisions/`, `.memory/research/`, `.research/analysis/` for `## Revisit if` and frontmatter `revisit_if:` blocks and surfaces them prioritized for human review (medium = mentions checkable signals; low = behavioral / vague). Output is advisory — does not contribute to the blocking-error total.

**Substrate-test face** (opt-in; LLM-cost; sub-agent triage):
- `python3 scripts/scan-memory.py --face=substrate-test --out .memory/scratchpad`
- Walks descriptive-tier `.research/notes/` + `.research/precis/` (`.research/notes/` may be absent — that's fine; skips analytical tier per ARD SPEC §4.6 layer-directionality; skips per-source `-vocab` files which are quote+gloss form by definition). Writes one self-contained prompt packet per artifact to `<out>/scan-memory-substrate-test-<date>/<rel-path>.prompt.md`. Each packet inlines the substrate-test framing (ARD SPEC §4.3) plus the artifact text. Spawn a sub-agent per packet to verdict; aggregate verdicts manually. Per ARD SPEC §5 (Discipline propagation), sub-agents do not auto-load rules — the packet is the inlined text-bundle.

If a script exits non-zero, record that in the output — non-zero means findings, not error (check stderr for actual errors vs. formatted findings).

## Step 3: Write Scratchpad File

Use this template. Fill sections with the captured output verbatim inside fenced blocks; add the summary from counts.

```markdown
# scan-memory — <YYYY-MM-DD HH:MM>

Faces: <faces>

## References (cross-reference checks)

\```
<check-doc-links.py output>
\```

## Orphans

\```
<scan-memory.py orphan output>
\```

## Schema

\```
<scan-memory.py schema output>
\```

## .research/ references — citation handles + typed-edge `related:` (when --face=references requested)

\```
<scan-memory.py references output>
\```

## Durable→.work/ references — reference-direction violations (when --face=durable-refs requested)

\```
<scan-memory.py durable-refs output>
\```

## Stale positions — revisit_if surfacing (when --face=stale-positions requested)

\```
<scan-memory.py stale-positions output>
\```

## Substrate-test packets (when --face=substrate-test requested)

Packets at `.memory/scratchpad/scan-memory-substrate-test-<date>/`. Spawn a sub-agent per packet; aggregate verdicts manually.

## Summary

- References (markdown links): <N> broken
- Orphans: <N> unreferenced candidates
- Schema: <N> frontmatter violations
- `.research/` reference resolution: <N> unresolved citation handles / `related:` targets
- Durable→.work/ references: <N> reference-direction violations (blocking — remediate to prose / durable-output links)
- Revisit-if conditions surfaced: <N> (advisory — manual review)
- Substrate-test packets emitted: <N>

**Triage paths** (review-first — this skill does not auto-promote):

1. **Fix inline** — edit the flagged file. Most schema violations are 30-second fixes.
2. **Promote to item** — open `/item-park <slug>` with findings as the matter, or `/scope` directly if the finding warrants active work.
3. **Dismiss** — if the finding is a legitimate exemption the lists don't cover yet, add it to `scripts/scan-memory.py` exemption constants or `scripts/check-doc-links.py` (for references). Note the dismissal reason in a comment.
```

## Step 4: Summarize to User

One-line-per-face summary, pointer to scratchpad:

```
scan-memory (2026-06-03):
  references: 2 broken links
  orphans: 4 unreferenced files
  schema: 2 frontmatter issues
  → full findings: .memory/scratchpad/scan-memory-2026-06-03.md
```

If total issues is 0, skip the pointer and just confirm: `scan-memory: clean sweep. No issues found.`

## Anti-patterns

- **Don't auto-promote findings.** The skill's job is to write the scratchpad; triage is a user decision per finding. Review-first is the contract.
- **Don't write multiple scratchpads per run.** One aggregated file per run. Fragmentation triples the reading cost.
- **Don't edit flagged files.** Triage is always user-initiated. The skill reports; the user decides fix / promote / dismiss.
- **Don't suppress output on zero findings.** A clean run is informative — confirms the sweep ran and the substrate is coherent.
- **Don't re-implement the scripts' logic in the skill.** The skill is a dispatcher. When the checks need refinement (new exemption class, new schema rule), update the scripts; the skill stays thin.

## Revisit if

- The two scripts' outputs start diverging in format such that combining them into one scratchpad section becomes awkward — unify their output contracts or add a script-side `--format=scan-memory` mode.
- `/scan-memory` starts to need classification of findings (severity, confidence) beyond what the scripts emit as plain text — add structured output (JSON) and have the skill format it.
