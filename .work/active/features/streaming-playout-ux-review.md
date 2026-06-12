---
id: streaming-playout-ux-review
kind: feature
stage: review
tags: [streaming, playout, design-system]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-06-12
updated: 2026-06-12
parent: null
---

# Streaming + playout UX/UI review

## Brief
A structured UX/UI audit of the streaming and playout surfaces across all three
audiences: viewer-facing (`apps/web/src/routes/live.tsx`, the global player),
creator-facing (`creators/$creatorId/manage/streaming.tsx`, simulcast destination
manager, stream key management), and admin (`apps/web/src/routes/admin/playout.tsx`).
Output: findings per surface plus a go/no-go redesign recommendation per surface —
redesign epics spawn from this review only where it says rework is warranted, per the
"agent surfaces evidence, user decides" framework in `docs/ux-decisions.md`.

The review may propose changes to the design system itself (tokens, shared components,
the context-shell pattern), not just recompositions within it — design-system findings
are first-class output, tagged `[design-system]` when filed.

## Coordination with bold-refactor epics (2026-06-12)
This review runs before/alongside the bold-refactor epics scoped the same day. Its
conclusions feed the design of `bold-event-spine` (what events the screens actually
need, which screens survive). If redesigns proceed, the redesigned screens should be
born subscribed to the SSE spine rather than converted from polling first —
`bold-event-spine-client-subscriptions` gets absorbed into the redesign work or shrinks
to surfaces the redesign doesn't touch. The backend epics (`bold-channel-topology`,
`bold-lifecycle-transitions`, `bold-upload-purpose-registry`) are independent of this
work; named lifecycle states and drift surfacing from those epics are good inputs for
what the admin UI can honestly display.

## Strategic decisions
- **Commitment shape**: audit first — review produces findings + per-surface go/no-go;
  redesign epics spawn only where warranted. Avoids redesigning screens the audit would
  pass.
- **Surface scope**: all three audiences equally (viewer, creator, admin) — one coherent
  sweep, no priority ordering.
- **Design-system scope**: in scope — the review may propose token/component/shell
  changes directly, accepting the wider blast radius.

## Design decisions
- **Evidence mode**: live walkthrough + code — journeys walked in the running dev env
  (seeded playout, simulated live takeover) with screenshots as primary evidence; code
  read covers error/empty/loading states the happy path doesn't show. Code-only was
  rejected: aesthetic/interaction findings are guesses without real screens — weak
  evidence for a user-decides framework.
- **Mobile scope**: mobile everywhere — all four surfaces audited at both viewports,
  including admin playout (user call 2026-06-12, overriding the desktop-first-for-admin
  recommendation).
- **Audit structure**: journey-based primary (the three canonical journeys from
  `docs/streaming.md` §Stream Flow plus admin/creator management journeys), per-surface
  state inspection secondary. Journeys catch flow friction; state inspection catches
  error/empty/loading coverage.
- **Findings home**: feature body (item-IS-the-work). Screenshots go to
  `.memory/scratchpad/streaming-playout-ux-review/` — they serve the live decision
  session, not the archive, so every finding's text must stand alone without the image.
- **Accessibility routing**: objective WCAG findings are agent-autonomous per
  `docs/ux-decisions.md` §The Boundary — filed directly as items during the audit, not
  held for the go/no-go session. The go/no-go covers only the user-decides domains
  (patterns, hierarchy, aesthetics, interaction models).

## Audit protocol

### Rubric
Every finding is judged against, in priority order:
1. **NN/g 10 usability heuristics** with severity 0–4 (0 = not a problem, 1 = cosmetic,
   2 = minor, 3 = major, 4 = catastrophic/blocker). Severity considers frequency ×
   impact × persistence.
2. **WCAG 2.2 AA quick pass** — apply the `scan-accessibility` rule library; objective
   violations are filed directly as items during the audit (agent-autonomous domain),
   tagged per the taxonomy, and counted in the surface's evidence brief but NOT held
   for the go/no-go.
3. **Platform research nuggets** (`docs/ux-decisions.md`): bottom-tabs > hamburger on
   mobile, 3–5 tab optimum, ≤2 levels of progressive disclosure, role-consistent nav,
   group-by-function-not-role, design-token reuse (`var(--token)` from global.css).

### Finding record format (mandatory — synthesis rejects incomplete records)
```
- [<surface>/<viewport>] <journey-or-state> — <description (must stand alone without
  the screenshot)>. Heuristic: <name>. Severity: <0-4>.
  Evidence: .memory/scratchpad/streaming-playout-ux-review/<file>.png.
  Direction: <one line, optional>.
```

