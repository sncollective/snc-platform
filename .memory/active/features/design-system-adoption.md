---
id: feature-design-system-adoption
kind: feature
stage: done
tags: [design-system]
release_binding: 0.3.0
created: 2026-04-18
updated: 2026-04-20
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
- [x] **Decoupled notification state from ChatContext** — new `contexts/notification-context.tsx` hosts a dedicated WS connection filtered to `notification_count` events, mounted at root in `__root.tsx` with userId from authState. `NotificationBell` now uses `useNotificationCount()` instead of `useChatOptional()`. Removed `notificationCount` state + `SET_NOTIFICATION_COUNT` action + WS handler from ChatContext (server-side `sendToUser` broadcasts unchanged). Bell now updates live on every authenticated page, not just `/live`. Trade-off: 2 WS connections per user on `/live` (chat + notification); app-level WS consolidation is a possible follow-up.

### Medium targets (M × 3)
- [x] **`user-menu.tsx`** → Ark Menu. Removed `useMenuToggle` usage (hook stays — 2 other consumers: mobile-menu + content management). Nav items use `MenuItem asChild` wrapping Link/a; logout uses `onSelect`. Pruned `.menu`/`.dropdown`/`.divider`/`.logoutButton` from module.css.
- [x] **`date-picker-input.tsx`** → Ark Popover wrapping DayPicker. Input wrapped in `PopoverTrigger asChild`. Removed `useDismiss` call. Kept `role="combobox"`+`aria-haspopup="dialog"` (Ark doesn't add these). Pruned `.container` wrapper.
- [x] **`notification-bell.tsx`** → Ark Popover + extracted `hooks/use-notifications.ts`. Hook owns REST state (notifications/isLoading/initialCount) + actions (fetch/markRead/markAllRead). Component keeps WS count combine logic + popover state. 10 hook tests added.

### Simple popovers & menus (S × 4)
- [x] **`kebab-menu.tsx`** → Ark Menu. `onSelect` handler wraps confirm+delete, `disabled` on MenuItem. Removed useState/useRef/useEffect click-outside. Pruned `.kebabWrapper`/`.kebabMenu` from module.css.
- [x] **`reaction-picker.tsx`** → Ark Popover (controlled). `unmountOnExit` matches prior conditional-render behavior. Removed manual aria-expanded/aria-haspopup (Ark adds them). Pruned `.container` wrapper; kept emoji-grid layout on PopoverContent via className.
- [x] **`day-detail-popover.tsx`** — **deleted** (orphan — no production consumer). Files removed: component, module.css, test file. Trivial assertion in `calendar-grid.test.tsx` (`queryByTestId("day-detail-popover")`) remains valid.
- [x] **`team-section.tsx`** → 3 Ark Selects. Module-level `ROLE_COLLECTION` via `createListCollection`. `disabled={isSoleOwner}` preserved on 3rd select. Test infra: added ResizeObserver + `scrollTo` polyfills to `tests/setup.ts` (jsdom gaps for @floating-ui/dom + Zag).

### Dialogs (S × 3)
- [x] **`mastodon-login-dialog.tsx`** — native `<dialog>` replaced with Ark Dialog. Removed useRef/useEffect/manual backdrop handling, collapsed to single component, `lazyMount unmountOnExit` for old unmount behavior. Pruned `.dialog`/`::backdrop`/`.content`/`.heading`/`.closeButton` from module.css.
- [x] **`follow-fediverse-dialog.tsx`** — native `<dialog>` replaced with Ark Dialog. Enter-key handler on instance input preserved. Removed useRef/useEffect/unused imports. Pruned `.dialog`/`::backdrop`/`.content`/`.heading`/`.description` from module.css.
- [x] **`InviteCreatorDialog`** (`routes/admin/creators.tsx`) — custom overlay divs replaced with Ark Dialog. Removed `if (!open) return null` guard (Ark handles via `lazyMount unmountOnExit`). Pruned `.dialogOverlay`/`.dialog`/`.dialogTitle` from admin-creators.module.css.

## Outcome

**`mobile-menu.tsx` retired entirely** (deleted in commit `f7cb133 Responsive redesign`). Initial migration attempt revealed Popover's floating-ui Positioner fights full-width sheet layouts, so rather than invest in a Sheet primitive workaround the component was retired ahead of its replacement in the `mobile-nav-redesign` epic (bottom-tab-bar). `useMenuToggle` + `useDismiss` hooks both removed from the codebase — no remaining consumers.

**Review fix-in-flight (2026-04-20):** two regressions surfaced during acceptance review and were fixed in-flight as part of this feature —
- **Popover content rendering without background inside modal dialogs.** Date picker popover opened from inside the New Event dialog showed the dialog's form fields drawing through the calendar. Two layered bugs:
  1. **Primary:** `PopoverContent` wrapper in `components/ui/popover.tsx` spread `{...props}` after `className={styles.content}`, so consumers passing their own `className` (like `date-picker-input.tsx` passing `className={styles.popover}`) wiped out the wrapper's default visual styles (background, border, radius, shadow, padding, max-width). Fixed by destructuring `className` and merging (matches the pattern dialog.tsx already used).
  2. **Defense in depth:** popover positioner used `--z-dropdown` (100) which is below `--z-modal` (400), so even with correct visuals the popover would have stacked behind dialogs. Added `--z-popover: 450` token in `styles/tokens/elevation.css` between modal and toast; popover positioner uses it.
- **Reaction picker trigger invisible.** `reaction-picker.module.css` set the trigger to `opacity: 0` with a hover-reveal selector `.message:hover .trigger` — but `.message` was scoped to reaction-picker's CSS module, not the chat-panel wrapper class. Selector never matched; trigger stayed hidden. Moved the hover-reveal into `chat-panel.module.css` targeting the trigger via its stable `aria-label="Add reaction"`; stripped the dead selector + legacy absolute positioning from reaction-picker's module (Ark's Positioner handles placement).
