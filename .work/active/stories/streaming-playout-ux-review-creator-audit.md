---
id: streaming-playout-ux-review-creator-audit
kind: story
stage: review
tags: [streaming, creators]
release_binding: null
depends_on: [streaming-playout-ux-review-protocol]
gate_origin: null
created: 2026-06-12
updated: 2026-06-12
parent: streaming-playout-ux-review
---

# Creator surface audit (streaming manage + simulcast)

Implements Unit 3 of the parent feature's design. Follow the `## Audit protocol`
section in the feature body exactly.

Surfaces: `creators/$creatorId/manage/streaming.tsx` (stream key lifecycle, OBS connect
instructions), `simulcast-destination-manager.tsx`. Journeys: first-time OBS setup; key
rotation; add/remove Twitch destination including live-reload semantics. State
inspection: rotation confirmation, invalid RTMP URL, add/remove while live vs offline,
permission-denied for non-owner team members.

## Acceptance
- [x] All journeys at both viewports; findings under `## Findings — creator` in this story
- [x] State/error coverage verdict per state
- [x] Objective WCAG findings filed directly as items

## Findings — creator

### Journey C1 — First-time OBS setup

- [creator/desktop] C1-obs-setup — The streaming tab renders all OBS-needed information on one page: server URL + stream key appear together in a banner immediately after key creation. The raw key value has `user-select: all` CSS so triple-click selects it, but there is **no explicit "Copy" button** on the key banner. A creator must manually select and copy the key. Heuristic: Recognition rather than recall. Severity: 2. Evidence: `.memory/scratchpad/streaming-playout-ux-review/creator-desktop-c1-after-key-create.png`. Direction: Add a one-click copy button to the new-key banner.

- [creator/desktop] C1-obs-setup — The RTMP URL in the new-key banner contains a **hardcoded production domain** (`rtmp://stream.s-nc.tv/live/livestream?key=…`), not the server address matching the dev environment. This is expected per environment, but a first-time creator cannot cross-check "is this right?" without external reference. The URL is shown only at key creation time; there is no persistent "connect instructions" section showing the server URL separately. Heuristic: Help and documentation. Severity: 2. Evidence: `.memory/scratchpad/streaming-playout-ux-review/creator-desktop-c1-key-created.png`. Direction: Separate the server URL from the per-key URL; show server URL persistently as a reference; key-specific RTMP URL appears in the creation banner only.

- [creator/desktop] C1-obs-setup — The key creation form uses only `aria-label="Stream key name"` with no visible `<label>` element. The placeholder text "Key name (e.g., OBS Home)" serves as a label but disappears on typing. Heuristic: Match between system and real world (placeholder-as-label anti-pattern). Severity: 2. Evidence: `.memory/scratchpad/streaming-playout-ux-review/creator-desktop-c1-obs-initial.png`. Direction: Add an explicit visible label above the input; retain placeholder as hint.

- [creator/mobile] C1-obs-setup — The create-key form is a horizontal flex row (input + button) at 375px viewport. The button overflows the viewport: button left edge at x=308, button width=115px → right edge at x=423 (48px beyond the 375px viewport). The page exhibits horizontal scroll on mobile. Heuristic: Consistency and standards (mobile layout). Severity: 3. Evidence: `.memory/scratchpad/streaming-playout-ux-review/creator-mobile-c1-form-overflow.png`. Direction: Switch `createForm` to `flex-wrap: wrap` or stack input/button vertically on narrow viewports.

- [creator/desktop] C1-obs-setup — The "Connect Streaming Accounts" section (Twitch/YouTube OAuth) renders with **completely unstyled buttons** (height=19px, padding=0px, no border). The `ConnectButton` component passes `buttonStyles.secondaryButton` as `className`, but `.secondaryButton` is not defined in `button.module.css` — CSS Modules returns `undefined` which React renders as `className=""`. Heuristic: Aesthetic and minimalist design / Consistency and standards. Severity: 3. Evidence: `.memory/scratchpad/streaming-playout-ux-review/creator-desktop-c1-connect-section.png`. Direction: Add `.secondaryButton` definition to `button.module.css`; this is also a bug — file `bug-connect-button-missing-style`.

