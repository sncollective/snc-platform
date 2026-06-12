---
id: streaming-playout-ux-review-viewer-audit
kind: story
stage: done
tags: [streaming]
release_binding: null
depends_on: [streaming-playout-ux-review-protocol]
gate_origin: null
created: 2026-06-12
updated: 2026-06-12
parent: streaming-playout-ux-review
---

# Viewer surface audit (live page + global player)

Implements Unit 2 of the parent feature's design. Follow the `## Audit protocol`
section in the feature body exactly — record format and journey scripts are mandatory.

Surfaces: `apps/web/src/routes/live.tsx` (default/theater/chat states), the global
player + mini-player persistence. Journeys: cold tune-in; live takeover mid-watch;
navigate-away with docked player; chat as logged-in vs anonymous. State inspection from
code: stream offline, HLS error, status-poll failure, empty chat, moderation states.

## Acceptance
- [x] All journeys at both viewports; findings under `## Findings — viewer` in the story body
- [x] Error/empty/loading states enumerated with coverage verdict each
- [x] Objective WCAG findings filed directly as items

---

## Findings — viewer

### V1 — Cold tune-in

- [viewer/desktop] V1 cold tune-in (anon) — On arrival the player area is blank for 12–15s
  while Vidstack loads its JS bundle and HLS handshake completes; the page shows only a
  channel selector and viewer count during this window with no skeleton or loading indicator.
  The `playerSkeleton` CSS class exists in `live.module.css` but the component that uses it
  was removed; no animated placeholder fills the 16:9 player area.
  Heuristic: Visibility of system status. Severity: 3.
  Evidence: .memory/scratchpad/streaming-playout-ux-review/viewer-v1-cold-tunein-desktop-anon-initial.png.
  Direction: Add a pulsing skeleton in the 16:9 player area during the Vidstack load/HLS
  startup window (the CSS class already exists — wire it to a loading state).

- [viewer/mobile] V1 cold tune-in (anon) — Same blank player area as desktop; the issue is
  not viewport-specific — both suffer the identical 12–15s invisible loading period.
  Heuristic: Visibility of system status. Severity: 3.
  Evidence: .memory/scratchpad/streaming-playout-ux-review/viewer-v1-cold-tunein-mobile-anon.png.
  Direction: Same skeleton fix as desktop.

- [viewer/desktop] V1 cold tune-in (anon) — When SSR data is absent (loader returns null),
  `isLoading: true` causes `!hasChannels && !isLoading` to stay false, so
  `ComingSoonPlaceholder` is not shown. Channels are simply not rendered. The page loads
  with only a nav bar — no explanation of what the page is for. A new visitor sees a
  blank main area until the first poll resolves (~200ms client-side).
  Heuristic: Visibility of system status. Severity: 2.
  Evidence: .memory/scratchpad/streaming-playout-ux-review/viewer-v1-cold-tunein-desktop-anon-initial.png.
  Direction: Show a brief loading skeleton or spinner in the channel selector zone during
  the initial fetch.

- [viewer/desktop] V1 cold tune-in (anon+loggedin) — The `ComingSoonPlaceholder` shown when
  no channels are active reads "Coming Soon — Live streaming is on its way. Stay tuned." It
  gives no schedule, frequency, or next-on information. A viewer with intent to watch has no
  actionable next step (subscribe, check schedule, come back).
  Heuristic: Help and documentation. Severity: 2.
  Evidence: .memory/scratchpad/streaming-playout-ux-review/viewer-v1-cold-tunein-desktop-anon-initial.png.
  Direction: Link to a schedule page or "get notified" affordance; "Coming Soon" language
  implies this feature is unbuilt, which is misleading when channels exist but are offline.

