---
id: platform-0010
title: Navigation — context shell pattern for internal contexts
status: active
created: 2026-03-30
updated: 2026-04-18
supersedes: []
superseded_by: null
revisit_if:
  - "A fourth internal context emerges that doesn't fit the sidebar shape (full-bleed monitoring dashboard, spatial/map interface)"
  - "Mobile drawer interaction with GlobalPlayer proves unworkable — forces reconsidering shell-on-mobile"
  - "Growth beyond 15+ nav items in a single context forces collapsible groups or command palette"
  - "NNG / Baymard research updates significantly contradict the mode-switch-via-nav-replacement premise"
  - "Public nav redesign wants visual continuity with internal nav that the shell pattern explicitly breaks"
---

## Context

The platform has three expanding internal contexts (admin, creator manage, co-op governance). Before this decision:

- **Creator manage** was at 7 horizontal tabs — at the research scaling threshold
- **Admin** had no sub-nav; routes hung off a bare `<Outlet/>`
- **Co-op governance** (dashboard, calendar, projects) was scattered as top-level routes with no shared layout
- **Public primary nav** showed the same flat list to everyone, including disabled features

These are mode switches, not peer tabs of the same content. A unified shape was needed.

## Decision

**Context shell pattern.** When a user enters an internal context, the public primary nav is replaced by a context-specific left sidebar with a "Back to site" link. Top bar (logo + user avatar) stays constant.

- Shared **`ContextShell` component** across admin, creator manage, co-op governance
- Creator manage: horizontal tabs → sidebar; **creator switcher dropdown** in the header (new API: `GET /api/me/creators`)
- Co-op governance: `/dashboard`, `/calendar`, `/projects` → `/governance/*` under a shared layout; old URLs 301-redirect
- Public nav cleanup: remove Pricing; remove My Bookings; collapse three co-op entries → single "Co-op" link
- **GlobalPlayer** anchors to the content column on desktop (not the sidebar); mobile interaction with drawer deferred

## Alternatives considered

### Keep horizontal tabs (rejected)

Creator manage at 7 tabs was already at the scaling threshold — Miller's Law and Baymard tab-scrolling studies show tabs requiring horizontal scroll are significantly worse than vertical alternatives. Admin and co-op were going to hit the same ceiling. Horizontal tabs are for parallel views of the same data (NNG "Tabs, Used Right"), not for unrelated sections.

### Overlay/modal for internal contexts (rejected; Notion / Discord pattern)

Overlay works for settings-as-modal. Rejected for S/NC's internal contexts because sidebars scale better for growing nav (progressive disclosure: tabs <5 → sidebar 5-7 → collapsible groups 15+ → command palette), and mode switches need to be visually obvious (NNG: nav changes must be unmistakable; overlay blurs the boundary).

### Router-context-propagated shell mode (rejected for simplicity)

TanStack Router context could pass shell-mode state through `beforeLoad`. Rejected in favor of **URL-prefix detection** — `SHELL_PREFIXES = ["/admin", "/governance"]` + a creator-manage regex. Simpler; doesn't touch every shell route; adding a context is one line.

## Industry pattern grounding

| Pattern | Used by | S/NC application |
|---|---|---|
| Separate mode + back link | Linear Settings, GitHub Settings | All three internal contexts |
| Sidebar swapping content per context | GitHub, Notion, Linear | `ContextShell` with per-context nav items |
| Creator/workspace switcher in header | GitHub org switcher, Notion workspace switcher | Creator switcher within manage context |

**Research citations:**
- Miller's Law + Baymard tab studies — 7-item horizontal tabs hit the scaling threshold
- NNG 2025 (bottom tabs +65% DAU / +70% session time vs hamburger) — informs future mobile public nav, not this work
- NNG "Tabs, Used Right" — tabs are for parallel views of same data
- Progressive disclosure scaling tiers (tabs → sidebar → collapsible groups → command palette)

Full evidence base in `platform/docs/ux-decisions.md`.

## Consequences

- `ContextShell`, `CreatorSwitcher`, `use-context-announcer` hook live in `apps/web/src/components/layout/`
- `ADMIN_NAV` + `GOVERNANCE_NAV` configs in `apps/web/src/config/context-nav.ts`; creator manage config is dynamic (permission-gated per creator membership)
- Root layout (`__root.tsx`) detects shell mode via URL prefix; `NavBar` + `Footer` hide in shell mode (additive to theater mode)
- Redirect stubs at `/dashboard`, `/calendar`, `/projects`, `/projects/<slug>` → `/governance/*` with 301 (preserves bookmarks + external links)
- Auth consolidation: governance layout checks auth once; child routes no longer need `beforeLoad` guards
- `/api/me/creators` endpoint added for creator switcher
- `aria-live` context announcer for screen-reader context-change notifications

### Open decisions deferred to visual evaluation

These may be refined in later UX passes without revisiting the shell pattern itself:

- Sidebar width + collapse behavior on smaller desktop screens
- Context shell header styling (prominence of context label + back link)
- Creator switcher dropdown design (inline in sidebar header vs separate control)
- Co-op governance entry-point naming (chose "Co-op")
- Mobile drawer trigger placement and animation
- Whether user-menu grouping still earns its place once internal contexts have their own sidebars
- Mobile GlobalPlayer interaction with sidebar drawer

## Related

- [platform-0004-vidstack-media-player.md](platform-0004-vidstack-media-player.md) — GlobalPlayer's content-column anchor is a corollary of the shell pattern
- [platform-0005-jsdoc-inline-documentation.md](platform-0005-jsdoc-inline-documentation.md) — JSDoc on `ContextShell`, `CreatorSwitcher` follows the convention
- `platform/docs/ux-decisions.md` — UX evidence base + decision process
- `platform/.memory/research/content-management-ux-patterns.md` — adjacent research on content-surface nav
- `platform/.memory/research/ui-ux-system-plan.md` — broader UX system thinking

Promoted 2026-04-18 during boards-migration story 1 from `boards/platform/release-0.1/design/nav-architecture.{brief,}.md` pair.
