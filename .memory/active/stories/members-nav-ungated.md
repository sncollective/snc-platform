---
id: story-members-nav-ungated
kind: story
stage: done
tags: [identity, creators]
release_binding: 0.2.1
created: 2026-04-18
updated: 2026-04-18
related_decisions: []
related_designs: []
parent: null
---

# Members Nav Ungated

## Overview

Removed the `manageMembers` permission gate from the Members nav item in the creator management sidebar, allowing all team members who can access the manage page to see the Members link.

## Change

Removed the `requirePermission("manageMembers")` gate (or equivalent `hasPermission` check) from the Members nav item rendering logic. The navigation link is now visible to all team members who have access to the creator manage section.

Management controls inside the Members page itself remain gated — only users with the appropriate permission can perform member management actions. The change only affects nav item visibility.

## Rationale

The Members nav item was invisible to editors and viewers even though they could navigate to the Members page directly (or via other paths). This caused confusion — the nav item's presence/absence did not accurately reflect what the user could access. Making the nav item visible to all manage-page users aligns navigation visibility with actual page accessibility.

The principle: gate the management actions, not the navigation to a read-only view of team membership. Editors and viewers benefit from seeing who else is on the team even if they cannot manage them.

## Affected Files

- Creator management sidebar / nav component (`platform/apps/web/src/` — likely in `routes/creators/` or a shared nav component)

## Verification

Log in as an editor or viewer on a creator team. Navigate to the creator manage section. Confirm the Members nav item is visible. Click it and confirm the page loads. Confirm that member management actions (invite, remove, change role) are still restricted to authorized users only.