### Environment prep (verified working 2026-06-12)
1. Services: `pm2 status` (api/web/web-staging online) + docker stack healthy.
2. Fresh container: DB must be migrated + seeded — `bun run --filter @snc/api
   db:migrate`, then in `apps/api/`: `bun run db:seed-channels`, `bun run seed:demo`,
   and `bash scripts/dev/init-garage.sh` BEFORE seed:demo if Garage is fresh
   (S3_ERRORs otherwise). Playout clips: `bash scripts/dev/seed-playout-content.sh` +
   `bash scripts/dev/generate-playout-playlist.sh`.
3. Demo logins (password `password123`): `admin@snc.demo` (admin),
   `maya@snc.demo` / `jordan@snc.demo` / `sam@snc.demo` (creators),
   `pat@snc.demo` (plain user).
4. Screenshot capture: from `apps/e2e/`, `bun -e` with `@playwright/test`'s `chromium`
   against the staging server `http://localhost:3082`; viewports 1440×900 (desktop) and
   375×812 (mobile). Browsers via `bash scripts/dev/install-e2e-browsers.sh` if absent.
   Wait for player readiness beyond `networkidle` when capturing playback states — HLS
   startup lags page load.
5. Live takeover: `bash scripts/dev/test-live-fallback.sh` (ffmpeg test pattern into
   Liquidsoap :1936; Ctrl+C / kill to trigger fall-back). Note: this bypasses SRS
   stream-key validation, so no live-channel row appears — it exercises the Liquidsoap
   fallback switch only. Full SRS-path live (OBS-style with a real stream key) requires
   pushing to `rtmp://localhost:1935/live/<name>?key=<key>`.
6. **Known hazard**: if on_publish callbacks fail repeatedly, the playout chain wedges
   on the API rate limiter AND SRS retains zombie publisher sessions that bounce fresh
   connects even after the limiter clears (backlog: srs-callback-rate-limit-deadlock).
   Recovery: `docker stop snc-liquidsoap` → `docker restart snc-srs` → wait >60s →
   `docker start snc-liquidsoap`.

### Journey scripts
Run each at BOTH viewports. Check off in the story body as walked; mark blocked
journeys explicitly rather than skipping silently.

**Viewer** (anonymous + logged in as `pat@snc.demo`):
V1. Cold tune-in: navigate to `/live`, observe time-to-first-frame, what the page
    communicates while buffering, channel selector clarity, viewer count.
V2. Theater mode toggle on/off; chat collapse/expand; layout persistence on reload.
V3. Live takeover mid-watch: start `test-live-fallback.sh` while on `/live`, observe
    the transition (does the viewer understand what changed?); stop it, observe
    fall-back.
V4. Navigate away from `/live` with playback running: global player docking behavior,
    mini-player controls, return-to-live affordance.
