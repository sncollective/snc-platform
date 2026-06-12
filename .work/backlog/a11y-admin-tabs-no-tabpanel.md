---
id: a11y-admin-tabs-no-tabpanel
kind: backlog
tags: [playout, admin-console, accessibility]
created: 2026-06-12
---

# Channel tabs missing tabpanel role on associated content region

**Violation:** WCAG 2.2 SC 4.1.2 Name, Role, Value (AA) — ARIA tabs pattern requires `role="tabpanel"` elements associated with each `role="tab"`.

**Observed:** `admin/playout.tsx` implements channel selection with `role="tablist"` and `role="tab"` on each button, including `aria-selected` state. However, the content below the tabs (Now Playing, Queue, Content Pool sections) has no `role="tabpanel"`, no `id`, and no `aria-labelledby` or `aria-controls` connecting the tabs to their panel. Screen readers cannot navigate from a tab to its controlled content panel.

**File:line:** `apps/web/src/routes/admin/playout.tsx:347-413` (tablist/tab buttons) and lines 416-561 (content below — no tabpanel wrapper).

**Severity:** 2 (minor for sighted users; major for screen reader users who rely on the tab-to-panel navigation pattern).

**Fix direction:** Wrap the content section (lines 416-561) in a `<div role="tabpanel" id="playout-panel-{selectedChannelId}" aria-labelledby="playout-tab-{selectedChannelId}">`. Add matching `id` and `aria-controls` to each tab button. This is a standard ARIA tabs remediation.
