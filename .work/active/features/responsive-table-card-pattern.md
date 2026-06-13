---
id: responsive-table-card-pattern
kind: feature
stage: review
tags: [design-system]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-06-12
updated: 2026-06-13
parent: null
---

# Design-system: responsive table→card pattern

## Brief
UX-review cross-surface finding (2026-06-12): every management `<table>` fails reflow
at mobile — admin content-pool table (525px wide at 375px viewport, filed
`a11y-admin-pool-table-mobile-overflow`), admin simulcast table (filed
`a11y-admin-simulcast-table-mobile`), creator key rows borderline. Common root cause:
raw HTML tables with no responsive primitive. Define ONE shared pattern (card/list
layout at the mobile breakpoint, or scroll-wrapper with sticky first column — decide
once at design) as a design-system component/CSS pattern, then apply per surface.

Promoted from backlog to a standalone design-system feature at the
playout-admin-redesign epic design (user decision 2026-06-12): the primitive is built
here, on its own, rather than inside its first consumer. The
`playout-admin-redesign-responsive-structure` feature depends on this and is the
first adopter (pool table, simulcast table); creator surfaces adopt opportunistically
after. Note the existing seam: `SimulcastDestinationManager` already has a
`variant="table" | "list"` prop — the audit suggested the list variant as the mobile
rendering; the design pass should decide whether the shared pattern subsumes or
formalizes that.

## Epic context
- Parentless design-system feature — consumed cross-epic. First consumer:
  `playout-admin-redesign-responsive-structure` (declares the `depends_on` edge).

## Design decisions
- **Card layout vs scroll-wrapper with sticky first column**: card layout at narrow
  widths — the audit explicitly preferred it for readability (pool-table backlog item,
  "Option 2 is preferred"), and the codebase already has two card-at-mobile precedents
  (`pending-bookings-table.tsx` dual render; `SimulcastDestinationManager`
  `variant="list"`). A scroll-wrapper is trivial one-line CSS any surface can apply
  ad-hoc; it is not the shared primitive.
- **Container query, not viewport media query**: admin tables render inside
  `ContextShell`'s content column, which is far narrower than the viewport at desktop
  (sidebar consumes width) — a viewport query would show the table exactly when there's
  no room for it. The primitive establishes its **own** unnamed `inline-size` container
  and toggles on container width. Precedent: `pending-bookings-table.module.css` already
  toggles on `@container dashboard (min-width: 640px)`; the primitive internalizes the
  container instead of depending on a named ancestor.
- **Dual render + CSS toggle, not JS matchMedia**: both views always in the DOM, one
  hidden via `display: none` (removed from a11y tree). SSR-safe, no hydration flicker,
  no resize listeners. Precedent: `pending-bookings-table.tsx`. Caveat documented in the
  component JSDoc: cell renderers must not emit elements with `id` attributes (dual
  render would duplicate them).
- **Column-definition-driven API (SSOT), not paired hand-authored views**: one typed
  column registry per consumer drives BOTH the `<table>` and the card list — display
  derives from one definition (Single Source of Truth principle). The hand-authored
  dual-render in `pending-bookings-table.tsx` shows the duplication cost this removes.
  TanStack-table surfaces (`admin/creators.tsx`) are out of scope for the primitive —
  that table keeps its own rendering (sorting/filtering pipeline) and can adopt a plain
  scroll-wrapper or a later integration.
- **Breakpoint prop as enum, not free value**: `@container` conditions can't read CSS
  custom properties, so the threshold is a fixed pair of variants `"sm"` (640px,
  default) / `"md"` (768px) matching the breakpoint reference tokens and the
  `breakpoint-literal` scan rule. Wide tables (simulcast: 6 cols incl. URLs) use `"md"`.
- **The primitive subsumes the `variant="table" | "list"` seam**: `mode="auto"`
  (default, width-driven) replaces surface-driven choice; `mode="cards"` formalizes
  `variant="list"` for surfaces that want cards at every width (creator streaming page).
  Migrating `SimulcastDestinationManager` onto the primitive is the consumer features'
  scope, not this feature's.
- **No consumer migration in this feature**: build the primitive + tests only (user
  decision at epic design: built on its own, not inside its first consumer).
  `playout-admin-redesign-responsive-structure` adopts first; creator surfaces follow
  opportunistically.

## Architectural choice
A generic, column-definition-driven `ResponsiveTable<T>` in `components/ui/`, rendering
a semantic `<table>` and a card list from the same column definitions, toggled by a
self-established CSS container query. Alternatives considered:

