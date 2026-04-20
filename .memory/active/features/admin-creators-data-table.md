---
id: feature-admin-creators-data-table
kind: feature
stage: review
tags: [admin-console, creators]
release_binding: null
created: 2026-04-18
updated: 2026-04-18
related_decisions: []
related_designs: []
parent: null
---

# Admin Creators Data Table

> The original polish backlog item (CSS module, status badge colors, filter tab styling, create form layout, status action buttons) was folded into this TanStack Table rewrite. That work is covered here in full.

## Overview

Replace the bare `<ul>` list on the admin creators page with a TanStack Table. Columns: name (link), handle, status badge, content count, actions. Status filter tabs, search by name/handle. Full CSS module replacing all inline styles. The invite dialog gets extracted into the CSS module too.

The admin API already returns `CreatorProfileResponse` with `displayName`, `handle`, `status`, `contentCount`. No API changes needed — this is a pure frontend rewrite.

29 new tests.

---

## Implementation Units

### Unit 1: CSS Module

**File**: `apps/web/src/routes/admin/admin-creators.module.css`

```css
/* ── Page Layout ── */

.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-sm);
}

.actions {
  display: flex;
  gap: var(--space-sm);
}

/* ── Filter Tabs ── */

.filterTabs {
  display: flex;
  gap: var(--space-xs);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-xs);
}

.filterTab {
  padding: var(--space-xs) var(--space-sm);
  border: none;
  border-bottom: 2px solid transparent;
  background: none;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}

.filterTab:hover {
  color: var(--color-text);
}

.filterTabActive {
  color: var(--color-text);
  border-bottom-color: var(--color-primary);
  font-weight: 600;
}

.filterCount {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  margin-left: var(--space-xs);
}

/* ── Search ── */

.searchRow {
  display: flex;
  gap: var(--space-sm);
  align-items: center;
}

.searchInput {
  flex: 1;
  max-width: 320px;
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  background: var(--color-surface);
  color: var(--color-text);
}

/* ── Table ── */

.table {
  width: 100%;
  border-collapse: collapse;
}

.table th {
  text-align: left;
  padding: var(--space-xs) var(--space-sm);
  font-size: var(--font-size-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  user-select: none;
}

.table th:hover {
  color: var(--color-text);
}

.table td {
  padding: var(--space-sm);
  border-bottom: 1px solid var(--color-border);
  font-size: var(--font-size-sm);
  vertical-align: middle;
}

.table tr:hover td {
  background: var(--color-surface-hover);
}

.creatorName {
  font-weight: 500;
  color: var(--color-text);
  text-decoration: none;
}

.creatorName:hover {
  text-decoration: underline;
}

.handle {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

/* ── Status Badge ── */

.statusBadge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 9999px;
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: #fff;
  text-transform: capitalize;
}

.statusActive {
  background-color: var(--color-success, #16a34a);
}

.statusInactive {
  background-color: var(--color-text-muted, #6b7280);
}

.statusArchived {
  background-color: var(--color-error, #dc2626);
}

/* ── Action Buttons ── */

.actionButton {
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: var(--font-size-xs);
  cursor: pointer;
  transition: background 0.15s;
}

.actionButton:hover:not(:disabled) {
  background: var(--color-surface-hover);
}

.actionButton:disabled {
  opacity: 0.5;
  cursor: default;
}

.actionButtons {
  display: flex;
  gap: var(--space-xs);
}

/* ── Create Form ── */

.createForm {
  display: flex;
  gap: var(--space-sm);
  align-items: center;
}

/* ── Invite Dialog (extracted from inline styles) ── */

.dialogOverlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.dialog {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  min-width: 360px;
  max-width: 480px;
  width: 100%;
}

.dialogTitle {
  margin: 0 0 var(--space-md);
}

.dialogField {
  display: block;
  margin-bottom: var(--space-sm);
}

.dialogFieldInput {
  display: block;
  width: 100%;
  margin-top: var(--space-xs);
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
}

.dialogActions {
  display: flex;
  gap: var(--space-sm);
  justify-content: flex-end;
  margin-top: var(--space-md);
}

/* ── Empty State ── */

.emptyState {
  text-align: center;
  padding: var(--space-xl) 0;
  color: var(--color-text-muted);
}

/* ── Responsive ── */

@media (max-width: 768px) {
  .table {
    display: block;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
}
```

