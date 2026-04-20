---
id: feature-design-system-adoption
kind: feature
stage: review
tags: [design-system]
release_binding: null
created: 2026-04-18
updated: 2026-04-18
related_decisions: []
related_designs: []
parent: null
---

# Design System Adoption

Consolidation release. Migrates existing ad-hoc dialogs, dropdown menus, popovers, and native selects to the Ark UI primitives (Phase 1 of the `design-system-foundation` epic). Retires custom dismiss hooks once consumers migrate. No new user-facing features — pure DX + a11y + consistency win.

## Migration checklist

### Content management list migration
- [x] **`routes/.../manage/content/index.tsx`** → Ark Menu. "Create New" button + 3-item type-selector dropdown migrated. Removed `useMenuToggle` + manual `useEffect` auto-focus + ~40 LOC `handleMenuKeyDown` (Ark Menu handles Arrow/Home/End/Tab/Escape/focus natively). Pruned `.createWrapper` / `.typeSelector` / `.typeSelectorOption` CSS. Removed 6 keyboard-nav tests (now Ark's responsibility); kept functional tests for menu items + create-draft flow.

### Architecture
- [ ] **Decoupled notification state from ChatContext** — new `contexts/notification-context.tsx` hosts a dedicated WS connection filtered to `notification_count` events, mounted at root in `__root.tsx` with userId from authState. `NotificationBell` now uses `useNotificationCount()` instead of `useChatOptional()`. Removed `notificationCount` state + `SET_NOTIFICATION_COUNT` action + WS handler from ChatContext (server-side `sendToUser` broadcasts unchanged). Bell now updates live on every authenticated page, not just `/live`. Trade-off: 2 WS connections per user on `/live` (chat + notification); app-level WS consolidation is a possible follow-up.

### Medium targets (M × 3)
- [x] **`user-menu.tsx`** → Ark Menu. Removed `useMenuToggle` usage (hook stays — 2 other consumers: mobile-menu + content management). Nav items use `MenuItem asChild` wrapping Link/a; logout uses `onSelect`. Pruned `.menu`/`.dropdown`/`.divider`/`.logoutButton` from module.css.
- [ ] **`date-picker-input.tsx`** → Ark Popover wrapping DayPicker. Input wrapped in `PopoverTrigger asChild`. Removed `useDismiss` call. Kept `role="combobox"`+`aria-haspopup="dialog"` (Ark doesn't add these). Pruned `.container` wrapper.
- [ ] **`notification-bell.tsx`** → Ark Popover + extracted `hooks/use-notifications.ts`. Hook owns REST state (notifications/isLoading/initialCount) + actions (fetch/markRead/markAllRead). Component keeps WS count combine logic + popover state. 10 hook tests added.

### Simple popovers & menus (S × 4)
- [x] **`kebab-menu.tsx`** → Ark Menu. `onSelect` handler wraps confirm+delete, `disabled` on MenuItem. Removed useState/useRef/useEffect click-outside. Pruned `.kebabWrapper`/`.kebabMenu` from module.css.
- [ ] **`reaction-picker.tsx`** → Ark Popover (controlled). `unmountOnExit` matches prior conditional-render behavior. Removed manual aria-expanded/aria-haspopup (Ark adds them). Pruned `.container` wrapper; kept emoji-grid layout on PopoverContent via className.
- [x] **`day-detail-popover.tsx`** — **deleted** (orphan — no production consumer). Files removed: component, module.css, test file. Trivial assertion in `calendar-grid.test.tsx` (`queryByTestId("day-detail-popover")`) remains valid.
- [ ] **`team-section.tsx`** → 3 Ark Selects. Module-level `ROLE_COLLECTION` via `createListCollection`. `disabled={isSoleOwner}` preserved on 3rd select. Test infra: added ResizeObserver + `scrollTo` polyfills to `tests/setup.ts` (jsdom gaps for @floating-ui/dom + Zag).

### Dialogs (S × 3)
- [ ] **`mastodon-login-dialog.tsx`** — native `<dialog>` replaced with Ark Dialog. Removed useRef/useEffect/manual backdrop handling, collapsed to single component, `lazyMount unmountOnExit` for old unmount behavior. Pruned `.dialog`/`::backdrop`/`.content`/`.heading`/`.closeButton` from module.css.
- [ ] **`follow-fediverse-dialog.tsx`** — native `<dialog>` replaced with Ark Dialog. Enter-key handler on instance input preserved. Removed useRef/useEffect/unused imports. Pruned `.dialog`/`::backdrop`/`.content`/`.heading`/`.description` from module.css.
- [x] **`InviteCreatorDialog`** (`routes/admin/creators.tsx`) — custom overlay divs replaced with Ark Dialog. Removed `if (!open) return null` guard (Ark handles via `lazyMount unmountOnExit`). Pruned `.dialogOverlay`/`.dialog`/`.dialogTitle` from admin-creators.module.css.

## Deferred

**`mobile-menu.tsx` retained on useMenuToggle.** Migration attempt surfaced that Popover's floating-ui Positioner fights full-width sheet layouts. Rather than invest in a Sheet primitive workaround, the whole component is being retired via the `mobile-nav-redesign` epic's bottom-tab-bar redesign. Migration attempt reverted; component stays on `useMenuToggle` in the interim.