V5. Chat: join as anonymous (what's offered?), then logged in; send message; observe
    moderation-state visibility (slow mode etc. if surfaceable).

**Creator** (as `maya@snc.demo`):
C1. First-time OBS setup: from creator manage → streaming tab; can you assemble a
    working OBS config (server URL + key) without leaving the page? Key
    reveal/copy/regenerate flow.
C2. Key rotation: rotate the key; is the consequence (old key dies) communicated?
C3. Simulcast: add a (fake) Twitch RTMP destination; edit; remove; what happens
    while "live" vs offline; invalid URL handling.

**Admin** (as `admin@snc.demo`):
A1. Queue-next: from `/admin/playout`, pick the Classics channel, insert a pool item
    into the queue, watch it promote on the 3s poll; remove a queued item; skip the
    playing track.
A2. Pool building: assign existing content to the pool via search picker; add via
    direct form; remove; observe empty states.
A3. Channel creation: create a new playout channel; what feedback ties it to the
    Liquidsoap restart consequence?
A4. Failed ingest: locate an ingest-failed item (or note inability to simulate) and
    walk the retry affordance.
A5. `/admin/simulcast`: destination CRUD as admin.

### State inspection (code-read, per surface)
Enumerate every error/empty/loading state reachable in the surface's components and
record a coverage verdict each: handled-well / handled-poorly / unhandled. Force states
where cheap (kill SRS container for status-error states; empty queue/pool exists
naturally post-seed).

## Architectural choice
**Protocol-first, then parallel per-surface audits, then synthesis.** A shared rubric
story runs first so the three surface audits produce comparable, mechanically
aggregatable findings; the surface audits then run independently (parallelizable); a
synthesis story owns cross-surface findings, design-system findings, and the interactive
go/no-go session. Rejected: one monolithic audit pass (won't fit one stride at 4
surfaces × 2 viewports, and evidence quality degrades without a fixed rubric);
journey-only audit (misses surface-local state coverage — error/empty/loading — which
the code read is specifically there to catch).

## Implementation Units

### Unit 1: Audit protocol + environment prep
**Story**: `streaming-playout-ux-review-protocol`
**Output**: a `## Audit protocol` section appended to this feature body, plus a verified-working capture environment.

The protocol defines:
- **Rubric**: NN/g 10 usability heuristics with 0–4 severity ratings; WCAG 2.2 AA quick
  pass (lean on the `scan-accessibility` rule library rather than restating it); the
  platform research nuggets from `docs/ux-decisions.md` (bottom-tabs evidence,
  ≤2-level progressive disclosure, role-consistent nav, design-token reuse).
- **Finding record format** (every finding must carry all fields):
  `surface / viewport / journey-or-state / description / heuristic violated / severity
  0–4 / evidence screenshot path / suggested direction (one line, optional)`.
- **Journey scripts**: step-by-step walkthrough scripts per surface (see Units 2–4)
  at two viewports (mobile ~375px, desktop ~1440px — match the e2e config's devices).
- **Environment prep**: dev env healthy (`pm2 status`), playout seeded
  (`scripts/dev/seed-playout-content.sh`, `scripts/dev/generate-playout-playlist.sh`),
  live-takeover simulation verified once via `scripts/dev/test-live-fallback.sh`,
  Playwright browsers present (`scripts/dev/install-e2e-browsers.sh`) for screenshot
  capture.

**Acceptance Criteria**:
- [ ] `## Audit protocol` section exists in the feature body with rubric, record format, and per-surface journey scripts
- [ ] Dev env walkthrough of one journey end-to-end with screenshot capture proven working at both viewports
- [ ] Live-takeover simulation runs (or is documented as unavailable with the fallback noted)

### Unit 2: Viewer surface audit
**Story**: `streaming-playout-ux-review-viewer-audit`
**Surfaces**: `apps/web/src/routes/live.tsx` (default, theater mode, chat
expanded/collapsed, channel-switch search param), the global player
(`apps/web/src/components/media/global-player.tsx` + context) including mini-player
persistence across navigation.
**Journeys**: viewer tunes in cold; live takeover happens mid-watch (via
`test-live-fallback.sh`); viewer navigates away with player docked; chat join as
logged-in vs anonymous.
**State inspection (code + forced states)**: stream offline, HLS error, status-poll
failure (15s poll), empty chat, slow-mode/moderation states surfaced to viewer.

**Acceptance Criteria**:
- [ ] All journeys walked at both viewports with findings recorded in protocol format under `## Findings — viewer`
- [ ] Error/empty/loading states enumerated from code with coverage verdict per state
- [ ] Objective WCAG findings filed as items (tagged per taxonomy), not held for go/no-go

### Unit 3: Creator surface audit
**Story**: `streaming-playout-ux-review-creator-audit`
**Surfaces**: `apps/web/src/routes/creators/$creatorId/manage/streaming.tsx` (stream
key lifecycle, connect instructions), `apps/web/src/components/simulcast/simulcast-destination-manager.tsx`.
**Journeys**: creator sets up OBS for the first time (key reveal → copy → connect info
comprehension); creator rotates a compromised key; creator adds/removes a Twitch
simulcast destination (including the live-reload semantics).
**State inspection**: key-rotation confirmation flow, invalid RTMP URL entry, destination
add/remove while live vs offline, permission-denied (non-owner team member).

**Acceptance Criteria**:
- [ ] All journeys walked at both viewports with findings recorded under `## Findings — creator`
- [ ] State/error coverage verdict per state from code read
- [ ] Objective WCAG findings filed directly as items

### Unit 4: Admin surface audit
**Story**: `streaming-playout-ux-review-admin-audit`
**Surfaces**: `apps/web/src/routes/admin/playout.tsx` (channel select, queue
insert/remove/skip on the 3s poll, content pool assign/search, channel creation),
`/admin/simulcast` destination management.
**Journeys**: admin queues an item to play next and watches it promote; admin builds the
rotation pool from existing content; admin creates a new playout channel; admin retries
a failed ingest.
**State inspection**: queue-poll failure (silent stale data), empty pool, empty queue,
ingest-failed items, concurrent-admin staleness (3s window).

**Acceptance Criteria**:
- [ ] All journeys walked at both viewports (mobile included per design decision) with findings under `## Findings — admin`
- [ ] State/error coverage verdict per state
- [ ] Objective WCAG findings filed directly as items

### Unit 5: Synthesis + go/no-go session
**Story**: `streaming-playout-ux-review-synthesis`
**Output**: `## Synthesis` section in this body + the interactive decision session +
follow-up items filed.

- Cross-surface consistency findings (same concept rendered differently across surfaces).
- Design-system findings separated out (tokens, shared components, context-shell) —
  filed as `[design-system]` items per the strategic decision, not solved here.
- Lightweight comparable-product scan (Twitch viewer UX, YouTube Studio / Twitch
  dashboard patterns for creator+admin surfaces) as evidence, per `docs/ux-decisions.md`
  decision-lifecycle step 1.
- **Per-surface evidence brief + go/no-go recommendation**, presented interactively;
  the user decides per surface (the ux-decisions collaboration model). Redesign epics
  are scoped only for "go" surfaces.
- Event-spine feed: a short list of "events these screens actually need" appended to the
  synthesis, explicitly for the `bold-event-spine` design to consume.

**Acceptance Criteria**:
- [ ] Evidence brief per surface with go/no-go recommendation and severity-weighted finding counts
- [ ] User decision recorded per surface under `## Synthesis`
- [ ] Follow-up items filed per decision (redesign epic(s) scoped for go surfaces; standalone fix/polish items for no-go surfaces' actionable findings)
- [ ] Event-needs list written for bold-event-spine

## Implementation Order
1. `streaming-playout-ux-review-protocol`
2. `streaming-playout-ux-review-viewer-audit`, `-creator-audit`, `-admin-audit` (parallel)
3. `streaming-playout-ux-review-synthesis`

## Verification approach
This feature produces findings, not code — there are no unit tests. Verification is:
protocol-completeness (every journey × viewport checkbox walked or explicitly marked
blocked), finding-record completeness (every finding carries all rubric fields — a
finding without evidence or severity is rejected at synthesis), and user sign-off in the
go/no-go session as the final gate. Any code-level fixes discovered en route are filed
as items, never fixed inline (audit integrity mirrors the test-integrity rule).

## Orchestration note (2026-06-12)
The three surface audits ran as sub-agents (wave 1: viewer + creator parallel; wave 2:
admin solo, since A3 restarts Liquidsoap). **Deviation from design**: findings live in
each audit story's body (`## Findings — <surface>`), not hoisted into this file — three
agents appending to one file concurrently was a write race; the stories are the
findings record and this synthesis aggregates them. Evidence screenshots (111+) in
`.memory/scratchpad/streaming-playout-ux-review/`. Residual env state: "Audit Test
Channel" + "Audit Test Film" remain in the dev DB (channel deletion has no UI — filed
as `bug-admin-no-channel-delete`).

## Synthesis

### Totals
65 findings across three surfaces (28 viewer / 18 creator / 19 admin): 1 severity-4,
18 severity-3, ~24 severity-2, ~13 severity-1, rest confirmations. Filed during audit:
13 a11y backlog items (3 viewer, 5 creator, 5 admin), 3 bug items
(`bug-connect-button-missing-style`, `bug-admin-no-channel-delete`,
`bug-admin-simulcast-window-confirm`), plus the pre-existing
`srs-callback-rate-limit-deadlock` from protocol env prep.

### Cross-surface findings
1. **System status is invisible everywhere** — the defining theme. Viewers can't tell
   a live creator took over (V3, sev 3, both viewports); the LIVE badge literally never
   renders on S/NC TV (`type === "live"` check never matches `"broadcast"` — data-model
   mismatch, the audit's highest-confusion finding); admins get silent stale data on
   queue-poll failure and a 3s stale window after every action; channel creation gives
   no warning that it restarts the playout engine. This family maps one-to-one onto the
   `bold-event-spine` epic — these screens are starved of events the server already has.
2. **Mobile reflow is systemically broken on management surfaces** — pool table (525px
   wide at 375px viewport), simulcast table, creator key form (button 48px off-screen),
   and the severity-4 create-channel form (submit button entirely off-screen). Common
   root cause: raw `<table>`/flex-row layouts with no responsive primitive. One
   design-system pattern (table→card at mobile + form-wrap) resolves all of them.
3. **Destructive actions lack consequence communication** — key revoke: no
   confirmation, no "old key stops working" warning (sev 3); channel creation: no
   restart warning (sev 2); destination delete: bare `window.confirm` (shared
   component, hits admin and creator surfaces).
4. **Live-reload semantics are incoherent and uncommunicated** — creator simulcast
   changes apply on next publish; admin changes apply immediately; neither surface says
   anything. Code-confirmed discrepancy.
5. **Design-system gaps surfaced by the audit**: `.secondaryButton` missing from
   `button.module.css` (buttons render unstyled — root cause of a target-size WCAG
   violation); focus-visible ring gaps (3 separate a11y items); no shared confirm-dialog
   component (hence `window.confirm`); no responsive table pattern. Token color
   contrast passed everywhere checked.

### Evidence briefs + recommendations (user decides per surface)

**Viewer (live page + global player)** — 28 findings, 8 sev-3. The majors cluster
coherently: dead-air cold start (12–15s blank player, skeleton CSS exists but unwired),
live-takeover invisibility, the never-rendering LIVE badge, mobile chat occupying half
the viewport with no collapse, mini-player touch targets. The surface's information
architecture is sound; what's broken is status communication + mobile ergonomics — and
the status family is exactly what the SSE spine feeds. **Recommendation: GO — scoped
redesign epic ("the live experience communicates state"), born subscribed to the event
spine.**

**Creator (streaming manage + simulcast)** — 18 findings, 7 sev-3. The majors are
discrete, independently shippable fixes: copy button, revoke confirmation, form wrap on
mobile, the missing CSS class (already filed as a bug), RTMP URL validation,
live-reload semantics note. The page structure itself tested well (one-page OBS setup
works). **Recommendation: NO-GO on redesign — file the majors as targeted fix stories;
no structural rework warranted.**

**Admin (playout + simulcast admin)** — 19 findings, 1 sev-4 + 3 sev-3. Two forces
push past fix-list: (a) mobile is in scope by explicit decision and the surface fails
reflow structurally (tables, forms, the sev-4) — that's layout redesign, not patching;
(b) this screen is the event spine's primary consumer (3s poll, stale windows,
silent failure, no restart feedback) — its data layer is scheduled to be replaced.
**Recommendation: GO — scoped redesign ("playout admin that fits in a pocket and
tells the truth"), born subscribed to the event spine.**

### Decisions (user, 2026-06-12)
- **Viewer: GO** — redesign epic `live-experience-redesign`, born subscribed to the
  event spine.
- **Creator: NO-GO** — five targeted fix stories filed (copy button, revoke
  confirmation, mobile form wrap, RTMP URL validation, simulcast semantics note);
  CSS bug + 5 a11y items already filed during audit.
- **Admin: GO** — redesign epic `playout-admin-redesign` (responsive structure +
  spine-fed data + honest action feedback), born subscribed to the event spine.
- Consequence: `bold-event-spine-client-subscriptions` is fully absorbed — both of its
  consumer screens are redesign-bound; noted on that item.
- Design-system follow-ups filed: `responsive-table-card-pattern`,
  `shared-confirm-dialog-component`.

### Events these screens need (input for bold-event-spine design)
- `channel.live-state-changed` (broadcast carrying live creator vs playout — fixes the
  LIVE-badge semantics properly, feeds viewer takeover notice)
- `playout.queue-changed` (entry added/removed/promoted/skipped — kills the 3s poll +
  stale windows)
- `playout.now-playing-changed` (track metadata for viewer + admin)
- `playout.engine-restarted` / `playout.config-drift` (admin banner; pairs with
  bold-channel-topology drift detection)
- `content.processing-status-changed` (ingest feedback, retry affordance)
- `channel.viewer-count` (periodic, low-frequency)

## Risks
- **Vague findings** ("feels cluttered") that can't ground a go/no-go — mitigated by the
  mandatory record format; synthesis rejects incomplete findings.
- **Live-takeover simulation fails in dev** — fall back to code-walking that journey and
  marking it "not live-verified" rather than asserting unverified UX claims
  (substrate-before-stance).
- **Audit drifts into redesigning** — directions are one-liners; mockups and redesign
  belong to the spawned epics after go decisions.
- **Design-system scope balloon** — design-system findings are filed, not solved;
  the feature ends at filed items + decisions.
- **Screenshot evidence is ephemeral** (scratchpad auto-deletes) — accepted: evidence
  serves the decision session; finding text must stand alone.
