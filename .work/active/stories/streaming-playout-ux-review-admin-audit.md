---
id: streaming-playout-ux-review-admin-audit
kind: story
stage: done
tags: [playout, admin-console]
release_binding: null
depends_on: [streaming-playout-ux-review-protocol]
gate_origin: null
created: 2026-06-12
updated: 2026-06-12
parent: streaming-playout-ux-review
---

# Admin surface audit (playout management + simulcast admin)

Implements Unit 4 of the parent feature's design. Follow the `## Audit protocol`
section in the feature body exactly. Mobile viewport IS in scope here (explicit design
decision, overriding the desktop-first default for internal tooling).

Surfaces: `admin/playout.tsx` (channel select, queue insert/remove/skip, content pool,
channel creation), `/admin/simulcast`. Journeys: queue-next and watch promotion; build
rotation pool from existing content; create playout channel; retry failed ingest. State
inspection: queue-poll failure (silent stale data), empty pool/queue, ingest-failed items,
concurrent-admin staleness within the 3s poll window.

## Acceptance
- [x] All journeys at both viewports (A4 not live-verified; see implementation notes)
- [x] State/error coverage verdict per state
- [x] Objective WCAG findings filed directly as items

---

## Findings — admin

### A1: Queue-next

- [admin/desktop] queue-next — Queue displays items from the 3s poll with correct position numbers and estimated start times, but the first item in queue always shows "est. 00:00" because the estimate is cumulative time of *prior* items (none exist for position 1). This is technically correct but functionally misleading — it implies the item plays immediately regardless of what's currently playing. Heuristic: Match between system and real world. Severity: 2. Evidence: .memory/scratchpad/streaming-playout-ux-review/admin-desktop-a1-queue-with-estimate.png. Direction: Label position-1 item "Up next" rather than "est. 00:00", or omit the estimate when it would be 0 and nothing is known about the current track's remaining time.

- [admin/desktop] queue-next — Remove from queue: the remove call is made, the queue clears on the next poll (within 3s), but within that 3s window the removed item remains visible. No optimistic update, no "removing…" state. The 3s window is a stale-data window where the action appears to have failed. Heuristic: Visibility of system status. Severity: 2. Evidence: .memory/scratchpad/streaming-playout-ux-review/admin-desktop-a1-queue-removed.png. Direction: Optimistic removal from the local list on successful API response; re-sync on next poll.

- [admin/desktop] queue-next — Skip button is absent when `nowPlaying` is null (i.e. when the Classics channel has no active metadata from Liquidsoap). The section still shows "Nothing playing" with no contextual explanation of why skip is unavailable. Heuristic: Visibility of system status. Severity: 2. Evidence: .memory/scratchpad/streaming-playout-ux-review/admin-desktop-a1-queue-empty-state.png. Direction: Show a disabled Skip button with tooltip "No active track" rather than hiding it entirely — preserves the affordance and informs the user why the control is absent.

- [admin/desktop] queue-next — Queue picker (PoolItemPicker) silently filters to playout-source items only; creator-sourced pool items are invisible without explanation. An admin building a pool of creator content and then opening the queue picker will see "No playout items in pool" even though the Content Pool count shows items. Heuristic: Help and documentation / Match between system and real world. Severity: 2. Evidence: .memory/scratchpad/streaming-playout-ux-review/admin-desktop-a1-picker-playout-filter.png. Direction: Add a note in the empty queue-picker state: "Only playout-uploaded items can be queued. Creator content plays via the rotation pool."

- [admin/mobile] queue-next — Queue item layout at 375px is functional (bounding box: x:32, w:311, full width). No overflow. The Remove button and estimate label fit within the row. Severity: 0 (not a problem). Evidence: .memory/scratchpad/streaming-playout-ux-review/admin-mobile-a1-after-queue-add.png.

### A2: Pool building

- [admin/desktop] pool-building — Content pool table (6 columns: Title, Duration, Source, Last Played, Plays, Actions) renders without horizontal scroll at desktop. Well-structured data. Duration column shows "—" for all current items because no ingest has run on the demo creator content — expected behavior, not an error, but could confuse admins who expect to see runtimes. Heuristic: Visibility of system status. Severity: 1. Evidence: .memory/scratchpad/streaming-playout-ux-review/admin-desktop-a2-after-pool-assign.png. Direction: Add a "Duration TBD" tooltip on "—" duration cells explaining it will populate after ingest.

