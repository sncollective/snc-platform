---
id: live-experience-redesign-layout-ergonomics
kind: feature
stage: implementing
tags: [streaming]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-06-12
updated: 2026-06-13
parent: live-experience-redesign
---

# Layout ergonomics — stream-first mobile, fullscreen, controls

## Brief
The page layout serves watching. Mobile is restructured stream-first (epic design
decision): player on top, then a tabbed/sheet area where chat is one opt-in tab
(Twitch-mobile pattern) — replacing today's fixed 400px always-on chat panel that
consumes half the viewport with no collapse (sev-3). Mobile gains a distraction-free
affordance via the player's native fullscreen (Vidstack supports it; theater mode stays
desktop-only — epic design decision). Mini-player touch targets are raised to a 44px
target (absorbs backlog item `a11y-viewer-mini-player-touch-target` — close it when
this lands; sev-3 on mobile at today's 24×24px). Desktop control polish rides along:
the theater toggle gets a stable low-opacity resting state instead of opacity:0 (it's
undiscoverable today, sev-2), and the Unicode-glyph controls (⤢, ✕, →, ←) are replaced
with recognizable panel/theater icons (sev-1 ×2).

Spine-independent: pure layout/interaction work, no live-data dependency. Does NOT
cover what the indicators say (sibling `live-state` owns badge semantics — but this
feature owns WHERE status surfaces live in the mobile layout, so coordinate placement
during design) or page states (sibling `page-states`).

Audit grounding: viewer findings V2 (theater/chat-collapse family) and V4
(mini-player targets) in the `streaming-playout-ux-review-viewer-audit` story
(archived; body at git 85151fd). Mini-player reload persistence (V4, sev-1) is
explicitly deferred — not in scope.

## Epic context
- Parent epic: `live-experience-redesign`
- Position in epic: independent capability — parallel to `page-states`. Both touch
  `live.tsx` heavily; see the epic's decomposition risks for the write-overlap note.

## Foundation references
- `docs/ux-decisions.md` — mobile-ergonomics evidence (bottom-tabs, touch targets)

## Design decisions

Resolved with judgment (lane delegation; no interactive checkpoint available). Advisory
peer pass skipped — the epic pinned the load-bearing choices (stream-first restructure,
fullscreen-not-theater on mobile); what remains is mechanism selection.

- **Mobile chat-tab state is ephemeral, not persisted**: chat is opt-in per visit
  (Twitch-mobile pattern). Persisting the tab would resurface a half-screen chat on
  return visits — recreating the very audit complaint for anyone who once opened chat.
  Desktop's persisted `chatCollapsed` pref is untouched.
- **Context signal (`liveMobileChatOpen`) over JS viewport detection**: the route
  signals root through the existing global-player-context layout-signal channel
  (`liveLayout`, `chatCollapsed` already flow this way); CSS media queries decide what
  the signal means per viewport. Rejected: a `useMediaQuery` hook + rendering ChatPanel
  inline on mobile — double render path, panel remount (rejoin + room refetch) on
  viewport crossing, and a new JS viewport dependency where CSS suffices.
- **Status placement — `streamInfo` (channel selector + StreamStatusBar) sits ABOVE
  the mobile tab bar**, visible regardless of active tab. ⚠ Coordination note for the
  sibling `live-state` design: on mobile, status indicators live in the always-visible
  `streamInfo` row between the player and the tabs — put badge changes there, not in
  the tabbed region.
- **Tabs render only while streaming** — offline/loading states (from `page-states`)
  own the non-streaming page; a chat tab with no chat room is dishonest UI.
- **Touch targets via padded hit-area (44px hit, 24px visual)** using
  `background-clip: content-box` — satisfies WCAG 2.5.8 on every pointer type without
  visually bloating the 200px-wide mobile mini-player. Rejected: 44px visual circles
  (two of them cover ~half the mini-player width); rejected: `pointer: coarse`-only
  enlargement (desktop touchscreens exist; the padded hit area costs nothing).
- **Lucide icons** (`lucide-react`, already a dependency and the project idiom —
  `import { X } from "lucide-react"` named imports). Rejected: Vidstack's icon entry
  point — `@vidstack/react` is dynamically imported everywhere else because its module
  init is SSR-unsafe; importing icons statically into the SSR'd live route is a risk
  with no upside over lucide.
- **Fullscreen affordance = Vidstack's own small-layout fullscreen button**: the
  DefaultVideoLayout small layout ships a fullscreen control; the story verifies it
  renders for live streams in the running app (platform fix-verify loopback) and only
  adds an explicit slot override if it turns out suppressed. No page-level fullscreen
  button.
- **Mini-player reload persistence stays deferred** (pinned by the brief).

## Architectural choice

**Route-owned tab state + one new layout signal, CSS-scoped per viewport** (chosen).
The live route owns a `mobileChatOpen` boolean and renders a mobile-only tab bar
(`Info | Chat`) below the `streamInfo` row; it signals root via a new
`liveMobileChatOpen` field in global-player-context (the established layout-signal
channel). Root CSS shows/hides the `chatPortal` cell and switches the live grid to a
viewport-filling column when chat is open; route CSS hides the info sections. Desktop
behavior (side panel + collapse toggle + theater) is untouched — all new rules live
under `max-width: 767px` (or change the base rules that the existing `min-width: 768px`
block already overrides).

Rejected:
- **JS viewport detection + inline mobile ChatPanel** — see Design decisions.
- **Root-rendered tab bar** — the cells being toggled live in root's grid, but the tab
  bar is live-page UI; root's AppShell is a generic shell (its only live-awareness is
  class composition from context signals). A root tab bar would hardcode live-page
  semantics into the shell.