- [creator/mobile] C1-obs-setup — The unstyled Connect buttons (height=19px) fail WCAG 2.2 SC 2.5.8 Target Size (Minimum): minimum 24x24 CSS pixels. The 19px height is a direct consequence of the missing CSS class bug. Filed: `a11y-creator-connect-button-target-size`. Heuristic: WCAG 2.5.8. Severity: 3. Evidence: `.memory/scratchpad/streaming-playout-ux-review/creator-mobile-c1-connect-buttons.png`.

- [creator/desktop] C1-obs-setup — The page has **no H1 heading**. The first heading is H2 "Stream Keys". In the context shell, the sidebar shows "Maya Chen" but it is not rendered as a heading. Screen readers and document outline have no page-level anchor. Filed: `a11y-creator-streaming-page-no-h1`. Heuristic: WCAG 1.3.1 Info and Relationships. Severity: 2. Evidence: `.memory/scratchpad/streaming-playout-ux-review/creator-desktop-c1-obs-initial.png`.

### Journey C2 — Key rotation

- [creator/desktop] C2-key-rotation — The "Revoke" button on each key row triggers immediate revocation with **no confirmation dialog** and **no warning that the old key stops working**. The action is irreversible (revoked keys cannot be re-activated). The only feedback is a success banner saying `Key "OBS Home" revoked` — which is past-tense, not a consequence warning. Heuristic: Error prevention. Severity: 3. Evidence: `.memory/scratchpad/streaming-playout-ux-review/creator-desktop-c2-before-revoke.png`. Direction: Add a confirmation step ("Revoking this key will disconnect any streaming software using it. This cannot be undone. Continue?").

- [creator/desktop] C2-key-rotation — The "Revoke" button has **no `aria-label`** identifying which key it operates on. Multiple keys render multiple "Revoke" buttons that are identical to screen readers. Filed: `a11y-creator-revoke-button-no-label`. Heuristic: WCAG 2.4.6 Headings and Labels / 4.1.2 Name, Role, Value. Severity: 2. Evidence: `.memory/scratchpad/streaming-playout-ux-review/creator-desktop-c2-before-revoke.png`.

- [creator/mobile] C2-key-rotation — After revoking, the revoked-keys section grows to show all historical revoked entries with no limit or collapsing. A creator who has rotated keys several times will see an expanding list of grayed-out revoked entries below their active keys. There is no "hide revoked keys" toggle. Heuristic: Aesthetic and minimalist design. Severity: 1. Evidence: `.memory/scratchpad/streaming-playout-ux-review/creator-mobile-c2-revoked-state.png`. Direction: Collapse the revoked list behind a disclosure toggle ("Show N revoked keys").

- [creator/desktop] C2-key-rotation — The revoke button lacks keyboard focus indicator: `outline: none` is set globally for buttons without an explicit focus-visible override. Keyboard users tabbing to "Revoke" see no visible focus ring. Filed: `a11y-creator-revoke-button-focus`. Heuristic: WCAG 2.4.7 Focus Visible. Severity: 3. Evidence: (code-read confirmed; no focus CSS rule for `.revokeButton:focus-visible`).

### Journey C3 — Simulcast destination CRUD

- [creator/desktop] C3-simulcast-crud — When a creator adds/removes/toggles a simulcast destination, **no information is shown about when the change takes effect relative to an in-progress stream**. The description says "Destinations stay active across all your streams until you toggle them off" — implying the change is live — but the service code confirms creator changes apply only on the **next publish** (not immediately; `on_forward` fires only at stream start). A creator editing destinations while live will believe the change is immediate when it is deferred. Heuristic: Visibility of system status. Severity: 3. Evidence: `.memory/scratchpad/streaming-playout-ux-review/creator-desktop-c3-simulcast-section.png`. Direction: Add a note near the section: "Changes apply the next time you start streaming."

- [creator/desktop] C3-simulcast-crud — The "Add Destination" form's "RTMP URL" field uses HTML `type="url"`, which accepts any syntactically valid URL (e.g., `https://invalid.example.com`). The Zod schema on the backend uses `z.string().url()` which also accepts non-RTMP protocols. A destination with `rtmpUrl = "https://invalid.example.com"` is accepted and saved without error. OBS-style RTMP streaming requires `rtmp://` protocol; an `https://` destination will silently fail at stream time with no diagnostic in the UI. Heuristic: Error prevention. Severity: 3. Evidence: `.memory/scratchpad/streaming-playout-ux-review/creator-desktop-c3-after-https-submit.png`. Direction: Validate `rtmpUrl` must start with `rtmp://` or `rtmps://` at both API and form levels; show inline validation error on change.

