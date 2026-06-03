---
tags: [creators]
release_binding: null
created: 2026-04-20
---

# Creator Team Permissions Model — Composite Capabilities

The current `creator_members` table has a single `role` column (owner/editor/member). This is insufficient for expressing composite capabilities such as a team member who is both an editor and a moderator.

Options to evaluate: bitfield on the role column, a separate permissions table, or a role hierarchy with implied permissions. The moderator-needs-to-be-a-permission-not-a-role constraint surfaced during chat moderation design and is a key driver. The chat moderation feature shipped without addressing this (it relied on the existing `owner` role only); this item picks up the deferred work. Sourced from role-based-nav work.