- [viewer/desktop] V1 cold tune-in — Channel selector is a native `<select>` element; it
  displays "S/NC TV (3 viewers)" and "S/NC Classics (1 viewer)" — combining channel name and
  viewer count in the option text. There is no visual indicator distinguishing a live-creator
  channel from a playout-schedule channel (no icon, no badge, no type label) except for the
  separate `StreamStatusBar` LIVE dot below it, which only renders for `type === "live"`.
  The API type field on S/NC TV is "broadcast" not "live", so the LIVE indicator never
  renders even when a creator stream is active. No affordance for discovering a second channel
  — the selector is the only channel-switch mechanism.
  Heuristic: Match between system and real world. Severity: 2.
  Evidence: .memory/scratchpad/streaming-playout-ux-review/viewer-v1-playing-desktop-15s.png.
  Direction: Either add a channel-type badge/icon inside the selector options or replace the
  native select with a richer channel-picker component; fix the live-indicator type check to
  cover "broadcast" and "playout" channels with a live creator.

- [viewer/mobile] V1 cold tune-in — The channel selector is full-width on mobile but uses the
  native `<select>` which renders a bottom-sheet picker on iOS/Android. The native picker
  leaves the screen and obscures the player; there is no cancellation affordance if the user
  accidentally taps it. For 2 channels this is tolerable; at 5+ channels the native picker
  becomes unwieldy.
  Heuristic: User control and freedom. Severity: 1.
  Evidence: .memory/scratchpad/streaming-playout-ux-review/viewer-v1-cold-tunein-mobile-loggedin.png.
  Direction: Tolerable for current channel count; re-evaluate if channels scale beyond 4.