## Implementation Units

### Unit 1: Mobile stream-first tab restructure (trickiest)
**Files**: `apps/web/src/contexts/global-player-context.tsx`,
`apps/web/src/routes/live.tsx`, `apps/web/src/routes/live.module.css`,
`apps/web/src/routes/__root.tsx`, `apps/web/src/routes/__root.module.css`
**Story**: `live-experience-redesign-layout-ergonomics-mobile-tabs`

**Context extension** (follow the existing field pattern exactly — state field +
action + reducer case + INITIAL_STATE + cleanup-on-unmount semantics):

```tsx
// global-player-context.tsx
export interface GlobalPlayerState {
  // ...existing...
  /** Whether the mobile live layout shows the chat tab. Set by the live page. */
  readonly liveMobileChatOpen: boolean;
}
export interface GlobalPlayerActions {
  // ...existing...
  /** Signal whether the mobile chat tab is open. Pass false on unmount. */
  readonly setLiveMobileChatOpen: (open: boolean) => void;
}
// action type: { readonly type: "SET_LIVE_MOBILE_CHAT"; readonly open: boolean }
// INITIAL_STATE: liveMobileChatOpen: false
```

**live.tsx** — local ephemeral state + tab bar + info-section wrapper + signal:

```tsx
const [mobileChatOpen, setMobileChatOpen] = useState(false);

// Signal root (alongside the existing liveLayout/chatCollapsed effects)
useEffect(() => {
  actions.setLiveMobileChatOpen(isStreaming && mobileChatOpen);
  return () => actions.setLiveMobileChatOpen(false);
}, [mobileChatOpen, isStreaming, actions]);
```