- [admin/mobile] pool-building — Content pool table causes severe horizontal overflow at mobile (375px). Table width measured at 525px; body scroll width 557px (body becomes horizontally scrollable). This makes all rows require horizontal scrolling — columns beyond "Duration" are effectively hidden or require lateral swipe. Heuristic: Flexibility and efficiency of use / Error prevention. Severity: 3. Evidence: .memory/scratchpad/streaming-playout-ux-review/admin-mobile-a2-pool-overflow-detail.png. Direction: Replace table with a card/list layout at mobile breakpoint, or add `overflow-x: auto` on a wrapper div with sticky first column. Filed: a11y-admin-pool-table-mobile-overflow (separate item, but also a UX major). (Filed item covers both the a11y and UX angles.)

- [admin/desktop] pool-building — ContentSearchPicker (Add Content) renders results as `role="button"` `div` elements, not `<button>` elements. Keyboard navigation shows that Enter/Space are handled via `onKeyDown` but the picker items are not in the natural focus order (tabIndex=0 only, no explicit `aria-activedescendant` pattern or listbox role). Heuristic: Accessibility. Severity: 2. Evidence: .memory/scratchpad/streaming-playout-ux-review/admin-desktop-a2-search-picker-with-results.png. Filed: a11y-admin-search-picker-listbox.

- [admin/desktop] pool-building — After assigning content via ContentSearchPicker, the pool list updates immediately (synchronous fetch + setState). No loading indicator during the fetch. The UX is snappy in the happy path; under network latency, the picker closes and the pool appears unchanged until the fetch completes. Heuristic: Visibility of system status. Severity: 1. Evidence: .memory/scratchpad/streaming-playout-ux-review/admin-desktop-a2-after-pool-assign.png. Direction: Show a brief "Updating pool…" inline indicator while the refresh fetch runs.

- [admin/desktop] pool-building — Empty pool state shows "No content in pool." (from ContentPoolTable, `.emptyMessage` class). The "Content Pool (0 items)" heading already conveys the same. The empty message is functional but offers no action prompt. Heuristic: Help users recognize, diagnose, recover. Severity: 1. Evidence: .memory/scratchpad/streaming-playout-ux-review/admin-desktop-a2-empty-pool.png. Direction: Add a prompt: "Add content using the buttons above" in the empty state.

- [admin/mobile] pool-building — ContentSearchPicker (Add Content) at 375px: the picker dropdown is left-anchored to the "Add Content" button. Bounding box: x:125, w:131, total right edge 257px — does not overflow viewport. Functional at mobile but narrow (131px wide), which clips long content titles. Heuristic: Aesthetic and minimalist design. Severity: 1. Evidence: .memory/scratchpad/streaming-playout-ux-review/admin-mobile-a2-search-picker-open.png. Direction: Set a minimum width (e.g. `min-width: 260px`) on the dropdown, right-anchored if needed to avoid overflow.

- [admin/mobile] pool-building — "Create New" form (AddContentForm) renders fully within the mobile viewport (311px wide, columnar layout). Form fields are well-spaced. No overflow issues. Severity: 0. Evidence: .memory/scratchpad/streaming-playout-ux-review/admin-mobile-a2-create-form.png.

### A3: Channel creation

- [admin/desktop] channel-creation — The "+ New Channel" → "Channel name" → "Create" flow has no pre-create warning about the engine restart consequence. The only affordance is a post-create toast sequence: "Channel created → Playout engine restarting with new configuration... → Playout engine ready." The admin who clicks Create without expecting a service restart will see a brief restarting state (~4s in dev) that is communicated only retroactively. Heuristic: Visibility of system status / User control and freedom. Severity: 2. Evidence: .memory/scratchpad/streaming-playout-ux-review/admin-desktop-a3-feedback-300ms.png. Direction: Add a warning in the Create dialog: "Creating a channel will briefly restart the playout engine. Viewers may experience a short interruption."

- [admin/desktop] channel-creation — There is no channel deletion affordance in the UI. The "Audit Test Channel" created during this audit cannot be removed without direct database access. Heuristic: User control and freedom. Severity: 3. Evidence: .memory/scratchpad/streaming-playout-ux-review/admin-desktop-a3-after-reload.png. Direction: Add a delete-channel action (with confirmation and the same restart-warning). Filed: bug-admin-no-channel-delete.md.

