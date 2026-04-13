# UX Decision-Making Context (AI)

UI/UX decisions are collaborative. The agent surfaces evidence and options; the user decides. Unlike code conventions or accessibility rules, aesthetic and interaction choices can't be evaluated without the user — what "feels right" matters as much as what the data says.

## Collaboration Model

**Agent role:** Present options with supporting evidence. Frame trade-offs. Build what the user chooses. During review, focus on user experience ("try this flow" / "does this feel right?"), not rule compliance.

**User role:** Primary decision-maker on look, feel, and interaction patterns. The user will be most opinionated here — more than on code conventions, which can be easily swapped.

**What the agent can decide autonomously:** Implementation details that don't affect UX (component structure, CSS organization, state management). Apply existing design decisions faithfully.

**What requires the user:** Any new visual pattern, layout change, navigation restructure, interaction model, or deviation from an established design. When in doubt, ask.

## The Boundary

| Domain | Agent autonomy | Examples |
|--------|---------------|----------|
| Code conventions | High — follow rules, fix violations | Naming, imports, error handling |
| Accessibility | High — WCAG is objective | ARIA roles, focus management, color contrast |
| SEO | High — measurable criteria | Meta tags, canonical URLs, structured data |
| Performance | High — measurable criteria | Bundle size, CLS, LCP |
| **UI/UX patterns** | **Low — user decides** | **Nav structure, mobile patterns, grouping, visual hierarchy** |
| **Branding/aesthetics** | **Low — user decides** | **Color, spacing, typography, tone** |

## Research Nuggets

Evidence to surface during design conversations — not rules to apply.

### Mobile Navigation

- **Bottom tab bars outperform hamburger menus significantly.** NNG 2025 study (n=179): hamburger reduces discoverability 20%+, increases task time 39% on desktop / 15% on mobile. Redbooth saw +65% DAU and +70% session time after switching from hamburger to bottom tabs.
- **Optimal tab count: 3–5 items.** Odd numbers create better visual rhythm. Each needs a clear icon.
- **Hybrid (visible + hidden) scores highest.** Show 3–5 primary items visibly; secondary items in a menu. BBC and SupermarketHQ confirmed highest nav usage with this combo.
- **Hamburger is acceptable as secondary nav** (for overflow/settings), but not as the primary navigation on mobile.

### Role-Based Navigation

- **Keep the same nav structure across roles.** Slack, YouTube, Spotify all use identical navigation — admins/creators see extra items in the same positions. Don't build separate nav systems per role.
- **Conditional disclosure, not separate UIs.** Show/hide items based on role within a consistent layout. Over-simplifying for lower-privilege users creates a confusing mental model.
- **Group by function, not by role.** "Co-op Tools" section (visible to stakeholders+) rather than "Stakeholder Menu." The grouping should make sense to the user, not mirror the permission model.

### Progressive Disclosure

- **Max 2 levels of disclosure.** Core items visible, advanced/role-specific behind one clear step (dropdown, "More" section). Three+ levels tank usability.
- **Obvious progression mechanics.** Buttons/labels must clearly signal what's behind them. Users won't explore unclear affordances.

### Multi-App Navigation

- **Grid app-switcher in header** (Google/Microsoft pattern). Current app highlighted, consistent styling across apps. +30% cross-app engagement when nav structure is consistent across apps.
- **Relevant when S/NC moves toward separate apps** (platform, studio, games). The primary nav is app-specific; the user menu and app-switcher are shared.

### Design Token Reuse

- The platform already has a design token system in `global.css`. Any new nav components should use existing tokens (`--nav-height`, `--color-accent`, `--shadow-dropdown`, etc.) rather than introducing new values.

## Decision Lifecycle

1. **Research** — gather evidence (this doc, web searches, comparable products)
2. **Interactive design session** — agent presents options with mockups/previews, user evaluates and decides
3. **Design doc** — captures decisions on the board (`boards/.../design/`)
4. **Implementation** — agent builds faithfully from the design doc
5. **Review** — user tests the experience; focus on "does this feel right?", not "does it match a spec"
6. **Pattern codification** — once stable, concrete decisions become platform patterns agents follow

Steps 2 and 5 are where the user is most engaged. The agent drives 1, 3, 4, and 6.
