---
tags: [creators, ux-polish]
release_binding: null
created: 2026-04-20
---

# Creator Team Read-Only View for Non-Owner Members

Editor and viewer members should be able to see the full creator team list without the ability to change permissions. Currently `team-section.tsx` either hides the team list or shows the same permission-editing controls to non-owner roles.

The fix: render `team-section.tsx` in a read-only mode for editor and viewer roles — members are listed with their roles visible but role-change controls are disabled or hidden. Non-owner roles should not be able to modify any permissions. Sourced from role-based-nav work.