- [admin/desktop] channel-creation — The tab restarting indicator (pulsing orange dot on `.channelTabRestarting`) is implemented in CSS but was NOT visible by the time the page reloaded (~500ms delay + engine restart completes ~4s in dev). The toast sequence fires correctly (info → success), but the tab dot never appeared in the audit window. This is likely because `engineStatus` resets to `"ready"` and triggers the page reload before the pulsing dot renders. Heuristic: Visibility of system status. Severity: 2. Evidence: .memory/scratchpad/streaming-playout-ux-review/admin-desktop-a3-feedback-300ms.png. Direction: Delay the page reload until `engineStatus` reaches `"ready"` rather than using a fixed 500ms setTimeout.

- [admin/mobile] channel-creation — The inline "New Channel" form at mobile (375px): the "Create" button renders at x:404 (off-screen right edge). The flex container is `flex-direction: row; flex-wrap: nowrap; overflow: visible` at 311px width, but the inner div containing `input + Create + Cancel` measures 453px wide. The Create and Cancel buttons are clipped/off-screen. Heuristic: Flexibility and efficiency of use / Error prevention. Severity: 4. Evidence: .memory/scratchpad/streaming-playout-ux-review/admin-mobile-a3-new-channel-form.png. Direction: Add `flex-wrap: wrap` (or stack vertically) on the row containing the channel name input + Create/Cancel buttons at mobile. Filed: a11y-admin-new-channel-form-mobile.md.

- [admin/mobile] channel-creation — Two channel tabs (S/NC Classics + Audit Test Channel) at 375px are both visible; no overflow. Tab text wraps within each tab cell. Layout is functional at 2 tabs; untested at 3+ tabs (likely overflows). Severity: 1 at current channel count. Evidence: .memory/scratchpad/streaming-playout-ux-review/admin-mobile-a3-before-create.png.

### A4: Failed ingest

- [admin/desktop] failed-ingest — NOT LIVE-VERIFIED. Ingest failure requires an uploaded media file that fails FFmpeg processing. No failed items exist in the seeded environment. Code-read analysis: `ContentPoolTable` renders a Retry button (`.retryButton`) when `item.sourceType === "playout"` AND `item.processingStatus === "failed"` AND `onRetry !== undefined`. The retry handler calls `retryPlayoutIngest(item.playoutItemId)` then refreshes the pool. The Retry button has an `aria-label` for accessibility. No confirmation dialog. No progress indicator during retry. Heuristic coverage: the retry affordance is present and wired; no success/failure feedback beyond the pool refresh is indicated. Severity assessment: handling appears adequate in code but cannot be verified live.

- [admin/mobile] failed-ingest — NOT LIVE-VERIFIED. Code path is identical to desktop. The pool table overflow issue at mobile (Finding above) would affect the actions column containing the Retry button. Severity: same as pool-table-overflow finding.

### A5: Simulcast admin

- [admin/desktop] simulcast — No explanation of live-reload semantics. `docs/streaming.md` states: "Adding or removing a destination while the stream is live triggers an SRS config reload so changes take effect immediately without restarting the stream." The admin/simulcast page says only "Manage external RTMP destinations for S/NC TV simulcasting." No indication of when changes take effect or what happens if a destination is activated/deactivated during a live broadcast. Heuristic: Help and documentation / Match between system and real world. Severity: 2. Evidence: .memory/scratchpad/streaming-playout-ux-review/admin-desktop-a5-simulcast-initial.png. Direction: Add inline note: "Changes to active destinations take effect immediately on the live stream."

- [admin/desktop] simulcast — Delete confirmation uses `window.confirm()`. This is a browser-native modal that: (1) blocks JS, (2) is unstyled / breaks the visual context, (3) is not accessible in the same way as an in-page confirm dialog. The creator-side uses the same component, same issue. Heuristic: Error prevention / Consistency and standards. Severity: 2. Evidence: .memory/scratchpad/streaming-playout-ux-review/admin-desktop-a5-after-delete.png. Direction: Replace with an in-page confirmation pattern (inline "Are you sure? Delete / Cancel" below the row). Filed: bug-admin-simulcast-window-confirm.md.

- [admin/desktop] simulcast — Activate/deactivate toggle (changing `isActive`) fires with no confirmation and no feedback toast. The status column updates on list refresh, but the admin receives no explicit confirmation that the toggle succeeded. Heuristic: Visibility of system status. Severity: 1. Evidence: .memory/scratchpad/streaming-playout-ux-review/admin-desktop-a5-after-activate.png. Direction: Show a brief success toast on toggle ("Destination activated / deactivated").

