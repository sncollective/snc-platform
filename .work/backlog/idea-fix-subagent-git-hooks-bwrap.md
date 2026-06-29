---
id: idea-fix-subagent-git-hooks-bwrap
created: 2026-06-29
updated: 2026-06-29
tags: [developer-experience, developer-experience]
---

# Fix subagent git/bwrap failure in the platform submodule (.git/hooks ENOTDIR)

Subagents spawned from the platform (submodule) working directory cannot run `git`
(or `bun`/test commands via bwrap). Every bash invocation fails before execution:

```
bwrap: Can't mkdir parents for /home/agent/SNC/platform/.git/hooks: Not a directory
```

## Root cause (diagnosed 2026-06-29)

- `platform/.git` is a 33-byte **file** (`gitdir: ../.git/modules/platform`), not a directory
  — standard for a git submodule.
- bwrap (the subagent sandbox) tries to `mkdir -p .git/hooks` literally in the submodule
  worktree. Since `.git` is a file (ENOTDIR), the mkdir fails before the actual command runs.
- The **orchestrator's** bash works fine (different sandbox config / runs without bwrap, or
  resolves the gitdir pointer). So this is a subagent-only failure, not a general git break.
- Onset was mid-wave: B1-B6 (security/tests/cruft/docs/patterns/refactor scanners + the first
  implementation bundles) committed normally; B7 onward could not commit. Suggests a
  sandbox/proxy state change during the session, not a code change. Worth confirming whether a
  fresh subagent still fails or whether it was transient.

## Workaround used this session

Orchestrator committed on each subagent's behalf after harvesting its completed edits —
workable but lossy (the per-item one-commit-per-item discipline degrades, and the orchestrator
must carefully attribute files when multiple agents edit concurrently). Not a fix.

## Candidate fixes (for scope time)

1. **Subagent cwd = parent repo root** (`/home/agent/SNC/platform` → `/home/agent/SNC`), where
   `.git` is a real directory. Subagents operate on the submodule via path prefixes. Cheapest
   if bwrap only fails on the submodule's file-as-`.git`.
2. **bwrap config / sandbox rule** to follow the gitdir pointer or skip the `.git/hooks` mkdir
   (the hook dir isn't needed for read-only/commit operations). Likely a pi harness or
   sandbox-forward setting.
3. **Pre-create the gitdir-resolved hooks dir** so bwrap's mkdir is a no-op — hacky.
4. **Confirm transience first**: spawn a trivial subagent that just runs `git status` from the
   platform cwd; if it works now, the mid-wave onset was a transient proxy/sandbox hiccup and
   no fix is needed (just a "re-spawn if it recurs" note).

Option 4 is the right first step — don't fix what may have been transient. Reproduce first.

## Context (why it mattered)

Surfaced during the 0.4.0 release gate + implementation drain, which fanned out ~13
implementation subagents. The failure meant every worker since B7 left its work uncommitted,
and the orchestrator had to commit-attributed-files per bundle manually — error-prone when
bundles touched adjacent files (M5/M6/M7 all edited API service files concurrently).
