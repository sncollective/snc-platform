---
name: platform-write-documentation
description: >
  Find gaps in project documentation and create missing docs. Use when the user wants to
  identify undocumented areas, write new documentation for features that lack it, or improve
  doc coverage. Trigger on "what's missing docs", "write docs for", "document the X module",
  "doc coverage", or "find undocumented".
argument-hint: "[area or module to document]"
disable-model-invocation: true
---

# Write Documentation — Doc Gap Finder and Author

You find undocumented areas of the platform and write the missing documentation. You follow
the same conventions as the existing docs — matching their structure, depth, and voice.

> **Run inline — do NOT spawn a subagent.** You need live context of the codebase to identify
> real gaps. Delegating forces lossy re-briefing and produces shallow docs.

## Phase 1: Discover the Doc Structure

Before looking for gaps, map what documentation already exists.

1. **Find doc roots** — look for `docs/`, `doc/`, `website/`, `site/`, `pages/`,
   `README.md`, `CHANGELOG.md`, or equivalent at the project root.
2. **Find internal specs** — look for `SPEC.md`, `ARCH.md`, `DESIGN.md`, `UX.md`,
   `ADR/`, `decisions/`, or similar technical reference docs.
3. **Find public-facing docs** — look for guide pages, reference pages, or a static site.
4. **Find generated files** — look for files with `# generated` comments, build scripts that
   concatenate docs, or files like `llms-full.txt`, `api.md`. Note these — never create docs
   that duplicate what a generator should produce.
5. **Find repo-specific skills** — check `.claude/skills/` for skills that encode domain
   knowledge. These are a signal of what's considered important enough to document.

Build a mental map: what topics are covered, what format each doc uses, what depth is typical.

## Phase 2: Identify the Target Area

### If `$ARGUMENTS` specifies an area

Proceed to Phase 3 scoped to that area (module, feature, directory, or concept).

### If `$ARGUMENTS` is empty

Scan the codebase for documentation gaps:

1. **List major modules/directories** — identify the top-level code areas (routes, services,
   models, utilities, config, middleware, etc.).
2. **Cross-reference against existing docs** — for each area, check whether docs exist that
   explain its purpose, usage, and key decisions.
3. **Identify gaps** — areas with no docs, outdated docs, or docs that cover only part of
   the module's functionality.
4. **Present a ranked list** — show the user a numbered list of gaps, ordered by impact:
   - Areas with zero documentation first
   - Areas where docs exist but are incomplete
   - Areas where docs are stale relative to code

```
## Documentation Gaps Found

1. **[area]** — [why it's undocumented / what's missing]
2. **[area]** — [why it's undocumented / what's missing]
...

Which area should I document? (pick a number or name)
```

Wait for the user to choose before proceeding.

## Phase 3: Assess the Gap

For the chosen area:

1. **Read the code** — understand what the module does, its public interface, key types,
   configuration, and how other parts of the codebase use it.
2. **Check for inline docs** — look for JSDoc, comments, or README fragments that partially
   document the area. These are inputs, not replacements for proper docs.
3. **Identify the right doc type** — match the gap to what's needed:

| Gap type | Doc to create | Placement |
|----------|--------------|-----------|
| Module with no explanation | Guide page or section | Alongside existing guides |
| API route undocumented | API reference entry | In API docs |
| Config options unexplained | Config reference | In config/reference docs |
| Architecture decision unmade/unrecorded | ADR | In decisions/ or ADR/ |
| Setup/onboarding gap | Getting started section | In README or setup guide |
| Complex flow undocumented | Architecture/flow doc | In specs or architecture docs |

4. **Match existing conventions** — read 1-2 neighboring docs of the same type to match:
   - Heading structure and depth
   - Tone and voice (terse reference vs. narrative guide)
   - Use of examples, tables, code blocks
   - File naming pattern

## Phase 4: Propose and Confirm

Before writing, present the plan to the user:

```
## Proposed Documentation

**File:** `path/to/new-doc.md`
**Type:** [guide / reference / ADR / etc.]
**Covers:**
- [topic 1]
- [topic 2]
- [topic 3]

**Modeled after:** `path/to/similar-existing-doc.md`

Create this doc?
```

Wait for user confirmation. Adjust scope if the user requests changes.

## Phase 5: Write

1. **Write the doc** — create the file following the conventions identified in Phase 3.
2. **Write from the code** — every claim in the doc must be traceable to actual code. Do not
   invent behavior or speculate about intent. If something is unclear, say so in the doc
   or ask the user.
3. **Include practical examples** — code snippets, config samples, or CLI invocations pulled
   from actual usage in the codebase. Don't fabricate examples.
4. **Cross-link** — reference related existing docs where relevant. Use relative links.

## Phase 6: Integrate

1. **Update indexes** — if the project has a doc index, table of contents, or sidebar config,
   add the new doc to it.
2. **Add cross-references** — if existing docs reference the newly documented area vaguely
   ("see X"), update them to link to the new doc.
3. **Regenerate generated files** — if a generated aggregate file exists (e.g., concatenated
   LLM ingestion file), regenerate it after adding the new doc.
4. **Run link checker** — if available, run the project's doc link checker to verify nothing
   is broken.

## Phase 7: Report

Tell the user:
- What file(s) were created (full paths)
- What indexes or cross-references were updated
- Any areas that still need documentation but were out of scope

## Anti-Patterns

- **Writing docs from imagination** — every statement must trace to code. If you can't find
  the behavior in code, don't document it.
- **Duplicating generated content** — if a doc should come from a generator, fix the generator
  or add to its source, don't create a parallel manual doc.
- **Over-documenting internals** — document public interfaces and behavior. Don't document
  every private helper unless the user specifically asks.
- **Ignoring existing voice** — if existing docs are terse and table-driven, don't write
  paragraphs of prose. Match the style.
- **Creating docs without updating indexes** — orphaned docs are invisible. Always integrate.
