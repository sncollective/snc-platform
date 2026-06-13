---
id: playout-admin-redesign-responsive-structure
kind: feature
stage: implementing
tags: [playout, admin-console]
release_binding: null
depends_on: [responsive-table-card-pattern]
gate_origin: null
created: 2026-06-12
updated: 2026-06-13
parent: playout-admin-redesign
---

# Responsive structure — the admin screens fit a pocket

## Brief
The playout admin (`apps/web/src/routes/admin/playout.tsx`) and simulcast admin
(`admin/simulcast.tsx`) screens become structurally usable at 375px. Adopts the shared
table→card primitive (dependency: `responsive-table-card-pattern`) for the content-pool
table (today 525px wide at a 375px viewport) and the simulcast table (696px); fixes the
severity-4 create-channel form (input + Create + Cancel in a no-wrap flex row measuring
453px — submit entirely off-screen); widens the cramped ContentSearchPicker dropdown
(131px, clips titles); and handles channel-tab scaling beyond 2 tabs (audit: functional
at 2, likely overflows at 3+).

**Mobile information architecture is deferred to this feature's design pass** (user
decision, 2026-06-12 epic design): prototype single-page-stacked-with-cards vs
sub-tabs-at-mobile against real layouts and decide with evidence there.

Absorbs the a11y backlog items whose root cause this removes — close
`a11y-admin-new-channel-form-mobile`, `a11y-admin-pool-table-mobile-overflow`, and
`a11y-admin-simulcast-table-mobile` when this lands. Does NOT cover what the data says
(sibling `live-data`) or action consequences (sibling `honest-actions`).

Audit grounding: admin findings A2 (pool overflow sev-3), A3 (form sev-4, tabs sev-1),
A5 (simulcast table sev-3) in `streaming-playout-ux-review-admin-audit` (archived;
body at git 85151fd).

## Epic context
- Parent epic: `playout-admin-redesign`
- Position in epic: first adopter of the design-system table→card primitive; layout
  arc, spine-independent.

## Foundation references
- `docs/admin.md` — admin surface conventions
- `docs/ux-decisions.md` — mobile-ergonomics evidence

## Design decisions
- **Mobile IA: single-page stacked with cards, not sub-tabs-at-mobile** (the deferred
  epic decision, resolved here on the audit's measured evidence): (1) the queue picker
  draws from the pool ("Only playout items can be queued") — sub-tabs would hide the
  pool while working the queue, breaking the workflow the audit walked; (2) the screen
  already carries two tab metaphors at mobile (ContextShell's chip bar + the channel
  tabs) — section sub-tabs would make three stacked tab rows; (3) the audit measured
  queue rows fine at 375px (A1 mobile, sev-0) and pools are small (seeded ~4 items),
  so card-height growth is bounded. Single-page stacked is also today's structure —
  least-change. Revisit if real pools grow past ~30 items and scrolling pain shows up
  in fix-verify.
- **`ContentPoolTable` keeps its public API and adopts `ResponsiveTable` internally**:
  callers (`playout.tsx`) don't change; the component becomes a column-definition +
  empty-state wrapper. Keeps the epic reframe's "channel + permission context, not the
  admin screen" property — the component stays prop-driven with no new route coupling.
- **`SimulcastDestinationManager`'s `variant` branches collapse onto ONE
  `ResponsiveTable`**: `mode={variant === "list" ? "cards" : "auto"}` per the
  primitive's design (it subsumes the variant seam). The RTMP URL column gets
  `cardRole: "hidden"` — which exactly reproduces today's split (the table shows
  rtmpUrl, the list never did). The `variant` prop survives (creator surface keeps
  cards-always); only the dual markup dies.
- **Simulcast table uses `tableAt="md"`** (768px container): natural width is 696px —
  at a 640px container the 6 columns would cram. Pool table (525px natural) uses the
  default `"sm"`.
- **Create-channel form: stack at mobile via flex-wrap, in module CSS** — the sev-4
  fix is `flex-wrap: wrap` + sane input flex-basis on the row, moved out of inline
  `style={{}}` into `playout.module.css` (inline styles can't carry responsive
  behavior). Not a Dialog rework — `honest-actions` owns the create flow's consequence
  UX; this feature only makes the existing inline form usable. Cross-read note for
  honest-actions: if it converts creation to a confirm-dialog flow, the wrap fix
  becomes moot there — coordinate at its design pass.
