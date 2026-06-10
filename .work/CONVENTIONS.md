# Platform Project Conventions

## Release mapping
none

Platform ships versioned releases (`0.x.y`) as *scoping units*, but deployment is
user-at-station (manual ship from the operator's station). The agile-workflow plugin must
not tag or branch on release — the release lifecycle is pure workflow bookkeeping.

## Gate config
gates_for_release: [security, tests, cruft, docs, patterns, refactor]
binding_guard: halt          # epics don't span releases; mismatch halts the release
epic_cohesion: total         # epics ship whole — every child binds to the same release
research_completion: close-to-done   # [research] verification runs inline; no review-stage sign-off

The `refactor` opt-in activates the gate-refactor seam: the `scan-*` refactor rule libraries
under `.claude/skills/scan-*` plug into the refactor gate automatically via this declaration
alone (the gate discovers them by glob — `scan-memory` is a substrate lint that matches the
glob and loads harmlessly). No
additional configuration is needed.

## Terminal-tier retention
delete-refs

Archive items are replaced with bodyless ref stubs when moved through the plugin lifecycle;
full bodies are preserved in git history. Items reaching `done` via the plugin's `review` skill
are archived as stubs going forward.

**Historical exception:** the pre-conversion release archive under `releases/0.3.0/` retains
full bodies (migrated as-is from the bespoke substrate). This is a one-time migration exception;
`delete-refs` applies from conversion forward. The full bodies remain in git history regardless.

## Tag taxonomy

All items are platform-scope — there is no cross-project routing to resolve. Tags classify
*what* an item is about and *how* it's worked, so `work-view` projections and scan/triage
skills can find the right batch.

### Landing rubric (apply in order)

1. **User-at-station deploy work?** (prod env, DNS, Caddy, TLS, infra hardening, physical access) → `deploy`
2. **Code-level security finding?** (specific file/line issue) → `security`
3. **Needs e2e coverage review?** → `testing`
4. **Needs human-facing docs?** → `documentation`
5. **Refactor / code-quality issue?** → `refactor` (plus the scan-family tag if a scan surfaced it)
6. **Cross-cutting UX polish** (layout shifts, hydration, loading, errors) → `ux-polish`
7. **Cross-cutting design-system** (tokens, shared components, responsive primitives, a11y) → `design-system`
8. **Infrastructure observability?** (logs, metrics, dashboards, alerts) → `observability`
9. **About the project itself, agent skills, or conventions?** → `workflow`
10. **Otherwise** — pick the matching domain tag below.

Cross-cutting items may carry multiple tags (e.g. `[content, creators]` for a creator-facing
content feature; `[streaming, refactor]` for a refactor in the streaming domain).

### Domain tags

| Tag | Charter |
|---|---|
| `identity` | Who the user is, how they prove it: auth, OAuth, Mastodon, invites, sessions, account linking, OTP. |
| `creators` | The creator entity itself: teams, members, permissions, lifecycle, creator pages. |
| `content` | Uploads, media, posts (audio/video/written), feed, series, content comments. |
| `streaming` | Live broadcast, live viewer session, playout, VOD, live chat moderation. |
| `playout` | Playout-engine specifics (Liquidsoap scheduling, queue, fallback) within the streaming domain. |
| `community` | Audience-facing social layer outside the live session: follows, notifications, post-level reactions, non-live comments. |
| `commerce` | Money moving or products being bought: subscriptions, Stripe, checkout, patronage tiers, merch, Shopify. |
| `calendar` | Events, shows, scheduling, bookings, calendar feeds. |
| `studio` | Physical studio operation: inquiries, bookings, sessions, availability. |
| `governance` | On-platform co-op governance: member projects, proposals, voting, directory. |
| `federation` | Protocol adapters (AP/AT/Nostr/Polycentric), external identity, federated distribution. |
| `admin-console` | Admin surfaces spanning multiple domains — dashboards, cross-domain moderation, inquiry triage. |
| `media-pipeline` | FFmpeg transcoding, codec probing, thumbnail extraction, processing jobs. |
| `emissions` | Carbon tracking, calculation engine, public transparency page. |
| `schema` | Database schema + migration work cutting across domains (Drizzle schema, migration discipline). |
| `developer-experience` | Tooling, build, local-dev ergonomics, agent-command surface — improving how the platform is built. |

### Lifecycle / work-location tags

| Tag | Charter |
|---|---|
| `user-station` | Items requiring physical access, workstation credentials, or in-person ops. Orthogonal to domain. |
| `batch-tracker` | Marks a parent item coordinating a batch of related findings so the cohort is queryable as a unit. |

New lifecycle tags require deliberate addition here, not ad-hoc emergence.

### Cross-cutting quality tags

| Tag | Charter |
|---|---|
| `ux-polish` | Cross-domain UX friction: layout shifts, hydration pop-in, loading feedback, error/empty states, motion, responsive regressions. |
| `design-system` | Tokens, shared components, responsive primitives, a11y patterns — system-level gaps. |

### Pipeline-kind tags (set by scan/triage skills)

| Tag | Pipeline role |
|---|---|
| `refactor` | `/agile-workflow:gate-refactor` + scan-* libraries surface items with this tag. |
| `security` | Security scan/gate findings. |
| `testing` | E2e / test-coverage triage findings. |
| `documentation` | Docs triage / docs-gate findings. |

### Scan-family tags (alongside `refactor`)

| Tag | Scan family |
|---|---|
| `quality` | `scan-quality` — duplication, complexity, pattern compliance. |
| `stylistic` | `scan-stylistic` — TypeScript/React/Hono style. |
| `structural` | `scan-structural` — file/folder/module organization. |
| `accessibility` | `scan-accessibility` — WCAG 2.2 AA static checks. |
| `performance` | `scan-performance` — query efficiency, CLS, LCP, bundle, data efficiency. |
| `seo` | `scan-seo` — meta tags, Open Graph, canonical URLs, structured data. |

### Platform ops tags

| Tag | Charter |
|---|---|
| `deploy` | User-at-station work needing prod credentials or physical access. |
| `observability` | Logs, metrics, dashboards, tracing, alerts — seeing the platform in production. |

### Meta tag

| Tag | Charter |
|---|---|
| `workflow` | Agent skills, project conventions, the work-item/research-band system itself. |

## Slug conventions

kebab-case. **Filename always equals `id`** (`<id>.md` — substrate-maintainer enforced).

- **Active/archive/release-archived tier:** `id: <slug>` (bare slug, no kind prefix), filed
  under kind-grouped dirs (`epics/`, `features/`, `stories/`). Child slugs qualify with the
  parent's slug (e.g. `creator-lifecycle-invite-flow`, not `invite-flow`). The `kind:` field
  carries the kind; the id/filename do not repeat it.
- **Backlog tier:** bare-slug `id:`, flat files (`.work/backlog/<slug>.md`).

## Release-binding lifecycle

How `release_binding` gets written, removed, and queried:

- **Features/stories bind at review-pass.** When the user approves a review, they pick the
  target release and `release_binding: <version>` is set as the item moves to `stage: done`.
- **Gate findings bind at creation.** Scan skills running in a release-gate context set
  `release_binding: <version>` on each finding at creation — "must be resolved before that
  version ships" even before the finding has been scoped.
- **Single-binding.** An item binds to one release at a time; rebinding overwrites.
- **Epics bind with their children.** Epics don't span releases — every child of an epic binds
  to the same release, and the epic itself binds when it reaches `done`. Split epics that would
  naturally span releases rather than holding them in a long-running container.
- **`binding_guard: halt`** — before quality gates run, the plugin walks every bound item and
  verifies: (1) all children of a bound epic are bound to the same release, (2) a `done` epic
  whose children are bound is itself bound, (3) no `done` parent is unbound while its children
  are bound. Any inconsistency halts the release for user resolution.

## Batch-shape conventions

When a scan or triage surfaces N related findings, the resulting item takes one of three shapes:

- **(A) Feature with N inline tasks** — heterogeneous batch; one task per site.
- **(B) Feature with story children per variant** — batch splits into 2-3 clear sub-patterns.
- **(C) Feature whose design is a pattern statement, no enumerated task list** — homogeneous batch; agent detects sites via tool and sweeps. **Default.**

Shape is committed at `stage: implementing`, not necessarily at scan time.

## Platform-local conventions

These are deliberate strengthenings over agile-workflow plugin defaults. Both are candidates for
upstream contribution; they are platform-specific until the plugin adopts them.

### Fix-verify loopback

Each user-verifiable fix is re-confirmed by the user before the story closes — stronger than the
plugin's default bounce-and-re-review cycle. This applies wherever a non-agent can visually
confirm the change (UI work especially, but also any behavior a human can exercise at the
keyboard or in the browser). The loopback is: implement → review → user confirms in the
running app → close. A review that passes without the user having exercised the change is not
complete under this convention.

*Candidate upstream PR:* the loopback matters most for platforms where user-facing work
dominates and the agent cannot self-verify production behavior.

### `## Prod verification` release-file lifecycle

The plugin's `released` stage is terminal — the plugin considers a release done when the stage
is set. Platform's convention is that the release file carries a `## Prod verification` section
of residual prod-only checks (OAuth flows, SMTP delivery, real-follower subscription paths, SRS
RTMP live ingestion) that the operator walks post-ship at the user's station. These checks are
not automatable in CI and require production credentials.

Shipping completes the plugin lifecycle (stage → `released`). Prod verification is a
platform-local follow-through on the release file — it does not hold the plugin lifecycle open.
The `## Prod verification` section is added to the release file by the review pass that first
lifts a residual prod-only check (or by hand when the release is planned) and filled in as items
pass review; the operator walks it after deploy.

*Candidate upstream feature:* a `post_release_checklist:` field in release frontmatter that the
plugin surfaces after `released` is set, for deployment-context checks that can't run in CI.