```tsx
/** Mobile-only tab switcher between stream info and chat. Hidden ≥768px via CSS. */
function MobileTabBar({
  chatOpen,
  onSelect,
}: {
  readonly chatOpen: boolean;
  readonly onSelect: (chatOpen: boolean) => void;
}): React.ReactElement {
  return (
    <div className={styles.mobileTabBar} role="tablist" aria-label="Live page sections">
      <button
        type="button"
        role="tab"
        aria-selected={!chatOpen}
        aria-controls="live-info-panel"
        className={clsx(styles.mobileTab, !chatOpen && styles.mobileTabActive)}
        onClick={() => onSelect(false)}
      >
        Info
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={chatOpen}
        aria-controls="live-chat-panel"
        className={clsx(styles.mobileTab, chatOpen && styles.mobileTabActive)}
        onClick={() => onSelect(true)}
      >
        Chat
      </button>
    </div>
  );
}
```

`routeContent` restructure — order: `streamInfo` (stays first, always visible), then
the tab bar (streaming only), then the info sections wrapped:

```tsx
{isStreaming && (
  <MobileTabBar chatOpen={mobileChatOpen} onSelect={setMobileChatOpen} />
)}
<div
  id="live-info-panel"
  role="tabpanel"
  className={clsx(styles.infoSections, mobileChatOpen && styles.infoSectionsChatOpen)}
>
  {/* nowPlaying block + StreamCreatorBar move inside, unchanged */}
</div>
```

Chat portal render condition widens (desktop-collapsed must not block the mobile tab),
and the portal content gains the tabpanel wrapper:

```tsx
{portalTarget && (!prefs.chatCollapsed || mobileChatOpen) &&
  createPortal(
    <div id="live-chat-panel" role="tabpanel" className={styles.chatTabPanel}>
      <ChatPanel channelId={selectedChannelId} />
    </div>,
    portalTarget,
  )}
```

**live.module.css**:

```css
.mobileTabBar { display: flex; border-bottom: 1px solid var(--color-border); }
.mobileTab {
  flex: 1; padding: var(--space-sm); background: none; border: none;
  border-bottom: 2px solid transparent; color: var(--color-text-muted);
  font-size: var(--font-size-sm); cursor: pointer;
}
.mobileTabActive { color: var(--color-text); border-bottom-color: var(--color-accent); }
.chatTabPanel { height: 100%; }
@media (max-width: 767px) {
  .infoSectionsChatOpen { display: none; }
}
@media (min-width: 768px) {
  .mobileTabBar { display: none; }
}
```

**__root.tsx** — compose the new class from the signal:

```tsx
const isMobileChatOpen = playerState.liveMobileChatOpen;
// on <main>:
isLiveLayout && isMobileChatOpen && styles.liveGridMobileChat,
```

**__root.module.css** — base (mobile) `chatPortal` becomes hidden-by-default; chat-open
mode turns the live column into a viewport-filling layout:

```css
.chatPortal {
  display: none; /* mobile default: chat lives behind the Chat tab */
  border-top: 1px solid var(--color-border);
  overflow: hidden;
}
.liveGridMobileChat {
  height: calc(100dvh - var(--nav-height) - var(--tab-bar-height, 0px) - var(--demo-banner-height, 0px));
  overflow: hidden;
}
.liveGridMobileChat .outletColumn { flex: 0 0 auto; overflow: visible; }
.liveGridMobileChat .chatPortal { display: flex; flex: 1 1 auto; min-height: 0; }
.liveGridMobileChat .chatPortal > * { flex: 1; min-height: 0; }
@media (min-width: 768px) {
  .chatPortal { display: block; /* existing grid rules unchanged */ }
  /* .liveGridMobileChat is inert ≥768px — no rules needed; signal only fires from the
     mobile-only tab bar, and desktop grid rules don't read it */
}
```

(The existing 400px fixed height on `.chatPortal` is deleted — mobile chat now fills
the remaining viewport below the player and tab bar; ChatPanel's `.panel` is already
`height: 100%` flex.)

**Implementation Notes**:
- Footer renders inside `outletColumn` on the live layout; with chat open the
  `outletColumn` keeps only `streamInfo` + tab bar visible (info sections hidden), and
  the grid container is `overflow: hidden`, so the footer is below the fold of a
  non-scrolling container — acceptable; if it visually intrudes, hide it with
  `.liveGridMobileChat .outletColumn footer { display: none; }`.