- [admin/desktop] simulcast — Stream key is write-only (shown as `••••••••<prefix>`). The edit form label reads "Stream Key (leave blank to keep existing)" — this is correct and clear. No finding.

- [admin/mobile] simulcast — Simulcast table causes severe horizontal overflow at 375px. Table with one destination measured at width 696px; body scroll width 728px. The 6-column table (Platform, Label, RTMP URL, Stream Key, Status, Actions) cannot fit mobile. Heuristic: Flexibility and efficiency of use. Severity: 3. Evidence: .memory/scratchpad/streaming-playout-ux-review/admin-mobile-a5-table-with-dest.png. Direction: Card-per-destination layout on mobile (the `variant="list"` already exists in the component for creators). Admin should use "list" variant on mobile or use a responsive CSS breakpoint. Filed: a11y-admin-simulcast-table-mobile.md.

- [admin/mobile] simulcast — Add Destination form at mobile (375px): form width is 311px, fits within viewport. All labels and inputs are within bounds. Form is functional at mobile. Severity: 0. Evidence: .memory/scratchpad/streaming-playout-ux-review/admin-mobile-a5-add-form.png.

### State inspection verdicts

| State | Code path | Verdict |
|---|---|---|
| **Queue poll failure (silent stale data)** | `useChannelQueue`: catch block keeps last known state, no indicator | **handled-poorly** — stale data is shown silently with no "stale" visual; a network error appears identical to connected state |
| **Empty pool** | `ContentPoolTable`: renders "No content in pool." italic message | **handled-well** — message is clear, though no actionable prompt |
| **Empty queue** | playout.tsx: renders "Queue empty — content pool will auto-play." | **handled-well** — explains fallback behavior |
| **Nothing playing (no active metadata)** | playout.tsx: `queueStatus?.nowPlaying != null` guard renders "Nothing playing" | **handled-poorly** — skip button is completely hidden; admin cannot distinguish "Liquidsoap knows nothing is playing" from "Liquidsoap is not responding" |
| **Loading initial queue** | `useChannelQueue` returns null → "Loading…" shown | **handled-well** — both queue and now-playing show "Loading…" on null |
| **Ingest-failed items** | `ContentPoolTable`: Retry button conditional on `processingStatus === "failed"` | **handled-well** (code-read only — not live-verified) |
| **Concurrent-admin staleness within 3s window** | 3s poll with no Last-Updated indicator | **unhandled** — two admins on the page see divergent state for up to 3s with no indicator; removed/added items by one admin are invisible to the other until their next poll cycle |
| **Engine restarting (channel create)** | Toast sequence + pulsing dot; dot may not render before reload | **handled-poorly** — timing of reload vs dot animation means the visual indicator may be skipped in practice |

---

## Implementation notes

### Journeys completed

- A1 (Queue-next): walked at both viewports (desktop 1440×900, mobile 375×812). Queued a playout item (Audit Test Film, created without file), observed 3s poll behavior, removed queue item. Skip button not testable — no active now-playing track (item has no media file so Liquidsoap has no metadata). The nowPlaying card only appears when `queueStatus.nowPlaying != null`; the Classics channel showed null throughout.
- A2 (Pool building): walked at both viewports. Assigned 3 creator-content items + 1 new playout item. Observed search picker at desktop and mobile. Tested "Create New" form (no file submitted). Removed an item from pool.
- A3 (Channel creation): walked at desktop only for the destructive create. Desktop: created "Audit Test Channel" — toast sequence fired correctly. Mobile: observed the channel form layout (Create button off-screen). Channel deletion NOT available in UI; channel was left in place.
- A4 (Failed ingest): NOT live-verified. Code-read confirmed retry affordance exists but no failed item in seeded environment.
- A5 (Simulcast): walked at both viewports. Added fake destination `rtmp://localhost:9999/fake`, activated, deactivated, edited, deleted. Observed `window.confirm` for delete. Confirmed no live-reload semantics note in UI.

### A3 engine recovery

The engine did NOT wedge after A3. HLS returned 200 at `http://localhost:8080/live/snc-tv.m3u8` immediately after the channel creation restart (verified via fetch post-A3). No SRS/Liquidsoap recovery procedure was needed. All three channels (S/NC TV, S/NC Classics, Audit Test Channel) were healthy. Known hazard recovery NOT invoked.

### Screenshot inventory