1. **CSS-only pattern** (shared module classes, consumers keep their own markup) —
   rejected: cards need per-field labels and different action placement; markup-level
   reuse is where the duplication lives.
2. **Composition slots** (primitive provides container + toggle + card building blocks;
   consumer authors both views) — rejected as the default: it keeps the
   `pending-bookings-table` duplication shape. The column-driven component is strictly
   better for the flat data-row tables that are this pattern's audience; genuinely
   bespoke tables (TanStack) stay outside rather than forcing a leaky abstraction.
3. **Column-driven component** — chosen. One registry, two derived views, typed.

## Implementation Units

### Unit 1: `ResponsiveTable` component
**File**: `apps/web/src/components/ui/responsive-table.tsx`

```tsx
import type { ReactNode } from "react";

export interface ResponsiveTableColumn<T> {
  /** Stable column key (React key for th/cells/card fields). */
  readonly key: string;
  /** Header content (th) — also the card field label when `cardLabel` is unset and this is a string. */
  readonly header: string;
  /** Cell renderer for a row. Must not emit elements carrying `id` (dual render). */
  readonly cell: (row: T) => ReactNode;
  /** Card treatment: "field" (default) labeled row; "title" card heading; "hidden" table-only. */
  readonly cardRole?: "title" | "field" | "hidden";
  /** Override the card field label (defaults to `header`). */
  readonly cardLabel?: string;
}

export interface ResponsiveTableProps<T> {
  readonly columns: readonly ResponsiveTableColumn<T>[];
  readonly rows: readonly T[];
  /** Stable row key. */
  readonly rowKey: (row: T) => string;
  /** Row actions — last table column ("Actions") and card footer. */
  readonly actions?: (row: T) => ReactNode;
  /** Accessible name for the table and the card list. */
  readonly label: string;
  /** Per-card accessible name (role="group"); defaults to first "title"/first column's text content omitted — pass explicitly for meaningful names. */
  readonly cardAriaLabel?: (row: T) => string;
  /** Container width at which the table view appears. Maps to breakpoint tokens sm=640 / md=768. Default "sm". */
  readonly tableAt?: "sm" | "md";
  /** "auto" (default): width-driven toggle. "cards": card list at every width (subsumes variant="list"). */
  readonly mode?: "auto" | "cards";
}

export function ResponsiveTable<T>(props: ResponsiveTableProps<T>): React.ReactElement;
```

**Implementation Notes**:
- Wrapper `<div className={styles.container}>` sets `container-type: inline-size`
  (unnamed). `tableAt` adds `styles.tableAtMd` when `"md"`; `mode="cards"` adds
  `styles.cardsOnly` (table never shown, no container needed but harmless).
- Table view: `<table className={styles.table} aria-label={label}>`, `<thead>` from
  `columns[].header`, `<tbody>` rows from `cell(row)`; when `actions` is set, append a
  header cell with visually-hidden "Actions" text (`<span className="sr-only">`) and a
  trailing `<td>` with `<div className={styles.actions}>{actions(row)}</div>`.
- Card view: `<ul className={styles.cardList} aria-label={label}>`; each `<li
  className={styles.card} role="group" aria-label={cardAriaLabel?.(row)}>`. Column with
  `cardRole: "title"` renders as `<div className={styles.cardTitle}>`; `"field"` renders
  label/value pair (`.cardField` > `.cardLabel` + `.cardValue`); `"hidden"` skipped.
  `actions` renders in `<div className={styles.cardActions}>` at the card foot.
- Empty rows: render nothing (`rows.length === 0` returns `null`) — empty states stay
  consumer-owned (`EmptyState` exists for that; pool table has its own copy).
- No state, no effects — pure render. JSDoc carries the dual-render/no-`id` caveat per
  inline-documentation tier "exported React components with 3+ props".

**Acceptance Criteria**:
- [ ] One `columns` definition produces both a semantic `<table>` (thead/tbody/th/td)
      and a card `<ul>` with labeled fields.
- [ ] `cardRole: "title"` lifts the value to the card heading; `"hidden"` omits it from
      cards; default renders label+value.
- [ ] `actions` appears as the trailing table column (sr-only header) and the card
      footer.
- [ ] `mode="cards"` renders no table view.
- [ ] Both views carry `aria-label={label}`; cards are `role="group"` with
      `cardAriaLabel` names.
- [ ] Zero rows renders null.
- [ ] Strict-mode clean (`exactOptionalPropertyTypes` — optional props use conditional
      spread where needed).

### Unit 2: Styles
**File**: `apps/web/src/components/ui/responsive-table.module.css`

