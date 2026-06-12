---
id: a11y-admin-new-channel-form-mobile
kind: backlog
tags: [playout, admin-console, accessibility]
created: 2026-06-12
---

# New channel creation form buttons off-screen at mobile (375px)

**Violation:** WCAG 2.2 SC 1.4.10 Reflow (AA) — interactive controls clipped/off-screen at narrow viewports.

**Observed:** At 375×812 viewport, clicking "+ New Channel" reveals an inline form row. The container is `flex-direction: row; flex-wrap: nowrap; overflow: visible; width: 311px`. The inner div containing `<input placeholder="Channel name"> + Create + Cancel` measures 453px wide. The "Create" button is positioned at x:404 (off-screen right). The "Cancel" button is similarly unreachable without horizontal scrolling.

**File:line:** `apps/web/src/routes/admin/playout.tsx:386-413` — the inline channel creation form uses an inline style `display: flex; gap: var(--space-sm); align-items: center` with no wrap or breakpoint handling.

**Severity:** 4 (catastrophic) — channel creation is completely inaccessible on mobile; the primary action (Create) cannot be tapped.

**Fix direction:** Either (1) add `flex-wrap: wrap` to the inner div so buttons wrap to the next line, or (2) stack the form vertically (column direction) on mobile, or (3) use a modal/dialog for the channel creation form. The simplest fix is `flex-wrap: wrap` with `width: 100%` on the input.
