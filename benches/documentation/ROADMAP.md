# Platform Documentation — Roadmap

> Roadmap for [Platform Documentation vision](VISION.md). Tool choices and audience assignments in [DISCOVERY.md](DISCOVERY.md).

## Phase 1: Foundation

**Goal:** Unblock onboarding and establish auth context that every other domain depends on.

**Deliverables:**
- `platform/docs/getting-started.md` — step-by-step onboarding walkthrough (human)
- `platform/docs/auth.md` — auth architecture: Better Auth, OIDC, sessions, roles (human)
- `platform/.claude/rules/auth.md` — auth domain context (agent)

**Done when:**
- A new contributor can go from clone to running platform following the guide alone
- An agent working on auth-adjacent code has session model and role system in loaded context

## Phase 2: Core Domains

**Goal:** Cover active feature areas where agents are most likely to need domain knowledge.

**Deliverables:**
- `platform/docs/federation.md` + `platform/.claude/rules/federation.md`
- `platform/docs/calendar.md` + `platform/.claude/rules/calendar.md`
- `platform/docs/feature-flags.md` + `platform/.claude/rules/feature-flags.md`
- `platform/docs/rate-limiting.md` + `platform/.claude/rules/rate-limiting.md`

**Done when:**
- All four domains have human guides and agent context files
- Agent can correctly describe the federation model, calendar event lifecycle, available feature flags, and rate limit config without reading source

## Phase 3: Emissions

**Goal:** Document emissions tracking — the one Phase 3 domain not blocked on redesign.

**Deliverables:**
- `platform/docs/emissions.md` — calculation methodology, data sources, dashboard (human)
- `platform/.claude/rules/emissions.md` — emissions domain context (agent)

**Done when:**
- Human guide covers how emissions are calculated, data flow from `scripts/track-*-carbon.py`, and dashboard display
- Agent understands emissions data model and integration points

## Phase 4: Operational

**Goal:** Fill remaining gaps — smaller scope, human-only guides.

**Deliverables:**
- `platform/docs/email.md` — email templates, triggers, transport config (human)
- `platform/docs/database-schema.md` — consolidated schema reference with relationships (human)
- `platform/docs/seeding.md` — how to use seed scripts, what gets created (human)

**Done when:**
- All non-blocked backlog items have documentation
- BACKLOG.md updated to reflect completed state

## Phase 5: Housekeeping

**Goal:** Clean up file structure and validate cross-references.

**Deliverables:**
- *(user)* Confirm refactor archive relocation
- Move `platform/docs/refactor/` → `platform/projects/refactor/`
- Run `python3 scripts/check-doc-links.py --index` and fix broken references
- Update any CLAUDE.md references to old refactor paths

**Done when:**
- No broken cross-references
- Refactor docs live in `platform/projects/refactor/`
- `platform/docs/` contains only feature guides

## Blocked

| Domain | Docs needed | Blocked on |
|--------|-------------|------------|
| Creator Teams | human + agent | Redesign of creator teams feature |
| Admin System | human + agent | Redesign of admin system |

These move to the roadmap once the redesigns are complete.

## Open Questions

- Should human guides follow a shared template (e.g., Overview → Data Model → Key Flows → Config → Troubleshooting), or let each domain dictate its own structure?
- Should agent context files reference the corresponding human guide, or stay fully independent?
- How should we handle docs for domains that change significantly during redesign (creator teams, admin)?