- [viewer/desktop] V1 — The `StreamStatusBar` shows viewer count as plain text (e.g. "1
  viewer") with no icon. There is no `aria-label` or semantic label communicating what the
  number represents, relying solely on the text suffix. On the playout S/NC Classics channel
  the LIVE indicator correctly does not render (channel is schedule-driven), but there is no
  corresponding "On-Air" or "Scheduled" label to indicate the stream is live playout.
  Viewers cannot distinguish "channel is live scheduled playout" from "channel is
  broadcasting a creator".
  Heuristic: Match between system and real world. Severity: 2.
  Evidence: .memory/scratchpad/streaming-playout-ux-review/viewer-v1-classics-desktop.png.
  Direction: Add a "LIVE" indicator for broadcast channels that have `hlsUrl` set, regardless
  of `type === "live"`; add an "On-Air" or "Scheduled" badge for active playout channels.

### V2 — Theater mode and chat collapse

- [viewer/desktop] V2 theater mode — Theater toggle button is invisible by default (opacity:0,
  pointer-events:none) and only appears on mousemove or touchstart events. The button has no
  stable visual affordance indicating theater mode is available. A viewer who does not move
  the mouse after initial page load will never discover theater mode.
  Heuristic: Recognition rather than recall / Visibility of system status. Severity: 2.
  Evidence: .memory/scratchpad/streaming-playout-ux-review/viewer-v2-theater-on-desktop.png.
  Direction: Show the theater toggle at low but stable opacity (not 0) when not hovering, or
  add a persistent UI control below the player that reveals the mode.

- [viewer/mobile] V2 theater mode — Theater mode toggle (`button[aria-label="Theater mode"]`)
  has `display: none` via CSS media query at <768px. The feature is silently unavailable on
  mobile. No fallback fullscreen or landscape mode is offered. On the iPhone 13 viewport,
  users have no way to watch in a distraction-free expanded mode.
  Heuristic: User control and freedom. Severity: 2.
  Evidence: .memory/scratchpad/streaming-playout-ux-review/viewer-v2-mobile-initial.png.
  Direction: Expose a native fullscreen or rotate-to-landscape affordance on mobile as a
  substitute; or evaluate showing theater mode on mobile given the 375px-wide layout already
  fills most of the screen.

- [viewer/mobile] V2 chat collapse — `chatToggleTab` is also `display: none` at <768px. Chat
  cannot be collapsed on mobile. The 400px-tall chat panel occupies the lower half of the
  screen below the player, with no way for mobile viewers to hide it and see the stream
  full-width (before theater mode is available).
  Heuristic: User control and freedom. Severity: 3.
  Evidence: .memory/scratchpad/streaming-playout-ux-review/viewer-v1-mobile-chat-layout.png.
  Direction: Add a mobile chat-collapse control (swipe-down gesture, visible toggle at top of
  chat panel, or dedicated button near the player) so viewers can prioritize the stream.

- [viewer/desktop] V2 theater mode — Theater toggle uses Unicode "⤢" (U+2922, north-east and
  south-west arrow) to signal expand and "✕" (U+2715) to signal exit. Neither symbol has a
  universally recognized meaning for "theater mode" vs "fullscreen" in the context of a
  streaming page. The `aria-label="Theater mode"` and `aria-pressed` attributes are correct,
  but the visual symbol is ambiguous to sighted users.
  Heuristic: Match between system and real world. Severity: 1.
  Evidence: .memory/scratchpad/streaming-playout-ux-review/viewer-v2-theater-on-desktop.png.
  Direction: Replace with a recognized theater/widescreen icon (e.g. Lucide's `Maximize2` or
  a custom "wide-view" icon) consistent with YouTube/Twitch affordances.

- [viewer/desktop] V2 chat collapse — Chat toggle uses "→" (right arrow, U+2192) to mean
  "hide chat" and "←" (left arrow, U+2190) to mean "show chat". The direction is correct
  (chat is on the right), but the single-arrow affordance does not clearly communicate "this
  is a collapse/expand panel" to first-time viewers. `aria-label` switches correctly between
  "Hide chat" and "Show chat".
  Heuristic: Match between system and real world. Severity: 1.
  Evidence: .memory/scratchpad/streaming-playout-ux-review/viewer-v2-chat-collapsed-desktop.png.
  Direction: Replace arrow characters with a dedicated panel-collapse icon (e.g. Lucide's
  `PanelRightClose` / `PanelRightOpen`), consistent with common streaming UI patterns.

- [viewer/desktop] V2 layout persistence — Verified working: `snc-live-layout` key in
  localStorage stores `theater` and `chatCollapsed` booleans. After reload with theater=true,
  the theater mode was restored. Severity: 0 (not a problem).
  Evidence: .memory/scratchpad/streaming-playout-ux-review/viewer-v2-reload-layout-persist-desktop.png.

### V3 — Live takeover mid-watch

- [viewer/desktop] V3 live takeover — When a live creator stream takes over via the Liquidsoap
  input (confirmed via `Switch to input.ffmpeg` in docker logs), the viewer sees no UI change:
  the channel still shows as "S/NC TV" with "playout"-type behavior. The API's channel-status
  endpoint reports `type: "broadcast"` even during the takeover (because the takeover bypasses
  the SRS stream-key flow and no live-channel row is created). The `liveIndicator` component
  checks `selectedChannel.type === "live"`, which never matches "broadcast". A viewer cannot
  tell from the UI that a live creator is on-air vs the normal schedule.
  Heuristic: Visibility of system status / Match between system and real world. Severity: 3.
  Evidence: .memory/scratchpad/streaming-playout-ux-review/viewer-v3-live-takeover-active-desktop.png.
  Direction: Fix the live-indicator type check to also cover `"broadcast"`; consider a
  dedicated "On Air" overlay or channel-state transition notification.

- [viewer/mobile] V3 live takeover — Same finding as desktop: no UI change visible on mobile
  during the live takeover. Severity: 3.
  Evidence: .memory/scratchpad/streaming-playout-ux-review/viewer-v3-live-takeover-active-mobile.png.

- [viewer/desktop] V3 fallback — After killing the ffmpeg test stream, Liquidsoap switches
  back to playout (`Switch to switch.1 with transition` in docker logs). The viewer sees no
  transition in the UI — the stream continues playing from HLS (which seamlessly picks up the
  playout source). There is no "back to schedule" notice. This is acceptable behavior
  (seamless, no disruption), but the absence of any channel-state identity during the takeover
  means the transition is also invisible in both directions.
  Heuristic: Visibility of system status. Severity: 1.
  Evidence: .memory/scratchpad/streaming-playout-ux-review/viewer-v3-fallback-desktop.png.
  Direction: Pair with the takeover indicator fix above — if the live indicator appears on
  takeover, its disappearance on fallback becomes a natural state signal.

### V4 — Navigate away with player docked

- [viewer/desktop] V4 mini-player — After navigating away from `/live` via a client-side nav
  link (feed nav item), the GlobalPlayer collapses to a 320×180px fixed overlay in the
  bottom-right corner. The stream continues playing (confirmed: `data-playing`, `data-live`
  attributes set). The expand affordance is an "↗" arrow (U+2197) and the dismiss is "✕".
  The `aria-label="Go to content"` is descriptive. The mini-player works correctly for
  desktop. Severity: 0.
  Evidence: .memory/scratchpad/streaming-playout-ux-review/viewer-v4-mini-player-feed-desktop.png.

- [viewer/desktop] V4 expand button — The "Go to content" expand button navigates to
  `/live?channel=<id>`, correctly returning the viewer to the channel they were watching.
  Round-trip return-to-live works. Severity: 0.
  Evidence: .memory/scratchpad/streaming-playout-ux-review/viewer-v4-returned-to-live-desktop.png.

- [viewer/desktop] V4 mini-player collapse buttons — The mini-player `collapsedActions`
  positions the expand (↗) and close (✕) buttons in the top-left corner of the overlay.
  Both buttons are 24×24px circles; at 24px the touch targets are below the WCAG 2.5.5
  recommended 44×44px. On desktop the mouse precision makes this tolerable, but if the mini-
  player appears on a touch-capable device these are difficult to tap. Filed as WCAG item.
  Heuristic: Flexibility and efficiency of use. Severity: 2.
  Evidence: .memory/scratchpad/streaming-playout-ux-review/viewer-v4-mini-player-size-desktop.png.
  Direction: Enlarge buttons to 44×44px touch target or increase tap zone via padding; or
  surface a touch-only larger dismiss affordance.

- [viewer/mobile] V4 mini-player — On mobile (iPhone 13 form factor), after client-side
  navigation via the bottom tab bar, the GlobalPlayer collapses to a 200×113px overlay
  (mobile breakpoint). The mini-player is functional: stream continues, expand and close
  buttons present. The 24×24px button target issue is more severe on mobile.
  Heuristic: Flexibility and efficiency of use. Severity: 3.
  Evidence: .memory/scratchpad/streaming-playout-ux-review/viewer-v4-mini-player-feed-mobile.png.
  Direction: Mandatory larger touch targets on mobile; see WCAG item filed.

- [viewer/desktop] V4 full-page-reload — If the user performs a full page reload while
  on /feed (not client-side nav), the GlobalPlayer context is reset and media is cleared.
  The mini-player disappears. There is no "Resume watching" prompt on reload. This is
  expected React context behavior (no persistence), but worth noting as a gap vs. platforms
  like YouTube which persist playback across reloads via URL or service worker.
  Heuristic: User control and freedom. Severity: 1.
  Evidence: .memory/scratchpad/streaming-playout-ux-review/viewer-v4-navigated-away-desktop.png.
  Direction: Consider persisting `mediaId` in sessionStorage to restore the mini-player after
  accidental reload; low priority given the live-streaming context.

### V5 — Chat (anonymous and logged-in)

- [viewer/desktop] V5 anonymous chat — An anonymous viewer can see the chat input field and
  type a message. The input is not pre-disabled for anonymous users. Pressing Enter triggers
  a WebSocket send attempt. The server responds with an UNAUTHORIZED error which surfaces as
  a toast ("You need to be signed in / Authentication required to send messages"). There is
  no pre-send affordance indicating login is required — the viewer discovers this only after
  the failed send. The pattern is "attempt, fail, discover gate" rather than "see gate,
  decide to log in".
  Heuristic: Error prevention / Help users recognize, diagnose, and recover from errors.
  Severity: 3.
  Evidence: .memory/scratchpad/streaming-playout-ux-review/viewer-v5-anon-send-result-desktop.png.
  Direction: Disable the input field for `currentUserId === null` and replace the placeholder
  with "Sign in to chat" (with a link) so the affordance communicates the gate before the
  user invests effort composing a message.

- [viewer/mobile] V5 anonymous chat — Same issue as desktop for anon users; input appears
  enabled on mobile. Additionally, on mobile the only chat is the 400px panel below the
  player — the anon user sees the full chat panel including the deceptively enabled input.
  Heuristic: Error prevention. Severity: 3.
  Evidence: .memory/scratchpad/streaming-playout-ux-review/viewer-v5-chat-anon-mobile.png.

- [viewer/desktop] V5 logged-in chat — After login as pat@snc.demo, the chat input is
  enabled and functional. Sending a message works. Viewer count shows in the tab bar.
  The reaction picker is hidden by default (opacity: 0) and appears on hover or focus —
  correct behavior. Badges ("Patron", "Sub") render with data-attribute-driven colors.
  Room tab switching between channel room and platform room is functional. Severity: 0.
  Evidence: .memory/scratchpad/streaming-playout-ux-review/viewer-v5-after-send-desktop.png.

- [viewer/desktop] V5 empty chat — When the chat room has no messages the `.messages` div is
  blank. There is no "No messages yet — be the first!" empty state. A viewer who opens a
  quiet channel sees an empty white box with a send input, with no context that the room is
  simply empty (vs. broken).
  Heuristic: Visibility of system status. Severity: 2.
  Evidence: .memory/scratchpad/streaming-playout-ux-review/viewer-v5-chat-loggedin-desktop.png.
  Direction: Add a simple "No messages yet" empty state in the messages area.

- [viewer/desktop] V5 viewer count — The chat tab bar shows a raw numeric viewer count
  (`state.viewerCount`) with a `title="Viewers in this room"` tooltip. There is no visible
  label on the count — just the number. Screen readers reading the `<span>` will hear only
  the number. Filed as WCAG item (missing accessible name).
  Heuristic: Accessibility. Severity: 2.
  Evidence: .memory/scratchpad/streaming-playout-ux-review/viewer-v5-chat-loggedin-desktop.png.
  Direction: Add `aria-label="N viewers in this room"` on the viewerCount span.

- [viewer/mobile] V5 logged-in chat — Chat panel renders below the player (400px height,
  fixed). The chat input is accessible and functional on mobile. The input is full-width.
  No keyboard-opening layout shift issues observed (the panel is scroll-clipped). Severity: 0.
  Evidence: .memory/scratchpad/streaming-playout-ux-review/viewer-v5-chat-loggedin-mobile.png.

- [viewer/desktop] V5 moderation visibility — Slow mode banner shows when `slowModeSeconds > 0`.
  Timed-out and banned banners show with clear plain-language messages. The "Message blocked
  by filter" flash fades after 3s (CSS `fadeOut` animation). All moderation states are
  surfaced to the affected viewer. Severity: 0.

---

## State inspection — error/empty/loading coverage

| State | Location | Verdict |
|---|---|---|
| No channels active + not loading | `live.tsx` `ComingSoonPlaceholder` | **handled-poorly** — "Coming Soon" language misleads; no schedule or next-on info |
| No SSR data, loading in progress | `live.tsx` `isLoading: true` | **handled-poorly** — blank area, no loading indicator |
| Status-poll failure (15s) | `useChannelList` catch → retains stale data | **handled-well** — silent retention correct for background poll |
| HLS manifest error | Vidstack default error UI + 10s poll detect channel disappearance | **handled-poorly** — no custom error message; viewer sees Vidstack native error then silent clear |
| Stream ends (live channel removed) | `global-player.tsx` 3-miss poll → `actions.clear()` | **handled-well** — graceful dismissal after hysteresis |
| Player loading (modules async import) | `modules === null` branch in `GlobalPlayer` returns empty div | **handled-poorly** — no skeleton; blank 16:9 area |
| Chat WebSocket disconnected | `disconnected` span with "Reconnecting..." | **handled-well** |
| Chat room not found (no activeRoomId) | Input form guarded by `activeRoom && !activeRoom.closedAt` | **handled-poorly** — silent blank state when no room exists; no "Chat unavailable" message |
| Empty chat messages | `.messages` div is blank | **handled-poorly** — no empty state message |
| Slow mode | `slowModeBanner` with duration | **handled-well** |
| Timed out | `timedOutBanner` with expiry time | **handled-well** |
| Banned | `bannedBanner` | **handled-well** |
| Message filtered | `filteredFlash` fades | **handled-well** |
| Anonymous send attempt | Toast post-failure, input not pre-gated | **handled-poorly** — error prevention failure |
| Theater mode on mobile | `display: none` via CSS | **unhandled** — feature silently absent, no fallback |
| Chat collapse on mobile | `display: none` via CSS | **unhandled** — no mobile chat-collapse affordance |
| Live takeover (Liquidsoap bypass) | No UI change | **unhandled** — type mismatch prevents live indicator |
| Channel has no creator | `selectedChannel.creator` guarded — creator bar not shown | **handled-well** |
| NowPlaying null (playout) | Block conditionally rendered | **handled-well** |

---

## Implementation notes

**Journeys completed:**
- V1 cold tune-in: completed at desktop (1440×900) and mobile (iPhone 13, 375×844) for anonymous and logged-in (pat@snc.demo).
- V2 theater mode + chat collapse: completed at desktop. Mobile: theater and chat-toggle are `display:none` at <768px — feature absent, not blocked.
- V3 live takeover: completed. ffmpeg test stream confirmed via Liquidsoap logs (`Switch to input.ffmpeg`). Screenshots captured during active takeover and after fallback (kill ffmpeg). No SRS on_publish rate-limit hazard encountered.
- V4 navigate away / mini-player: completed at both viewports via client-side navigation. Full-page reload clears state (expected behavior, noted as finding).
- V5 chat anonymous and logged-in: completed at both viewports. Anonymous send failure path verified end-to-end.

**V3 note on live-indicator mismatch:** The S/NC TV channel type is "broadcast" in the API response. The `StreamStatusBar` LIVE indicator checks `type === "live"` which never matches "broadcast". This is a bug in the live-indicator logic (or a data modeling mismatch) — filed as finding, not an environment issue.

**V3 fallback timing:** The Liquidsoap fallback switch (`Switch to switch.1`) happened within ~30s of killing ffmpeg in a prior test run (19:00:10 → 19:00:39). In the current run (ffmpeg killed at ~19:28:40), the switch-back log line was not captured during the observation window. This does not affect the finding — the viewer sees no UI change in either direction regardless of timing.

**Screenshot inventory:** 28 viewer-prefixed screenshots in `.memory/scratchpad/streaming-playout-ux-review/`. All findings reference specific files. Key files:
- `viewer-v1-playing-desktop-15s.png` — player loaded state with channel selector
- `viewer-v2-theater-active-desktop.png` — theater mode
- `viewer-v2-chat-collapsed-desktop.png` — collapsed chat
- `viewer-v3-live-takeover-active-desktop.png` — takeover, no UI change
- `viewer-v4-mini-player-feed-desktop.png` — collapsed overlay mini-player
- `viewer-v5-anon-send-result-desktop.png` — anonymous send failure toast

**WCAG items filed:** 3 items (see backlog: `a11y-viewer-chat-input-focus-ring`, `a11y-viewer-mini-player-touch-target`, `a11y-viewer-chat-viewercount-label`).

**Commit pending** (git unavailable in this container).

## Review (2026-06-12)

**Verdict**: Approve — audit completeness verified during the feature-level deep
review (journey×viewport coverage table complete with all gaps explicitly
disclosed, finding-record format spot-checked, state-inspection table present
with per-state verdicts). Fast-lane advance.