Screenshots saved to `.memory/scratchpad/streaming-playout-ux-review/` with `admin-` prefix:
- `admin-desktop-a2-empty-pool.png` — empty pool state
- `admin-desktop-a2-search-picker-with-results.png` — ContentSearchPicker open with creator results
- `admin-desktop-a2-after-pool-assign.png` — pool after assigning creator content
- `admin-desktop-a2-search-filtered.png` — filtered search
- `admin-desktop-a2-create-new-form.png` — AddContentForm open
- `admin-desktop-a2-create-form-filled.png` — form with fields filled
- `admin-desktop-a2-after-create.png` — pool after creating playout item
- `admin-desktop-a1-pool-before-queue.png` — pool view before queuing
- `admin-desktop-a1-queue-picker-with-playout.png` — PoolItemPicker with playout item
- `admin-desktop-a1-after-queue-add.png` — queue after insert
- `admin-desktop-a1-queue-after-polls.png` — queue after multiple poll cycles
- `admin-desktop-a1-queue-removed.png` — queue after remove
- `admin-desktop-a1-queue-empty-state.png` — empty queue state (no skip button)
- `admin-desktop-a1-queue-occupied.png` — queue occupied with 1 item
- `admin-desktop-a1-poll-observation.png` — poll observation
- `admin-desktop-a1-queue-with-estimate.png` — queue item showing est. 00:00
- `admin-desktop-a1-picker-playout-filter.png` — queue picker filtering out creator items
- `admin-desktop-a3-before-create.png` — before channel creation
- `admin-desktop-a3-new-channel-input.png` — channel name input visible
- `admin-desktop-a3-name-filled.png` — channel name filled
- `admin-desktop-a3-feedback-300ms.png` — toast feedback at 300ms post-create
- `admin-desktop-a3-feedback-800ms.png` — feedback at 800ms
- `admin-desktop-a3-after-reload.png` — after page reload with new tab
- `admin-desktop-a5-simulcast-initial.png` — simulcast page initial
- `admin-desktop-a5-add-form-open.png` — add destination form
- `admin-desktop-a5-form-filled.png` — form filled with fake destination
- `admin-desktop-a5-after-create.png` — destination in table
- `admin-desktop-a5-after-activate.png` — after activate toggle
- `admin-desktop-a5-edit-form.png` — edit destination form
- `admin-desktop-a5-after-delete.png` — empty state after delete
- `admin-desktop-focus-picker-input.png` — focus style on picker input
- `admin-mobile-a2-initial.png` — mobile playout initial state
- `admin-mobile-a2-search-picker-open.png` — mobile search picker open
- `admin-mobile-a2-create-form.png` — mobile create form
- `admin-mobile-a2-pool-table.png` — mobile pool table (overflow visible)
- `admin-mobile-a2-pool-overflow-detail.png` — mobile pool overflow close-up
- `admin-mobile-a2-pool-scrolled.png` — mobile pool scrolled
- `admin-mobile-a1-queue-picker.png` — mobile queue picker
- `admin-mobile-a1-after-queue-add.png` — mobile queue with item
- `admin-mobile-a1-picker-position.png` — queue picker position at mobile
- `admin-mobile-a3-before-create.png` — mobile with two channel tabs
- `admin-mobile-a3-new-channel-form.png` — mobile channel creation form (Create off-screen)
- `admin-mobile-a3-channel-form-overflow.png` — mobile channel form overflow evidence
- `admin-mobile-a5-simulcast-initial.png` — mobile simulcast initial (empty table)
- `admin-mobile-a5-add-form.png` — mobile add destination form
- `admin-mobile-a5-table-with-dest.png` — mobile simulcast table overflow
- `admin-mobile-full-page.png` — full-page mobile reference

### Known caveats

- The "Audit Test Channel" and "Audit Test Film" created during this audit remain in the database. They should be cleaned up after the audit session.
- The `searchPicker` input uses `outline: none` with `border-color: var(--color-accent)` as the focus indicator. The border-color change from border to accent is a visible but non-standard focus indicator; evaluated as borderline for WCAG 2.2 Success Criterion 2.4.11 (Focus Appearance, AA new in 2.2) which requires the focus indicator to have minimum area/contrast.
- Commit pending (git unavailable in container).

## Review (2026-06-12)

**Verdict**: Approve — audit completeness verified during the feature-level deep
review (journey×viewport coverage table complete with all gaps explicitly
disclosed, finding-record format spot-checked, state-inspection table present
with per-state verdicts). Fast-lane advance.