- [creator/desktop] C3-simulcast-crud — The delete confirmation uses `window.confirm()` (browser native dialog). The text "Delete this simulcast destination?" does not identify which destination by name. On a page with multiple destinations this fails the NN/g "match between system and real world" — the system should echo the destination label in the confirmation. Heuristic: Match between system and real world. Severity: 2. Evidence: `.memory/scratchpad/streaming-playout-ux-review/creator-desktop-c3-dest-list-with-toggle.png`. Direction: Replace with inline confirmation or a modal that names the destination ("Delete 'My Twitch'?").

- [creator/desktop] C3-simulcast-crud — New destinations default to **Inactive**. The toggle UI shows "Activate" meaning the user must take an extra step to enable a destination. There is no onboarding hint explaining this. Heuristic: Visibility of system status / Help and documentation. Severity: 1. Evidence: `.memory/scratchpad/streaming-playout-ux-review/creator-desktop-c3-dest-created.png`. Direction: Either default to Active on create (with a clear indication) or add explanatory copy "New destinations start inactive — activate when ready."

- [creator/desktop] C3-simulcast-crud — The "Add Destination" form renders an `<h2>Add Destination</h2>` **inside the form**, which is inside the "Simulcast Destinations" section that already has an `<h2>Simulcast Destinations</h2>`. Two sibling H2s with a parent–child relationship creates a broken heading outline. Filed: `a11y-creator-form-heading-hierarchy`. Heuristic: WCAG 1.3.1 Info and Relationships. Severity: 2. Evidence: `.memory/scratchpad/streaming-playout-ux-review/creator-desktop-c3-add-form.png`.

- [creator/mobile] C3-simulcast-crud — The destination list item (`destItem`) uses flex row layout that overflows its container on mobile: `destInfo.scrollWidth = 319 > itemWidth = 311` (8px overflow). The platform name, label, masked key, and status tags crowd the row. The three action buttons (Activate, Edit, Delete) sit beside the info in the same flex row. Heuristic: Flexibility and efficiency of use (responsive). Severity: 2. Evidence: `.memory/scratchpad/streaming-playout-ux-review/creator-mobile-c3-mobile-dest-item.png`. Direction: Stack info and actions vertically on mobile or wrap the action row below the info.

- [creator/desktop] C3-simulcast-crud — The simulcast form input/select `focus` state sets `outline: none` and relies on `border-color` change to `var(--color-accent)`. The 1px border-color change from gray to orange satisfies minimal visual focus feedback, but there is no `focus-visible` guard — focus is shown on click too (not just keyboard). This is not a hard WCAG violation (border color change passes 2.4.7 at 16px text) but is inconsistent with the `focus-visible` pattern used on other interactive elements (e.g., bell button). Heuristic: Consistency and standards. Severity: 1. Evidence: code-read (`simulcast-destination-manager.module.css` line 56: `outline: none`). Direction: Replace `outline: none` + border-change with `outline: 2px solid var(--color-accent); outline-offset: 2px` on `:focus-visible`; remove the border-color change.

### State inspection coverage