**Acceptance Criteria**:

- [ ] All styles use design tokens (no hardcoded colors except status badge fallbacks)
- [ ] Table scrolls horizontally on mobile
- [ ] No inline styles remain in the component

---

### Unit 2: Rewrite Admin Creators Page with TanStack Table

**File**: `apps/web/src/routes/admin/creators.tsx`

Rewrite the page using `useReactTable` from TanStack Table v8. Key changes:

```typescript
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import type React from "react";

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  createColumnHelper,
  flexRender,
} from "@tanstack/react-table";
import type { SortingState, ColumnFiltersState } from "@tanstack/react-table";

import type { CreatorProfileResponse, CreatorStatus } from "@snc/shared";
import { CREATOR_STATUSES } from "@snc/shared";

import { RouteErrorBoundary } from "../../components/error/route-error-boundary.js";
import { fetchApiServer } from "../../lib/api-server.js";
import { listAdminCreators, createCreator, updateCreatorStatus } from "../../lib/admin.js";
import { apiMutate } from "../../lib/fetch-utils.js";
import listingStyles from "../../styles/listing-page.module.css";
import formStyles from "../../styles/form.module.css";
import errorStyles from "../../styles/error-alert.module.css";
import successStyles from "../../styles/success-alert.module.css";
import styles from "./admin-creators.module.css";
```

**Column definitions** using `createColumnHelper<CreatorProfileResponse>()`:

```typescript
const columnHelper = createColumnHelper<CreatorProfileResponse>();

// Inside the component (needs access to handleStatusChange):
const columns = useMemo(() => [
  columnHelper.accessor("displayName", {
    header: "Name",
    cell: (info) => (
      <Link
        to="/creators/$creatorId/manage"
        params={{ creatorId: info.row.original.handle ?? info.row.original.id }}
        className={styles.creatorName}
      >
        {info.getValue()}
      </Link>
    ),
  }),
  columnHelper.accessor("handle", {
    header: "Handle",
    cell: (info) => (
      <span className={styles.handle}>
        {info.getValue() ? `@${info.getValue()}` : "—"}
      </span>
    ),
  }),
  columnHelper.accessor("status", {
    header: "Status",
    cell: (info) => {
      const status = info.getValue();
      const statusClass = {
        active: styles.statusActive,
        inactive: styles.statusInactive,
        archived: styles.statusArchived,
      }[status];
      return (
        <span className={`${styles.statusBadge} ${statusClass}`}>
          {status}
        </span>
      );
    },
    filterFn: (row, _columnId, filterValue) => {
      if (filterValue === "all") return true;
      return row.original.status === filterValue;
    },
  }),
  columnHelper.accessor("contentCount", {
    header: "Content",
    cell: (info) => info.getValue(),
  }),
  columnHelper.display({
    id: "actions",
    header: "",
    cell: (info) => (
      <StatusActions
        creator={info.row.original}
        onStatusChange={handleStatusChange}
      />
    ),
  }),
], [handleStatusChange]);
```

**Table instance**:

```typescript
const [sorting, setSorting] = useState<SortingState>([]);
const [globalFilter, setGlobalFilter] = useState("");
const [statusFilter, setStatusFilter] = useState<CreatorStatus | "all">("all");

const table = useReactTable({
  data: creators,
  columns,
  state: { sorting, globalFilter, columnFilters: [{ id: "status", value: statusFilter }] },
  onSortingChange: setSorting,
  onGlobalFilterChange: setGlobalFilter,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  globalFilterFn: "includesString",
});
```

