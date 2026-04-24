---
id: story-chat-moderation-user-card-popover
kind: story
stage: done
tags: [streaming, community, admin-console, ux-polish]
release_binding: 0.3.0
created: 2026-04-20
updated: 2026-04-21
related_decisions: []
related_designs: []
parent: chat-moderation
---

# Chat Moderation — User-Card Popover

## Overview

Replace the hover-kebab menu on chat messages with a **click-username → user-card popover** as the primary moderator-action surface. Add an **unban** surface (currently missing) and **visible action-success feedback** to the moderator. Pattern reference: [live-streaming-ux-patterns.md §2.8](../../research/live-streaming-ux-patterns.md) (user cards) and [§3.3](../../research/live-streaming-ux-patterns.md) (manual mod tools).

Resolves Finding C from the `chat-moderation` feature's review pass (2026-04-20). Finding D (rehydration + generic error surfacing) is a separate concern on the parent feature and is **not** in this story's scope, though the mod-action-success flow this story adds will use the same toast surface Finding D will eventually generalize.

## Why

The current hover-kebab on each message is cramped and unfamiliar. Twitch, YouTube, and Discord all converge on the same shape: clicking a username opens a user-card popover that pivots from identity display (for viewers) to moderation quick-actions (for mods). Per the research doc, user cards are "the single highest-leverage polish surface in chat" — the primary flow for almost all moderator work. Two concrete gaps flow from the shape change:

- **No unban surface.** The spec's `unbanUser` service is wired but never reachable from the UI. Viewing a currently-banned user should surface an Unban action.
- **No success feedback for the moderator.** Clicking "1 min" timeout currently does nothing observable from the mod's side. Moderation without confirmation is indistinguishable from broken.

## Scope

**In scope:**

- Replace `ChatUserActions` hover-kebab pattern with a **click-username trigger** on chat message rows. Username is the hit target (plus an optional explicit "open menu" affordance for mobile / keyboard).
- New `ChatUserCard` component using Ark UI `Popover`. Renders:
  - Identity header — avatar, display name, role badge (subscriber / creator-owner / mod / admin as applicable from existing badge system).
  - Mod-action cluster (only when `isModerator === true` in chat context) — timeout presets (1m / 10m / 1h / 1d), Ban, **Unban** (conditional on target being currently banned), with confirmation on destructive actions.
- **Unban** button visibility — query target user's current ban state to show Unban instead of Ban when applicable. Use existing `isUserBanned` via a client-reachable path (shared-protocol event, small REST query, or surface via user-card open event — pick at `/implement` time).
- **Action-success feedback** — on successful timeout / ban / unban, close the popover, show an inline toast or status pill near the chat composer: `"Timed out <user> for 10m"` / `"Banned <user>"` / `"Unbanned <user>"`. Auto-dismiss ~3s. Failures show a matching error toast.
- Keyboard support — Tab to a username focuses it, Enter opens popover, Escape closes, Tab-cycle through action buttons, Enter confirms. Standard Ark UI Popover behaviour.
- Non-moderator click — popover still opens with identity header only (no mod cluster). Self-click is a no-op or shows a tiny "it's you" state — pick at `/implement`.

**Explicitly out of scope:**

- Full Twitch-style user card — no follow date, watch time, subscriber tenure, account age (no backend surface today; separate item if desired).
- Message-filter-by-user ("show only messages from this user" in chat pane).
- Mod-action audit trail view inside the card.
- Whispers / DMs.
- Generalized error-toast surface (Finding D on parent feature) — this story uses a scoped toast for mod-action results only; the shape should be reusable by Finding D's pass but we don't commit to the general surface here.
- Rehydration behaviour on join (Finding D1 on parent feature) — separate.

## Tasks

- [x] Replace hover-kebab trigger in message rows with click-username trigger; remove hover-kebab code path in `chat-user-actions.tsx`.
- [x] Implement `ChatUserCard` using Ark UI `Popover` (see `.claude/skills/ark-ui-v5/SKILL.md`). Render identity header always; mod-action cluster gated on `isModerator`.
- [x] Wire timeout presets (1m / 10m / 1h / 1d) to existing `timeoutUser` action from chat context (Unit 9 of parent feature).
- [x] Wire Ban button (with confirm) to existing `banUser` action.
- [x] Determine target user's current ban state for conditional Unban rendering. Pick a path at `/implement`: (a) add `isBanned: boolean` to user presence payload, (b) query on popover-open via a small REST endpoint, or (c) piggyback on existing `user_banned` / `user_unbanned` broadcasts + client cache of banned users in chat room.
- [x] Wire Unban button to existing `unbanUser` action. Show Unban instead of Ban when target is currently banned.
- [x] Add mod-action toast surface — component + context-level dispatch on successful mutation; auto-dismiss 3s. Error path fires matching error toast.
- [x] Keyboard + a11y — Tab/Enter/Escape work on username trigger; focus trap inside popover; destructive actions require Enter-to-confirm, not one-keystroke fire.
- [x] Visual states — popover open/close animation, hover/focus on action buttons, disabled state while action is in flight, success/error toast styling (follows design tokens per `ui-ux-system-plan.md`).
- [x] Remove any now-dead code from `chat-user-actions.tsx` hover-kebab path.

