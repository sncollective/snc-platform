---
name: item-park
description: "Quick idea capture that writes a flat markdown file to `.work/backlog/` with tags frontmatter, without interrupting the current session. Use mid-conversation when an idea or todo surfaces that should be tracked. Trigger on 'park this', 'add to backlog', 'note this for later', 'put that on the board', or inline with a tag prefix like 'add dark mode' or 'refactor: dedup upload handlers'."
argument-hint: "[tag-prefix:] [idea]"
---

# item-park — Quick Idea Capture

Write a new backlog item at `.work/backlog/<slug>.md`. Minimal frontmatter, minimal output, no follow-up questions.

See `.work/CONVENTIONS.md` for item structure and `.work/CONVENTIONS.md` for tag rubric.

## Step 1: Parse Arguments

Parse `$ARGUMENTS` for an optional tag prefix and the idea text:

- `content: add dark mode to feed` → tag `content`, idea: "add dark mode to feed"
- `refactor: dedup upload handlers` → tag `refactor`, idea: "dedup upload handlers"
- `user-station, deploy: configure DNS for foo.bar.com` → tags `[user-station, deploy]`, idea: "configure DNS for foo.bar.com"
- `security: tighten CORS policy` → tag `security`
- `add dark mode` (no prefix) → no tag yet, resolve in Step 2 or ask
- `workflow: review item-convention rule` → tag `workflow`

Normalize tag prefixes: lowercase, strip trailing colon and whitespace, split on comma.

## Step 2: Determine Tags

Apply the tag rubric in `tag-taxonomy.md`. `/item-park` doesn't deviate from it. If no tag was given and none can be inferred from context, the tag may stay empty (`[]`) or you may ask once when the idea is genuinely ambiguous.

## Step 3: Derive Slug

Convert the idea text to kebab-case:

- `add dark mode to feed` → `add-dark-mode-to-feed`
- `configure DNS for foo.bar.com` → `configure-dns-for-foo-bar-com`
- `review item-convention rule` → `review-item-convention-rule`

Truncate at ~60 chars. If the resulting slug collides with an existing backlog file, append a short disambiguator (`-2`, `-date`, or a meaningful extra word).

## Step 4: Write Backlog File

Create `.work/backlog/<slug>.md` with frontmatter per `item-convention.md §Frontmatter — backlog tier`. `tags:` may be empty (`[]`) if no tag was determined. Body is the idea text as-is — do not expand, reframe, or summarize unless the user provides extra context worth capturing.

## Step 5: Confirm (Minimal)

Output one line:

```
Parked: .work/backlog/<slug>.md (tags: [<tag-list>])
```

No follow-up questions. Return to the user's current session context.

## Anti-Patterns

- **Don't ask clarifying questions unless the tag is truly ambiguous.** Make a reasonable guess from co-tags. Ask only when a cross-cutting tag appears alone or there's no tag.
- **Don't open other items or files.** This is capture only.
- **Don't summarize or reframe the idea.** Write exactly what the user said.
- **Don't interrupt flow.** One-line confirmation and done.
- **Don't assign kind or stage.** Those are decided at `/scope` promotion; backlog items have neither.
- **Don't add `release_binding`.** Unless the user explicitly says this is a gate-blocking finding for a specific release, leave it off.