- The reducer is pure and exported — extend `global-player-context.test.tsx`
  (INITIAL_STATE shape + new action case).
- `live.test.tsx` mocks `useGlobalPlayer` with an explicit actions object — add
  `setLiveMobileChatOpen: vi.fn()` there.
- Desktop is structurally untouched: tab bar `display: none` ≥768px, signal stays
  false (only the mobile-visible tab bar sets it), `.liveGridMobileChat` has no
  desktop rules.

**Acceptance Criteria**:
- [ ] Mobile (<768px), streaming: page shows player → channel selector + status row →
      `Info | Chat` tabs → info content; chat is NOT visible by default
- [ ] Selecting Chat hides the info sections and fills the viewport below the tabs
      with the chat panel (no fixed 400px band, no page scroll trap); selecting Info
      restores the info content
- [ ] Tab state resets on revisit (ephemeral) and never renders while offline/loading
- [ ] Desktop (≥768px): no tab bar; side chat column, collapse toggle, and theater
      behave exactly as before (existing tests unchanged)
- [ ] Tabs carry `role="tablist"/"tab"`, `aria-selected`, `aria-controls` wired to the
      two panel ids
- [ ] Reducer/context tests cover the new field and action

---

### Unit 2: Player chrome — mini-player touch targets + mobile fullscreen verification
**Files**: `apps/web/src/components/media/global-player.module.css` (+
`global-player.tsx` only if the fullscreen slot fix is needed)
**Story**: `live-experience-redesign-layout-ergonomics-player-chrome`

```css
.expandButton,
.closeButton {
  /* 44×44 hit area (WCAG 2.5.8/2.5.5), 24px visible circle */
  width: 44px;
  height: 44px;
  padding: 10px;
  background-clip: content-box;
  /* border-radius, colors, flex centering unchanged */
}
```