- **Channel tabs: horizontal scroll at overflow** (`overflow-x: auto`, no wrap) —
  matches the ContextShell chip-bar pattern already on this screen; sev-1 today
  (functional at 2 tabs), so the cheap standard pattern, not a menu collapse.
- **Picker dropdown: `min-width: 260px`, right-anchored at small viewports** — the
  audit's direction verbatim (A2 mobile, 131px clips titles).
- **Backlog absorption**: stories delete `a11y-admin-pool-table-mobile-overflow`,
  `a11y-admin-simulcast-table-mobile`, and `a11y-admin-new-channel-form-mobile` stubs
  in the commits that land their fixes (per the brief).
- **Pool empty-state prompt** (audit A2 sev-1, one line): "No content in pool. Add
  content using the buttons above." — included since the empty message is already
  being touched by the ResponsiveTable move.

## Architectural choice
Adopt the `responsive-table-card-pattern` primitive at both failing tables and fix the
three pure-CSS reflow bugs in place. No new components; no layout framework; no route
restructure (single-page stacked won the IA decision). Alternatives:
1. **Per-surface bespoke responsive CSS** — rejected by the epic itself (the
   design-system primitive exists precisely so this feature doesn't invent layouts).
2. **Sub-tabs at mobile** — rejected on audit evidence (see Design decisions).
3. **Primitive adoption + targeted CSS fixes** — chosen.

## Implementation Units

### Unit 1: Content pool table → ResponsiveTable
**Files**: `apps/web/src/components/admin/content-pool-table.tsx`,
`apps/web/src/routes/admin/playout.module.css`
**Story**: `playout-admin-redesign-responsive-structure-pool-table`

```tsx
// content-pool-table.tsx — public API unchanged:
export interface ContentPoolTableProps {
  readonly items: ChannelContent[];
  readonly onRemove: (item: ChannelContent) => void;
  readonly onRetry?: (item: ChannelContent) => void;
}
```

**Implementation Notes**:
- Internals become a `ResponsiveTable<ChannelContent>` with columns: Title
  (`cardRole: "title"`), Duration (formatDuration ?? "—"), Source (the existing
  `sourceBadge` span), Last Played (relativeTime), Plays; `actions={...}` renders the
  conditional Retry + Remove buttons (existing aria-labels kept; Retry only when
  `sourceType === "playout" && processingStatus === "failed" && onRetry` — render-prop
  logic, unchanged).
- `label="Content pool"`; `cardAriaLabel={(item) => item.title ?? "Untitled item"}`;
  default `tableAt` ("sm").
- Empty state stays in ContentPoolTable (ResponsiveTable returns null on empty):
  `No content in pool. Add content using the buttons above.`
- Keep `formatDuration`/`relativeTime` helpers as-is. Keep `sourceBadge`/button styles
  (still used); delete the now-dead `.poolTable`/`.poolTableHeader`/`.poolTableCell`
  rules from `playout.module.css`.
- Delete `.work/backlog/a11y-admin-pool-table-mobile-overflow.md` in this story's
  commit.

**Acceptance Criteria**:
- [ ] `playout.tsx` unchanged (props API identical).
- [ ] Cards at narrow container: Title as heading, labeled fields, actions at foot;
      table at wide.
- [ ] Retry appears only for failed playout-sourced items (both views).
- [ ] Empty state shows the action prompt.
- [ ] Existing ContentPoolTable tests updated, not deleted; card-view assertions added.
- [ ] Backlog stub removed.

### Unit 2: Simulcast manager → ResponsiveTable
**File**: `apps/web/src/components/simulcast/simulcast-destination-manager.tsx` (+ its
module CSS + test file)
**Story**: `playout-admin-redesign-responsive-structure-simulcast-table`
**Sequencing**: `depends_on: [shared-confirm-dialog-component-simulcast-adoption]`
(same-file write; that story replaced window.confirm with ConfirmDialog).

**Implementation Notes**:
- Replace BOTH the `variant === "table"` `<table>` branch and the
  `<ul className={styles.destList}>` branch with one
  `ResponsiveTable<SimulcastDestination>`: columns Platform
  (`SIMULCAST_PLATFORMS[p].label`, `cardRole: "title"`), Label, RTMP URL
  (`cardRole: "hidden"`), Stream Key (masked span, as today), Status (active/inactive
  span); `actions` renders Activate/Deactivate + Edit + Delete (Delete keeps the
  `setDestPendingDelete` ConfirmDialog flow the confirm-adoption story landed — don't
  regress it).
- `mode={variant === "list" ? "cards" : "auto"}`, `tableAt="md"`,
  `label="Simulcast destinations"`, `cardAriaLabel={(d) => d.label}`.
- Admin at mobile now shows cards with Platform as title and Label/Key/Status fields —
  equivalent to today's creator list (which never showed rtmpUrl).
- Remove the dead `.destinationList`/`.destList`/`.destItem`/`.destInfo` CSS.
- Add the audit's A5 sev-2 inline semantics note while in the file (one line near the
  header): "Changes to active destinations take effect immediately on the live
  stream." — structural copy, in scope here; `honest-actions`' semantics-note item
  cross-reads this so it isn't duplicated.
