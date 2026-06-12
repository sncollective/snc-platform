---
id: a11y-admin-simulcast-table-mobile
kind: backlog
tags: [playout, admin-console, accessibility]
created: 2026-06-12
---

# Simulcast destinations table causes horizontal overflow at mobile (375px)

**Violation:** WCAG 2.2 SC 1.4.10 Reflow (AA) — content requiring horizontal scrolling at 320 CSS pixels.

**Observed:** At 375×812 viewport with one simulcast destination row, the `.destinationList` table renders at 696px wide. Body scroll width reaches 728px. The 6-column table (Platform, Label, RTMP URL, Stream Key, Status, Actions) cannot fit in a mobile viewport; the RTMP URL, Stream Key, and Actions columns are off-screen.

**File:line:** `apps/web/src/components/simulcast/simulcast-destination-manager.tsx:274` — `variant === "table"` branch renders a full HTML `<table>`. `apps/web/src/routes/admin/simulcast.tsx:45` — passes `variant="table"` unconditionally.

**Severity:** 3 (major) — admin cannot view destination status (Active/Inactive) or Actions (Activate, Edit, Delete) on mobile without horizontal scrolling.

**Fix direction:** The component already has a `variant="list"` card layout (used by creators). Pass `variant="list"` at mobile breakpoint, or add a CSS media query switching to `display: block` / card layout. The simplest fix: read viewport width and pass `variant={isMobile ? "list" : "table"}`, or add a responsive CSS override in the module that converts the table to stacked blocks at `max-width: 600px`.