**Implementation Notes**:
- `.container { container-type: inline-size; }`
- Mobile-first: `.table { display: none; }`, `.cardList` visible (flex column,
  `gap: var(--space-md)`, no list bullets).
- `@container (min-width: 640px)` block: `.container:not(.cardsOnly):not(.tableAtMd)`
  shows `.table` (display: table) and hides `.cardList`. Duplicate block at
  `min-width: 768px` for `.tableAtMd`. (Two literal blocks — `@container` can't read
  custom properties; values match the breakpoint reference tokens.)
- Card visuals mirror the bookings precedent: `var(--color-bg-elevated)`,
  `1px solid var(--color-border)`, `var(--radius-md)`, `.cardField` as
  space-between baseline row, `.cardLabel` muted/600, `.cardActions` flex gap row.
- Table visuals mirror `.poolTable` (full width, collapsed borders, muted th, border-bottom
  rows) so adoption in admin is visually neutral.

**Acceptance Criteria**:
- [ ] Only breakpoint-token values (640/768) appear in `@container` conditions
      (`breakpoint-literal` scan rule).
- [ ] All colors/spacing/radius via `var(--token)` from global tokens.

### Unit 3: Unit tests
**File**: `apps/web/tests/unit/components/responsive-table.test.tsx`

**Implementation Notes**: jsdom can't evaluate container queries — assert structure and
class wiring, not computed visibility: both views present in `mode="auto"`; table absent
in `mode="cards"`; `tableAtMd` class applied for `tableAt="md"`; column→th/td mapping;
cardRole title/field/hidden behavior; actions placement (table trailing cell + card
footer); aria attributes; null on empty rows. Plain `render` from @testing-library/react
per existing component tests.

**Acceptance Criteria**:
- [ ] Covers every Unit 1 acceptance criterion that's assertable in jsdom.
- [ ] `bun run --filter @snc/web test` green.

---

## Implementation Order
1. Unit 1 + Unit 2 together (component + styles are one stride)
2. Unit 3 tests

Single-stride feature — no child stories (tight cohesion, one session, no
parallelizable chunks).

## Testing
Unit tests only (Unit 3). Visual/behavioral confirmation of the container-query toggle
happens in the first consumer (`playout-admin-redesign-responsive-structure`), which
carries the fix-verify loopback against real admin surfaces at 375px.

## Risks
- **jsdom can't exercise the container query** — the toggle itself is verified only at
  first adoption. Mitigation: the toggle CSS is copied from the working
  `pending-bookings-table.module.css` precedent; consumer feature runs the 375px
  fix-verify pass.
- **Dual render duplicate-`id` hazard** — a consumer rendering form controls or
  `id`-carrying elements in cells produces duplicate ids in the DOM. Documented in the
  component JSDoc; acceptable because existing precedent (bookings) already dual-renders
  buttons safely.
- **TanStack creators table doesn't fit the primitive** — accepted non-goal; named in
  the architectural choice so nobody force-fits it later.

## Implementation notes

### Files created

- `apps/web/src/components/ui/responsive-table.tsx` — `ResponsiveTable<T>` component with
  exported `ResponsiveTableColumn<T>` and `ResponsiveTableProps<T>` interfaces.
- `apps/web/src/components/ui/responsive-table.module.css` — CSS module: mobile-first dual
  render, two `@container` literal blocks (640px / 768px), all values via design tokens.
- `apps/web/tests/unit/components/responsive-table.test.tsx` — 18 unit tests covering all
  Unit 1 acceptance criteria assertable in jsdom.

### Deviations from spec

- **`mode="cards"` omits `<table>` from DOM entirely** (not just CSS-hidden). The spec's
  Unit 3 acceptance criterion states "table absent in `mode='cards'`" and the design decision
  says "`mode='cards'` renders no table view." The dual-render rationale (SSR-safe, no
  flicker) does not apply when the table is unconditionally suppressed — the container query
  never needs to show it. Omitting it avoids markup bloat and removes the hidden-but-present
  table from jsdom inspection in tests. This is consistent with the spec language; the
  "dual render" pattern applies to `mode="auto"` only.

- **`<ul>` inline `style` removed in favour of CSS module**: the spec didn't specify inline
  styles; list-style/margin/padding resets are in `.cardList` in the CSS module, matching
  the precedent pattern. The component does not pass inline `style` to the `<ul>`.

### Verification

- `bun run --filter @snc/web test` — 1626 passed, 0 failed (153 test files).
- `bun run --filter @snc/web build` — clean build, no type errors.
