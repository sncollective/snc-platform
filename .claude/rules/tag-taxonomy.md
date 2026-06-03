---
paths:
  - ".work/active/**"
  - ".work/backlog/**"
  - ".work/archive/**"
---

# Tag Taxonomy

Items are tagged by domain and/or pipeline kind via frontmatter `tags:`. An item carries multiple tags if it's cross-cutting. This rubric routes parked ideas and scoped items to the right tag(s).

All items here are platform-scope — there is no cross-project routing to resolve. The job of tags is to classify *what* an item is about and *how* it's worked, so tag-view projections and scan/triage skills can find the right batch.

See `item-convention.md` for item structure.

## Landing rubric (apply in order)

1. **Is it user-at-station deploy work?** (prod env, DNS, Caddy, TLS, infra security hardening, physical access) → tag: `deploy`
2. **Is it a code-level security finding?** (specific file/line issue) → tag: `security`
3. **Does it need e2e coverage review?** → tag: `testing`
4. **Does it need human-facing docs?** → tag: `documentation`
5. **Is it a refactor / code-quality issue?** → tag: `refactor` (plus the scan-family tag if a scan surfaced it — see §Quality / scan tags)
6. **Is it cross-cutting UX polish** (layout shifts, hydration, loading, errors) → tag: `ux-polish`
7. **Is it cross-cutting design-system** (tokens, shared components, responsive primitives, a11y patterns) → tag: `design-system`
8. **Is it infrastructure observability?** (logs, metrics, dashboards, alerts) → tag: `observability`
9. **Is it about the repo itself, agent skills, or project conventions?** → tag: `workflow`
10. **Otherwise** — pick the matching product domain below.

Cross-cutting items may carry multiple tags (e.g. `[content, creators]` for a creator-facing content feature; `[streaming, refactor]` for a refactor in the streaming domain).

## Lifecycle / work-location tags

Optional tags orthogonal to domain, indicating how an item is worked.

| Tag | Charter |
|---|---|
| `user-station` | Items requiring physical access, workstation credentials, or in-person ops (bringing hardware online, configuring the home-network firewall, testing against production credentials held only on the workstation). Orthogonal to domain. Filter: `grep -l "tags:.*user-station" .work/active/**/*.md .work/backlog/*.md` returns the batch of workstation-required items for desk-time work. |
| `batch-tracker` | Marks a parent item coordinating a batch of related findings (e.g. a scan sweep) so the cohort is queryable as a unit. |

New lifecycle tags require deliberate addition to this rule, not ad-hoc emergence.

## Domain tags

Each has a charter. If the item fits the charter, apply the tag.

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
| `developer-experience` | Tooling, build, local-dev ergonomics, agent-command surface — improving how the platform is built, not what it ships. |

## Cross-cutting quality tags

| Tag | Charter |
|---|---|
| `ux-polish` | Cross-domain UX friction: layout shifts, hydration pop-in, loading feedback, error/empty states, motion, responsive regressions. Domain-specific polish goes on the domain tag. |
| `design-system` | Tokens, shared components, responsive primitives, a11y patterns — system-level gaps surfaced after release migrations. |

## Pipeline-kind tags

Set by scan/triage skills. See `item-pipelines.md §Scan and triage pipelines` for the confidence-to-item mapping.

| Tag | Pipeline role |
|---|---|
| `refactor` | `/refactor-scan` creates items with this tag. |
| `security` | `/security-scan` creates items with this tag. |
| `testing` | `/e2e-triage` creates items with this tag. |
| `documentation` | `/docs-triage` creates items with this tag. |

## Quality / scan tags

`/refactor-scan` runs against the platform scan-rule libraries (`scan-quality`, `scan-stylistic`, `scan-structural`, `scan-accessibility`, `scan-performance`, `scan-seo`, `scan-documentation`). Findings carry the scan-family tag alongside `refactor`, so a sweep's cohort is queryable by rule family.

| Tag | Scan family |
|---|---|
| `quality` | `scan-quality` — duplication, complexity, pattern compliance. |
| `stylistic` | `scan-stylistic` — TypeScript/React/Hono style. |
| `structural` | `scan-structural` — file/folder/module organization. |
| `accessibility` | `scan-accessibility` — WCAG 2.2 AA static checks. |
| `performance` | `scan-performance` — query efficiency, CLS, LCP, bundle, data efficiency. |
| `seo` | `scan-seo` — meta tags, Open Graph, canonical URLs, structured data. |

## Platform ops tags

| Tag | Charter |
|---|---|
| `deploy` | User-at-station work needing prod credentials or physical access. Infra security hardening lives here; code-level findings go to `security`. |
| `observability` | Logs, metrics, dashboards, tracing, alerts — seeing the platform in production. |

## Meta tag

| Tag | Charter |
|---|---|
| `workflow` | Agent skills, project conventions, the work-item/research-band system itself. Repo housekeeping (dead files, orphaned docs, structural drift) is handled inline, not tracked. |

## Tag views

Tag views are generated projections, not hand-maintained per-tag board files. `scripts/tag-view.py <tag>` projects the matching items; ad-hoc grep also works:

```
grep -l "tags:.*content" .work/active/**/*.md .work/backlog/*.md
```

## When an item doesn't fit

If a parked idea doesn't clearly match a charter, ask the user before inventing a new tag. Tags should be created deliberately, not as catch-alls. Most "doesn't fit" items turn out to belong on a cross-cutting tag (`ux-polish`, `design-system`) or a domain tag if the scope is narrowed.
</content>
