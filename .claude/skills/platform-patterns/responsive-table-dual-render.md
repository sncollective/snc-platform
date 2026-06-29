# responsive-table-dual-render

One column definition drives both semantic table and card-list renderings for responsive data sets.

## When to use
Use for tabular data that must remain accessible on narrow containers without hydration-dependent layout branching.

## Instances
- `apps/web/src/components/ui/responsive-table.tsx:79` — generic `ResponsiveTable<T>` renders both table and card list from shared columns.
- `apps/web/src/components/admin/content-pool-table.tsx:45` — content pool columns define title/field/card roles.
- `apps/web/src/components/admin/content-pool-table.tsx:96` — content pool uses `ResponsiveTable<ChannelContent>`.
- `apps/web/src/components/simulcast/simulcast-destination-manager.tsx:303` — simulcast destinations use the same responsive table/card shape.

## Canonical sketch
```tsx
const COLUMNS: readonly ResponsiveTableColumn<Row>[] = [
  { key: "title", header: "Title", cardRole: "title", cell: (row) => row.title },
  { key: "status", header: "Status", cell: (row) => row.status },
];
<ResponsiveTable
  columns={COLUMNS}
  rows={rows}
  rowKey={(row) => row.id}
  label="Items"
  cardAriaLabel={(row) => row.title}
  actions={(row) => <Actions row={row} />}
/>
```

## Anti-patterns
Don't emit duplicate `id` attributes from cell renderers; don't use when a data set is better represented as cards only.