## Testing

- Unit test `ChatUserCard` rendering paths: viewer (identity only), moderator (identity + mod cluster), moderator viewing a banned user (Unban visible, Ban hidden), moderator viewing themselves (no mod cluster or clear disabled state).
- Integration test the click-username → popover → timeout flow end-to-end on the web app.
- Manual verification scenarios (mirrors parent feature's review setup):
  - Alex (platform admin) on Community / S/NC TV clicks Maya's name → popover shows mod cluster → times out 10m → popover closes, success toast appears, Maya's composer shows timeout banner (parent feature wiring).
  - Alex clicks a currently-banned user's name → sees Unban instead of Ban → clicks Unban → success toast, user's banner clears.
  - Alex fails to authorize (simulated 403) → error toast appears with readable message.
  - Viewer (anonymous or non-mod) clicks a username → identity-only popover, no mod cluster.
  - Keyboard-only: Tab to a username, Enter opens, Tab cycles action buttons, Escape closes.
  - Mobile viewport: click-username still works; popover positions above composer without clipping.

## Risks

- **Popover positioning on mobile.** Chat is a bottom-sheet drawer on mobile. Popover anchored to a username near the top of visible chat may collide with the top of the drawer or the stream player above. Ark UI's collision detection should handle this; verify on iOS Safari + Android Chrome viewport heights.
- **Ban-state query path.** Whichever path is picked (presence payload, REST on open, client cache from broadcasts) has trade-offs; a stale cache could show Ban on a banned user. Document the choice + fallback in the implementation pass.
- **Scope creep into Finding D.** The success-toast component this story adds will look like the generic error-toast Finding D wants. Hold the line — ship a mod-action-scoped toast here, let Finding D generalize it when the rehydration pass runs. If the shape naturally generalizes at implement time, fine; if it requires extra work to generalize, defer.
- **Message-row click conflict.** Clicking a message row today may already have semantics (reply shortcut, highlight). Ensure username click doesn't get swallowed by a parent handler; stop propagation.

## Implementation Outcome (2026-04-20)

Landed per spec. Single Sonnet agent, test + build green.

**Files:**
- **Created** [chat-user-card.tsx](../../apps/web/src/components/chat/chat-user-card.tsx) + `.module.css` — new popover component with identity header + mod-action cluster gated on `isModerator`, `PopoverRoot`/`PopoverTrigger`/`PopoverContent` from existing `components/ui/popover.tsx` wrapper.
- **Modified** [chat-panel.tsx](../../apps/web/src/components/chat/chat-panel.tsx) — removed `hoveredMessageUserId` state + `onMouseEnter`/`onMouseLeave` handlers; username `<span>` now wrapped in `<ChatUserCard>` as a click trigger.
- **Modified** [chat-context.tsx](../../apps/web/src/contexts/chat-context.tsx) — added `currentUserId: string | null` to `ChatState` + `SET_CURRENT_USER` action, synced from `userId` prop. Needed for self-click detection (hide mod cluster when viewing own username).
- **Deleted** `chat-user-actions.tsx` + `.module.css` — fully replaced by `ChatUserCard`.
- **Test** [chat-user-card.test.tsx](../../apps/web/tests/unit/components/chat/chat-user-card.test.tsx) — 15 new cases covering viewer/moderator render paths, mod action dispatch (timeout/ban/unban), banned-user Unban surface, self-click mod-cluster hide, sanctions fetch failure graceful fallback.

**Decisions (orchestrator-resolved from story's open options):**
- **Ban-state query path** — option (b): `apiGet` on popover-open against existing `GET /api/chat/rooms/:roomId/moderation/active`, filtered client-side for `action === "ban"` matching target. AbortController cleans up on popover close/re-open.
- **Toast surface** — optimistic-on-send: success toast fires immediately after WS action dispatch, popover closes, 3s auto-dismiss. Error toast surface wired but not plumbed to WS error handler — Finding D on parent feature owns the generic error-surface generalization.

**Deviation from spec:** story said "hide mod cluster on self-click" without prescribing a mechanism. Agent added `currentUserId` to `ChatState` (synced via a new `SET_CURRENT_USER` reducer action on `userId` prop change), compared against target in `ChatUserCard`. Cleaner than prop-drilling from `ChatPanel`. No new WS protocol or schema.

**Verification:** 1556/1556 web tests green (1541 existing + 15 new), build clean.

## Revisit if

- The popover shape becomes a pattern applied elsewhere (follower list, viewer list, raid-source list) → candidate for promotion to a shared `UserCard` primitive in the design system.
- Finding D's error-toast generalization ships and this story's action-toast feels redundant → consolidate.
- Product adds a real user-profile surface (follow date, watch time, etc.) → expand the identity header.
- Abuse patterns surface that require a "report user" path in the card → add to mod cluster for non-mods, to escalation cluster for mods.
