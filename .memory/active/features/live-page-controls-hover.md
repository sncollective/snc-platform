---
id: feature-live-page-controls-hover
kind: feature
stage: review
tags: [streaming, ux-polish]
release_binding: null
created: 2026-04-18
updated: 2026-04-18
related_decisions: []
related_designs: []
parent: null
---

# Live Page Controls Hover Behavior

## Overview

Make all live page controls (theater toggle, chat expand tab, theater overlay) fade in/out based on hover/activity over the content area. Currently the theater toggle and chat expand tab are always visible. The theater overlay already has its own hover logic — unify all controls under one system.

**Desktop**: Controls appear on mouse movement over the content area, hide after 2s of inactivity.
**Mobile (touch)**: Tap the content area to show controls, auto-hide after 3s.

---

## Implementation Units

### Unit 1: Content Area Hover Tracking

**File**: `apps/web/src/routes/live.tsx`

Add a hover/activity tracking system to the streaming content area. This replaces the theater overlay's independent hover tracking with a unified approach.

```typescript
// New state for control visibility
const [controlsVisible, setControlsVisible] = useState(false);
const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

// Unified handler for mouse movement and touch
const showControls = useCallback(() => {
  setControlsVisible(true);
  if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
  hideTimeoutRef.current = setTimeout(() => {
    setControlsVisible(false);
  }, 2000); // 2s desktop, overridden to 3s for touch
}, []);

const showControlsTouch = useCallback(() => {
  setControlsVisible(true);
  if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
  hideTimeoutRef.current = setTimeout(() => {
    setControlsVisible(false);
  }, 3000); // 3s for touch
}, []);

// Cleanup on unmount
useEffect(() => {
  return () => {
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
  };
}, []);
```

**Attach to the content container** — the `<div>` that wraps the player and stream info. Add:

```tsx
<div
  className={styles.contentArea}
  onMouseMove={showControls}
  onMouseLeave={() => {
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    setControlsVisible(false);
  }}
  onTouchStart={showControlsTouch}
>
  {/* player, stream info, etc. */}
</div>
```

**Pass `controlsVisible` to controls via a data attribute or class**:

The theater toggle, chat expand tab, and theater overlay all get a conditional class:

```tsx
<button
  className={clsx(
    styles.theaterToggle,
    prefs.theater && styles.theaterToggleActive,
    prefs.chatCollapsed && styles.theaterToggleCollapsed,
    controlsVisible && styles.controlVisible,
  )}
  // ...existing props
>
```

Same for `.chatExpandTab`:
```tsx
<button
  className={clsx(styles.chatExpandTab, controlsVisible && styles.controlVisible)}
  // ...existing props
>
```

**Theater overlay**: Remove its independent mouse tracking (`useState`, `useEffect` with mousemove listener, `onMouseEnter`/`onMouseLeave`). Instead, the overlay visibility is driven by `controlsVisible` from the parent:

```tsx
// TheaterOverlay component now receives controlsVisible as a prop
function TheaterOverlay({
  channel,
  onExitTheater,
  visible,
}: {
  readonly channel: Channel | null;
  readonly onExitTheater: () => void;
  readonly visible: boolean;
}): React.ReactElement | null {
  // Remove all internal hover state/effects
  return (
    <div
      className={clsx(styles.theaterOverlay, visible && styles.theaterOverlayVisible)}
    >
      {/* ...existing content */}
    </div>
  );
}
```

Pass `controlsVisible` as `visible` prop:
```tsx
<TheaterOverlay
  channel={selectedChannel}
  onExitTheater={() => updatePrefs({ theater: false })}
  visible={controlsVisible}
/>
```

**Implementation Notes**:

- The `contentArea` wrapper may need to be added if no suitable container exists. Check the current JSX structure — the player + info live inside a flex column. Wrap that section.
- `onMouseMove` fires frequently — the callback is lightweight (just setting state + rescheduling timeout) so performance is fine.
- The `onMouseLeave` handler immediately hides controls. This prevents controls from lingering when the mouse leaves the content area entirely.
- Touch events: `onTouchStart` shows controls with 3s timeout. No `onTouchEnd` hide needed — the timeout handles it. This matches YouTube/Twitch mobile behavior.

**Acceptance Criteria**:

- [ ] Controls hidden by default on page load
- [ ] Mouse movement over content area shows controls
- [ ] Controls hide after 2s of no mouse movement
- [ ] Mouse leaving content area immediately hides controls
- [ ] Touch on content area shows controls for 3s
- [ ] Theater overlay driven by same visibility state (no independent hover)

---

### Unit 2: CSS Transitions for Control Visibility

**File**: `apps/web/src/routes/live.module.css`

Add opacity transitions to all controls:

```css
/* ── Shared Control Visibility ── */

.theaterToggle {
  /* ...existing styles... */
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
}

.theaterToggle.controlVisible {
  opacity: 1;
  pointer-events: auto;
}

.chatExpandTab {
  /* ...existing styles... */
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
}

.chatExpandTab.controlVisible {
  opacity: 1;
  pointer-events: auto;
}

/* Theater overlay already has opacity: 0 and transition — just ensure .controlVisible works */
/* The existing .theaterOverlayVisible class is replaced by the parent-driven visibility */

/* ── Content Area ── */

.contentArea {
  position: relative;
  /* Existing flex column layout stays */
}

/* ── Mobile: controls always visible (no hover on touch) ── */
/* Override: on mobile, controls are shown via tap, but CSS fallback ensures
   they're not permanently hidden if JS hasn't fired yet */

@media (max-width: 768px) {
  .theaterToggle,
  .chatExpandTab {
    /* Keep display: none on mobile — theater mode is desktop-only */
    display: none;
  }
}
```

**Implementation Notes**:

- Add `opacity: 0` and `pointer-events: none` as the default state for `.theaterToggle` and `.chatExpandTab`.
- `.controlVisible` sets `opacity: 1` and `pointer-events: auto`.
- The `transition: opacity 0.2s ease` provides the fade effect.
- Theater overlay: remove the `:hover` rule on `.theaterOverlay` (line 65-66 of current CSS). Visibility is now fully JS-driven via `.theaterOverlayVisible`.
- Mobile stays as-is — theater toggle and chat expand are hidden via `display: none`. Theater mode itself is desktop-only.

**Acceptance Criteria**:

- [ ] Controls fade in over 0.2s
- [ ] Controls fade out over 0.2s
- [ ] Hidden controls don't receive pointer events
- [ ] Mobile: theater/chat controls stay hidden (existing behavior)

---

## Implementation Order

1. **Unit 2** — CSS changes (add opacity/transition defaults)
2. **Unit 1** — JS hover tracking + TheaterOverlay refactor

## Testing

### Unit Tests: `apps/web/tests/unit/routes/live.test.tsx`

If this file exists, update for the TheaterOverlay prop change (`visible` instead of internal state). If not, no new test file needed — this is a behavioral/visual change best verified manually.

Key test cases if testing:
- `controlsVisible` starts as `false`
- `onMouseMove` on content area sets `controlsVisible` to `true`
- After 2s timeout, `controlsVisible` returns to `false`
- `onMouseLeave` immediately hides controls

## Verification Checklist

```bash
bun run --filter @snc/web test
```