Verify `.collapsedActions` positioning still clears the player corner (top/left offsets
may need `calc(var(--space-xs) - 10px)` compensation so the *visible* circles keep
today's position — clamp at 0).

**Fullscreen verification**: run the app mobile-viewport (375px) on a live channel and
confirm the Vidstack small video layout shows its fullscreen button with the current
`slots={{ timeSlider: null }}` config. If present → done (record in story notes +
fix-verify). If suppressed → add the explicit slot
(`slots={{ timeSlider: null, fullscreenButton: <modules.layouts… default button> }}`
or adjust `smallLayoutWhen`) and re-verify.

Absorbs backlog `a11y-viewer-mini-player-touch-target` — **delete
`.work/backlog/a11y-viewer-mini-player-touch-target.md` in this story's commit**.

**Acceptance Criteria**:
- [ ] Mini-player expand/close buttons have ≥44×44px hit areas at both breakpoints;
      visible circle stays ~24px; buttons remain visually inside the overlay corner
- [ ] Fullscreen affordance confirmed available on the mobile live player (or slot fix
      applied and confirmed) — user-confirmed via fix-verify loopback
- [ ] Backlog item file deleted

---

### Unit 3: Desktop control polish — resting visibility + recognizable icons
**Files**: `apps/web/src/routes/live.tsx`, `apps/web/src/routes/live.module.css`
**Story**: `live-experience-redesign-layout-ergonomics-desktop-controls`
(depends_on: `live-experience-redesign-layout-ergonomics-mobile-tabs` — same files,
serialized)

```tsx
import { Maximize2, X, PanelRightClose, PanelRightOpen } from "lucide-react";

// theater toggle content: {prefs.theater ? <X size={16} /> : <Maximize2 size={16} />}
// chat toggle content: {prefs.chatCollapsed ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />}
```

```css
/* Resting state: discoverable, still unobtrusive */
.theaterToggle,
.chatToggleTab {
  opacity: 0.4;
  transition: opacity 0.2s ease;
  pointer-events: auto; /* clickable even at rest */
}
.theaterToggle.controlVisible,
.chatToggleTab.controlVisible,
.theaterToggle:hover,
.theaterToggle:focus-visible,
.chatToggleTab:hover,
.chatToggleTab:focus-visible {
  opacity: 1;
}
```

**Implementation Notes**:
- aria-labels, titles, and `aria-pressed` are already correct — keep them; only the
  glyph children and the opacity rules change.
- lucide-react icons render inline SVGs and are SSR-safe (already used in SSR'd
  routes: feed, creators, governance/projects).
- Existing tests target the buttons by `aria-label` — they should pass untouched;
  extend with an assertion that the buttons are clickable without prior mousemove
  (no `pointer-events: none` gating) if cheaply testable, else rely on fix-verify.

**Acceptance Criteria**:
- [ ] Theater + chat toggles rest at visible low opacity and are clickable without
      first moving the mouse; full opacity on hover/focus/controls-active
- [ ] Unicode glyphs (⤢, ✕, →, ←) replaced with Maximize2/X and
      PanelRightClose/PanelRightOpen lucide icons at 16px
- [ ] Keyboard focus (`:focus-visible`) raises opacity (a11y parity with hover)

---

## Implementation Order

1. `live-experience-redesign-layout-ergonomics-mobile-tabs` (Unit 1) and
   `live-experience-redesign-layout-ergonomics-player-chrome` (Unit 2) — parallel
   (disjoint files)
2. `live-experience-redesign-layout-ergonomics-desktop-controls` (Unit 3) — after
   mobile-tabs (shared `live.tsx`/`live.module.css` write-set)

## Testing

### `tests/unit/contexts/global-player-context.test.tsx`
- INITIAL_STATE includes `liveMobileChatOpen: false`; `SET_LIVE_MOBILE_CHAT` action
  sets/unsets it; `CLEAR` resets it (it returns INITIAL_STATE — assert that holds).

### `tests/unit/routes/live.test.tsx`
- Streaming state → tab bar present (`role="tablist"`, two tabs, Info selected);
  clicking Chat sets `aria-selected` on the Chat tab and calls the (mocked)
  `setLiveMobileChatOpen(true)`; info panel gains the hidden-class.
- Not streaming (offline/loading) → no tablist rendered.
- Mock update: add `setLiveMobileChatOpen` to the mocked actions object.
- Desktop visual behavior (media queries) is NOT assertable in jsdom — class wiring
  only; visual confirmation via fix-verify loopback.

### Unit 2/3 visual work
- jsdom cannot verify hit-area geometry, opacity resting states, or Vidstack's
  rendered layout — these ride the platform fix-verify loopback (user confirms in the
  running app before stories close). Unit 3's icon swap is assertable (lucide renders
  `<svg>` — assert the buttons contain an svg instead of the old glyph text).

## Risks

- **Mobile chat-fill height math** (`100dvh` minus nav/tab-bar/demo-banner): browser
  chrome variance and the optional demo banner make this the most likely visual bug.
  Mitigation: `dvh` units (not `vh`), the existing `--tab-bar-height`/
  `--demo-banner-height` tokens, and fix-verify confirmation at 375px.
- **Vidstack small-layout fullscreen assumption**: if the live config suppresses the
  fullscreen button, Unit 2 carries the named slot fix; verified in the running app
  either way.
- **Sibling `live-state` will edit `live.tsx` later** (cross-epic, spine-dependent):
  the status-placement coordination note in Design decisions is written for its
  designer; this feature leaves `StreamStatusBar` untouched in the always-visible
  `streamInfo` row.
- **`.chatPortal` base-rule change** (400px → hidden-by-default): any non-live page
  renders `chatPortalHidden` anyway (`display: none`), so the only consumer is the
  live layout — verified by reading `__root.tsx` (the class pair is exhaustive).