**Table render** — replace the bare `<ul>` with:

```tsx
<table className={styles.table}>
  <thead>
    {table.getHeaderGroups().map((headerGroup) => (
      <tr key={headerGroup.id}>
        {headerGroup.headers.map((header) => (
          <th
            key={header.id}
            onClick={header.column.getToggleSortingHandler()}
          >
            {flexRender(header.column.columnDef.header, header.getContext())}
            {header.column.getIsSorted() === "asc" ? " \u2191" : ""}
            {header.column.getIsSorted() === "desc" ? " \u2193" : ""}
          </th>
        ))}
      </tr>
    ))}
  </thead>
  <tbody>
    {table.getRowModel().rows.map((row) => (
      <tr key={row.id}>
        {row.getVisibleCells().map((cell) => (
          <td key={cell.id}>
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </td>
        ))}
      </tr>
    ))}
  </tbody>
</table>
```

**Filter tabs** with counts:

```tsx
const statusCounts = useMemo(() => {
  const counts: Record<string, number> = { all: creators.length };
  for (const c of creators) {
    counts[c.status] = (counts[c.status] ?? 0) + 1;
  }
  return counts;
}, [creators]);

// Render:
<div className={styles.filterTabs}>
  {(["all", ...CREATOR_STATUSES] as const).map((s) => (
    <button
      key={s}
      className={`${styles.filterTab} ${statusFilter === s ? styles.filterTabActive : ""}`}
      onClick={() => setStatusFilter(s)}
    >
      {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
      <span className={styles.filterCount}>({statusCounts[s] ?? 0})</span>
    </button>
  ))}
</div>
```

**Search** — global filter input:

```tsx
<div className={styles.searchRow}>
  <input
    className={styles.searchInput}
    placeholder="Search creators..."
    value={globalFilter}
    onChange={(e) => setGlobalFilter(e.target.value)}
    aria-label="Search creators"
  />
</div>
```

**Keep existing**: `InviteCreatorDialog`, create form, status change logic. Move `InviteCreatorDialog` inline styles to the CSS module classes (`.dialogOverlay`, `.dialog`, `.dialogTitle`, `.dialogField`, `.dialogFieldInput`, `.dialogActions`).

**Keep existing**: `StatusActions` component, but use CSS module classes instead of inline `style`.

**Implementation Notes**:

- `createColumnHelper` is the TanStack Table v8 pattern for type-safe column definitions.
- The `statusFilter` is applied as a column filter on the "status" column with a custom `filterFn`.
- `globalFilter` with `"includesString"` searches across displayName and handle.
- Sorting is built-in via `getSortedRowModel()` — clicking headers toggles sort.
- The `data` array should be mutable state so status changes and creates update the table.
- The `columnFilters` state is derived from `statusFilter` — not independently managed.

**Acceptance Criteria**:

- [ ] Table renders with 5 columns (Name, Handle, Status, Content, Actions)
- [ ] Clicking column headers sorts the table
- [ ] Status filter tabs filter rows, show counts
- [ ] Search filters by name and handle
- [ ] Status actions (Activate/Deactivate/Archive/Restore) work
- [ ] Create Creator form works
- [ ] Invite Creator dialog works with CSS module styles
- [ ] No inline styles remain
- [ ] Horizontal scroll on mobile

---

## Implementation Order

1. **Unit 1** — CSS module
2. **Unit 2** — Page rewrite with TanStack Table

## Testing

### Unit Tests: `apps/web/tests/unit/routes/admin/creators.test.tsx`

If this file exists, update mocks. If not, create with:

- Table renders with creator data
- Filter tabs filter by status
- Search filters by name
- Sort toggles on header click
- Status actions call `updateCreatorStatus`
- Create form calls `createCreator`

## Verification Checklist

```bash
bun run --filter @snc/web test
```
