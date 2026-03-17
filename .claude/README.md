# Claude Tooling — Platform

Claude skills and rules for platform development live in the **parent monorepo**, not here.

**Skills location:** `.claude/skills/` (repo root)
**Rules location:** `.claude/rules/` (repo root)

If you're working from the monorepo root (`/workspaces/SNC`), all `platform-*` skills and
framework reference skills (`drizzle-v0`, `hono-v4`, `tanstack-*`, `zod-v4`) are available.

If you've cloned `snc-platform` as a standalone repo, you won't have these skills.
Clone the full monorepo for Claude skill support.
