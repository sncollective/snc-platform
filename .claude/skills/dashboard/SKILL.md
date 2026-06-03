---
name: dashboard
description: "Shows a dashboard of active and backlog items — kinds, stages, tags, and counts. Use for session orientation, checking what's in flight, or status checks. Trigger on 'dashboard', 'status', 'what's in progress', 'what am I working on', 'what's open', 'show items', 'catch me up', 'orient me', 'fresh load', 'what do you see', 'what's the state'."
argument-hint: "[--tag=<tag>] [--stage=<stage>] [--full] [--all]"
---

# dashboard — Item Dashboard

Orientation snapshot across the `.work/` tiers. Default invocation is **compact** (counts + epic names + review queue) so it flows mid-conversation without flooding the transcript; `--full` or any filter flag expands into per-item listings.

See `.claude/rules/item-convention.md` for item structure and `.claude/rules/tag-taxonomy.md` for tags. The `scripts/tag-view.py` script is a related tool focused on single-tag filtering; this skill presents the aggregate view.

## Step 1: Parse Arguments

Defaults (no args): **compact orientation snapshot** — counts, epic names in flight, items at `stage: review`. No per-stage drill-down.

Flags:
- `--full` — full per-stage item listing (pre-compact default). Pairs with `--all` to include `done`.
- `--tag=<tag>` — filter to items carrying that tag (equivalent to `scripts/tag-view.py <tag>`; delegate or render inline). Implies per-item output.
- `--stage=<stage>` — filter active items to a specific stage (e.g. `--stage=review` to see what's awaiting sign-off). Implies per-item output.
- `--all` — include `stage: done` items (excluded by default to focus on in-flight work).

If a positional argument looks like a tag (no leading dashes), treat it as `--tag=<that>`.

## Step 2: Scan

- Active tier: glob `.work/active/epics/*.md`, `.work/active/features/*.md`, `.work/active/stories/*.md` (and nested `.work/active/**/{epic,feature,story}.md`). Parse frontmatter (`id`, `kind`, `stage`, `tags`, `release_binding`, `parent`, `updated`).
- Backlog tier: glob `.work/backlog/*.md`. Parse frontmatter (`tags`, `release_binding`, `created`).

Apply filters from Step 1 (`--tag`, `--stage`, `--all`).

Skip files whose frontmatter is malformed — warn to stderr but don't fail the dashboard.

## Step 3: Render

### Default — compact orientation snapshot

Counts, epic names, review queue. Optimized for dropping into a conversation.

```
## Dashboard

| Epics | Features | Stories | Backlog |
|---|---|---|---|
| 7 | 44 | 31 | 147 |

**Epics in flight**
- creator-lifecycle
- design-system-foundation
- playout-channel-architecture
- ...

**Awaiting review (3)**
- [feature] message-reactions
- [story] hdr-video-tone-mapping
- [feature] upload-resume
```

Elide the `Awaiting review` section if nothing is at that stage. End with a one-line hint: `Use --full for per-stage listings, or --tag=<tag> / --stage=<stage> to drill in.`

### Full listing (`--full`)

Summary table of active-tier counts by stage, followed by item lists grouped by stage, followed by backlog count.

```
## Dashboard

### Active — in-flight counts

| Drafting | Implementing | Review | Total |
|---|---|---|---|
| 12 | 40 | 30 | 82 |

### Implementing (40)
- [epic] playout-channel-architecture — `.work/active/epics/playout-channel-architecture.md` — updated 2026-04-21
...

### Review (30)
- [feature] message-reactions — `.work/active/features/message-reactions.md` — updated 2026-04-18
...

### Backlog

147 items.
```

Elide empty sections. Stage order: `drafting` → `implementing` → `review` → (optional) `done`.

### Tag-filtered view (`--tag=<tag>`)

Delegate to `python3 scripts/tag-view.py <tag>` — it already handles this exact use case with the same grouping convention. Display its output directly.

Optional: if the user wants additional columns not in `tag-view.py`, render inline instead.

### Stage-filtered view (`--stage=<stage>`)

Like the full listing but only items at that stage are listed. Useful workflows:
- `--stage=review` — show everything awaiting user sign-off.
- `--stage=drafting` — show everything with design work in progress.

### Backlog-only view

If `--stage=backlog` or user explicitly asks, show just backlog items, optionally filtered by tag.

## Step 4: Suggest Next Actions

**Compact mode** (default): skip this step — let the user drill in via flags. The `Use --full...` hint already points the way.

**Full / filtered modes**: suggest the most likely next skill based on what's in flight:

- Items at `stage: review` → "Review items in Review stage: `/review` (or `/scope` if you're ready to release-bind)."
- Items at `stage: implementing` → "Continue work on items in Implementing: `/implement`."
- Items at `stage: drafting` → "Continue design on items in Drafting: `/design`."
- Backlog items with a specific tag → "Scope items: `/scope <slug>`."

## Anti-Patterns

- **Don't load full item contents for the dashboard.** Frontmatter is enough for the aggregate view; only read full content for the `--tag` filtered view or when user asks for details on a specific item.
- **Don't show `done` items by default.** Use `--all` to include them.
- **Don't show archived or released items** as if they're in flight. `.work/releases/<version>.md` bundles and `.work/archive/` subtrees are historical, not dashboard candidates.
- **Don't invent tags.** Only list tags that appear in actual item frontmatter. If you see an unexpected tag, note it — it may signal taxonomy drift worth flagging to the user.
- **Don't dump the full listing when the user asked a conversational question.** "What do you see" / "catch me up" is a compact-mode request; expand only on explicit `--full` or a filter.