- Delete `.work/backlog/a11y-admin-simulcast-table-mobile.md` in this story's commit.

**Acceptance Criteria**:
- [ ] Admin surface: table at wide container, cards at narrow. Creator surface
      (`variant="list"`): cards at every width.
- [ ] RTMP URL visible in table view only.
- [ ] Toggle/Edit/Delete (incl. ConfirmDialog delete) work in both views.
- [ ] Existing manager tests pass with assertions updated to the new structure.
- [ ] Backlog stub removed.

### Unit 3: Create-form wrap, picker width, tab scroll
**Files**: `apps/web/src/routes/admin/playout.tsx`,
`apps/web/src/routes/admin/playout.module.css`
**Story**: `playout-admin-redesign-responsive-structure-form-and-chrome`

**Implementation Notes**:
- Create-channel row: replace the two inline `style={{display:"flex",...}}` divs
  (playout.tsx ~lines 377, 386) with module classes; the form row gets
  `flex-wrap: wrap` and the input `flex: 1 1 200px; min-width: 0` so Create/Cancel
  wrap under the input at 375px (sev-4 fix).
- `.channelTabs`: `overflow-x: auto` + `flex-wrap: nowrap` (mirror `.chipBar` in
  `context-shell.module.css`); tabs get `flex-shrink: 0`.
- Picker dropdown (the absolutely-positioned results panel in `playout.module.css`
  shared by ContentSearchPicker/PoolItemPicker): `min-width: 260px`; anchor `right: 0`
  so it stays in-viewport when opened from right-edge buttons.
- Delete `.work/backlog/a11y-admin-new-channel-form-mobile.md` in this story's commit.

**Acceptance Criteria**:
- [ ] At 375px the Create and Cancel buttons are fully on-screen (wrap under input).
- [ ] 3+ channel tabs scroll horizontally without page overflow.
- [ ] Picker dropdown ≥260px wide and within viewport at 375px.
- [ ] Backlog stub removed.

---

## Implementation Order
1. `…-pool-table` + `…-form-and-chrome` — both write `playout.module.css`; implement
   as ONE bundle (or serialize). Recommend bundling.
2. `…-simulcast-table` — after its declared dep (already landed) — can run in the
   same wave as the bundle (disjoint files).

## Testing
- Unit tests per story (component tests for pool table and simulcast manager; the
  form/chrome story is CSS-dominant — assert class wiring where practical).
- **Fix-verify loopback** (platform convention): after all three land, user confirms
  at 375px in the running app — pool cards, simulcast cards, create-form wrap, picker
  width, tab scroll. This is also the container-query toggle's first real-browser
  verification (jsdom can't evaluate it — known gap from the primitive's design).

## Risks
- **Same-file convergence**: sibling features (`live-data`, `honest-actions`) also
  touch `playout.tsx`; they design later and cross-read this body. The simulcast-table
  story's declared dep serializes the one already-landed same-file writer.
- **ResponsiveTable's first real consumer** — if adoption reveals an API gap, the gap
  routes back to the primitive as a small follow-up, not a per-surface fork of the
  pattern.
- **Audit A3 tab-dot timing finding (page reload races the restart indicator) is NOT
  fixed here** — it's data-truth work owned by `live-data` (honest engine-restart
  state). Named so nobody assumes this feature closed it.