| State | Component | Where triggered | Verdict |
|-------|-----------|-----------------|---------|
| Loading stream keys | `streaming.tsx` | `useEffect` on mount | **handled-well** — `isCreating` gate; keys loaded async; form disabled during create |
| Load keys error | `streaming.tsx` | `loadKeys()` catch | **handled-poorly** — sets `setError("Failed to load stream keys")` but the error clears on next action; no retry affordance |
| Key creation in-progress | `streaming.tsx` | `handleCreate` | **handled-well** — `isCreating` disables form, button shows "Creating…" |
| Key creation success | `streaming.tsx` | `handleCreate` | **handled-well** — success banner + new-key disclosure banner; copy-by-selection available |
| Key creation error | `streaming.tsx` | `handleCreate` catch | **handled-well** — error set; displayed as `role="alert"` |
| Key revocation (no confirmation) | `streaming.tsx` | `handleRevoke` | **handled-poorly** — immediate with no confirmation, no consequence warning |
| Key revocation error | `streaming.tsx` | `handleRevoke` catch | **handled-well** — error surfaced |
| Permission denied (non-owner) | `streaming.tsx` | `!isOwner` guard | **handled-poorly** — shows "Only creator owners can manage stream keys." with no explanation of who an owner is or how to become one; no streaming info visible to members |
| Simulcast loading | `simulcast-destination-manager.tsx` | `useEffect` | **handled-well** — shows "Loading…" text |
| Simulcast load error | `simulcast-destination-manager.tsx` | `loadDestinations` catch | **handled-well** — `role="alert"` error shown |
| Simulcast empty state | `simulcast-destination-manager.tsx` | `destinations.length === 0` | **handled-well** — "No simulcast destinations configured." shown |
| At destination limit (5) | `simulcast-destination-manager.tsx` | `atLimit` | **handled-well** — button disabled; counter shown ("X of 5 destinations") |
| Form submit in-progress | `simulcast-destination-manager.tsx` | `isSubmitting` | **handled-well** — Save button shows "Saving…", disabled |
| Form submit error (API) | `simulcast-destination-manager.tsx` | `handleSubmit` catch | **handled-well** — `formError` shown as `role="alert"` inside form |
| Invalid RTMP URL (https://) | `simulcast-destination-manager.tsx` | `handleSubmit` → API | **unhandled** — `z.string().url()` accepts https://; saved silently; no validation at form or API level for rtmp:// protocol |
| Toggle active error | `simulcast-destination-manager.tsx` | `handleToggleActive` catch | **handled-well** — list-level error shown |
| Delete error | `simulcast-destination-manager.tsx` | `handleDelete` catch | **handled-well** — list-level error shown |
| Live vs offline semantics | both files | no explicit state | **unhandled** — no indicator of live status; no "changes apply next stream" messaging |
| ConnectButton OAuth error | `streaming.tsx` | search param `?error=` | **handled-well** — `connectError` shown in connect section |
| ConnectButton OAuth success | `streaming.tsx` | search param `?connected=` | **handled-well** — success shown with "Review the new destination below and activate it when ready" |
| ConnectButton connecting state | `streaming.tsx` | `isConnecting` state | **handled-well** — button shows "Connecting to Twitch…" during redirect |

## Implementation notes

### Journeys walked

- C1 (First-time OBS setup): walked at both desktop (1440x900) and mobile (375x812). Completed.
- C2 (Key rotation): walked at both viewports. Completed.
- C3 (Simulcast destination CRUD): walked at both viewports including add/edit/delete cycle. Completed. Cleanup: all test destinations removed (final count = 0).
- All test stream keys created during audit are revoked (revoked keys are retained as historical record per application behavior; not deleted; this is expected).

### Screenshot inventory

65 creator-prefixed screenshots in `.memory/scratchpad/streaming-playout-ux-review/`. Key files:
- `creator-desktop-c1-*` / `creator-mobile-c1-*` — OBS setup journey
- `creator-desktop-c2-*` / `creator-mobile-c2-*` — key rotation before/after
- `creator-desktop-c3-*` / `creator-mobile-c3-*` — simulcast CRUD including form states, toggle, delete

### Unverified observations

- **Permission-denied for non-owner team member**: verified by code-read only. The `!isOwner` guard renders a plain "Only creator owners can manage stream keys." paragraph. No live screenshot (would require logging in as a non-owner member of Maya's creator; not done to avoid creating additional test state).
- **Add/remove while live**: live streaming not active during audit. The live-reload semantics finding (`C3-simulcast-crud` severity 3) is grounded in service code reading (`simulcast.ts` comment on line 203: "Creator forward changes apply on next stream — no SRS restart needed") rather than a live observation.
- **State during load**: `isLoading` spinner not captured as screenshot (network too fast in dev environment); verified by code-read.

### Key bugs found (filed as backlog items)

- `bug-connect-button-missing-style`: `ConnectButton` references `buttonStyles.secondaryButton` which is not defined in `button.module.css`; renders as completely unstyled button.
- A11y items filed: `a11y-creator-connect-button-target-size`, `a11y-creator-streaming-page-no-h1`, `a11y-creator-revoke-button-no-label`, `a11y-creator-revoke-button-focus`, `a11y-creator-form-heading-hierarchy`.

### Commit pending

Git is unavailable in this container; no commit made.
