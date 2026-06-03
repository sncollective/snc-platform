---
paths:
  - ".memory/**"
  - ".work/**"
  - ".claude/**"
  - "docs/**"
  - "**/AGENTS.md"
  - "**/CLAUDE.md"
  - "**/README.md"
---

# Path References

How to write file-path references inside documents so they survive viewer renders, link-checker validation, and the agent's cwd at edit or read time.

## Two reference forms

### Clickable references → markdown link with file-relative path

```
[item-convention.md](../../.claude/rules/item-convention.md)
```

File-relative paths are anchored to the source document's directory, not to any cwd. They work correctly:

- In IDE and GitHub viewers (universal markdown convention).
- For `scripts/check-doc-links.py`, which resolves markdown links file-relative-first.
- Regardless of where an agent is running — the link is always evaluated from the source file.

Use this form for any reference a reader might want to click on.

### Prose mentions → backtick with project-rooted path

```
... captured in `.research/analysis/briefs/foo.md`.
```

Project-rooted paths (starting with `.memory/`, `.claude/`, `docs/`, `reference/`, etc. — the prefixes the link-checker recognizes as repo-rooted or project-rooted) are unambiguous from any cwd. They don't render as links — they're prose mentions of files — but they work as agent-readable path hints in any reading context, and the link-checker validates them against `REPO_ROOT` and the source file's project-root.

Use this form when you want to name a file in passing without inviting navigation.

## Avoid

- **Backticks with file-relative paths** (`` `../research/foo.md` ``). The link-checker's backtick regex only matches paths starting with a project-rooted prefix; `..`-rooted backticks are silently unchecked. If a path matters enough to validate, use the markdown-link form.
- **Absolute paths** (`/workspaces/SNC/...`). Machine-specific; breaks in clones and on other developers' systems.
- **Relative paths in bash commands** when cwd is uncertain. Use absolute paths or `cd` to a known root first — relative bash paths depend on shell state, which shifts between agents and sessions.

## Why this works

Markdown-link file-relative paths work because file-relative resolution is a universal markdown convention, supported by every viewer and the link-checker.

Backtick project-rooted paths work because project-rooted paths are unambiguous — they don't depend on either the source file's location or the reader's cwd. They're anchored to the project root (the directory holding `.memory/`), so a backtick ref starting with `.memory/`, `.work/`, `.research/`, `.claude/`, or `docs/` resolves the same way from any reading context.

The combination covers: navigable references that survive a re-org and prose mentions that survive any context.

## Revisit if

- A new viewer or tool surfaces a third resolution mode that breaks one of these forms.
- The link-checker conventions change in a way that re-validates a discouraged form.
- A project structure emerges where neither form is practical (rare; would warrant a project-scoped variant).
