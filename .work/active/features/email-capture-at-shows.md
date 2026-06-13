---
id: email-capture-at-shows
kind: feature
stage: implementing
tags: [community, commerce]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-06-06
updated: 2026-06-13
parent: null
---

# Email capture at shows → band followers → subscribe/donate funnel

Capture audience emails at live shows (sign-up sheet + QR) and register them as platform **followers of the band**, then funnel sign-ups into recurring revenue (Stripe subscribe / patronage / donate). **The funnel hook is the headline value, not an afterthought** — a new follower is a platform identity that can be invited straight into a subscribe/donate CTA.

Grounded in the scout brief [`.research/analysis/briefs/email-capture-at-shows-landscape.md`](../../../.research/analysis/briefs/email-capture-at-shows-landscape.md) (build-vs-buy rationale + sources; verified at standard rigor).

## Build-vs-buy — resolved: build native

The conversion goal decides it. The platform's reason to capture emails is to funnel into *its own* recurring revenue (Stripe + patronage); a bought fan-CRM (Laylo) funnels into *its* rails (Shopify/tickets — **no Stripe/subscription hook**), structurally ceding the owned audience. So: **build platform-native capture**, copying the purpose-built incentive UX (QR → 1-click signup tied to an at-show incentive), not buying the vendor.

Nuance the design must respect (from the adversarial-reviewed brief): both a native page *and* a hosted-form-webhook land the contact in-platform — so data-unification isn't unique to native. Native's real, decisive advantage is owning the **capture surface**: the at-capture UX, consent enforcement *at the moment of capture*, and a direct DB write with no external form vendor.

## Scope — the capture→contact→funnel flow

Likely stories (for `/design` to firm + split):

- **Native capture surface** — a QR-targeted signup route/landing page: 1-click, fast, mobile-first, incentive-aware. The at-show UX must rival the purpose-built tools.
- **Contact record + ingestion** — land the contact in the DB. Direct write for the native page; **CSV import is mandatory regardless** (paper sign-up sheets are unavoidable). A hosted-form **Tally-webhook fast-path** (signed JSON `FORM_RESPONSE`, HMAC-SHA256, free) is a legitimate v1/fallback if the native page is slow — design should decide whether to build it as an ingestion adapter or skip.
- **Consent + compliance** — explicit consent checkbox + privacy-policy link + a **timestamped consent log** at capture (email alone is not consent; GDPR needs provable consent, CAN-SPAM needs a working unsubscribe). Double opt-in confirmation optional but recommended for list quality. Ties to backlog `community-unsubscribe-link-emails`.
- **Funnel CTA → commerce** — wire a captured contact into a subscribe/donate/patronage CTA. This is the differentiator; design should make the capture→invite flow first-class. Ties to backlog `community-subscription-lifecycle-emails`.

## Stretch goals — S/NC explainer + subscriber conversion (light touch, user direction 2026-06-13)

Two optional layers on top of the core capture→follow flow, both **per-band configurable and off-by-default-able**:

- **"What is S/NC" explainer for new followers** — a brief post-signup moment that explains the cooperative to someone who just followed a band. The fan arrived for the band, not the org; the explainer earns its place by answering "what did I just sign up for?"
- **Subscriber-conversion CTA with the label framing** — the pitch is *organizational*, not band-personal: subscribing lets S/NC pick up artists like Animal Future as a label and help produce their content. The fan supports the band *through* the cooperative.

**Tone constraint (load-bearing):** the flow must never read as the band shilling for the org. The band's join page is the band's surface; S/NC content is clearly the platform speaking, visually and verbally distinct from the band's voice, skippable, and never gating the follow. If a band turns it all off, the fan gets a clean band-only follow flow.

**Configurability:** each band controls whether the explainer and/or the conversion CTA appear on their join flow (and plausibly the incentive hook, below). Design should decide where this config lives (creator settings) and what the defaults are.

## Settled at code grounding (2026-06-13)

- **Contact-record shape → follower identity for v1** (user direction). The captured email becomes a real user who **follows** the band — reuse the existing better-auth signup (`apps/api/src/routes/auth.routes.ts`) and the existing follow endpoints (`apps/api/src/routes/follow.routes.ts`, `services/follows.ts`); no new contact/lead tier for v1. The lead-record path survives only as the later CSV-import story (paper sign-up sheets), which may then need a light lead table — design that story when it's picked up, not now. Friction note for design: password signup at a merch table is clunky; evaluate a magic-link/OTP path (better-auth plugin) for the join page.
- **Conversion CTA exists — no commerce dependency.** Stripe subscription rails are live (`apps/api/src/routes/subscription.routes.ts`, `services/stripe.ts`, `services/revenue.ts`; web `use-checkout.ts` + pricing page). The funnel hook lands on existing rails.
- **What's genuinely missing** (code survey): QR generation (no dep anywhere — needs a `qrcode` lib + a band-facing "print my QR" surface), a public mobile-first `/join/:creatorSlug`-style route, the signup→auto-follow linkage (carry the creator through signup, fire the follow once the session exists), and the consent surface. Rate-limiting middleware, email service (Nodemailer→Mailpit), and invite-token infra all exist to build on.

- **Post-follow sequence ordering** (user direction 2026-06-13): the flow after the follow completes runs (1) *"here's what you get for following the band"* — the value recap, band-voiced; (2) *notification + contact preferences* — the follower opts in to channels **before any follow-up email is sent** (no email until preferences are chosen; ties to the consent surface and the existing notification-preferences infra); (3) *the S/NC explainer + subscribe CTA* at the end of the flow. Design firms the screens, not the order.

## Open questions (for `/design`)

- **At-show offline tolerance** — venue wifi/cell is flaky. Does the native page need offline-queue/PWA behavior, or is a hosted form genuinely more robust at the venue? (The one real point *for* the hosted-form path — test it, don't dismiss it.)
- **SMS as a second channel** — the purpose-built tools center SMS+email. In scope now or a later iteration?
- **Incentive mechanic** — does the at-show CTA need an incentive/prize/exclusive-content hook to convert (the pattern the brief found effective), and does that need its own surface?

## Connections

- Backlog `community-unsubscribe-link-emails` — the unsubscribe surface this feature's outbound consent flow needs (likely absorb or sequence).
- Backlog `community-subscription-lifecycle-emails` — post-capture funnel emails (downstream of the funnel hook).
- Backlog `events-integration-bandsintown-source-of-truth` — the "at shows" context; a captured contact could tie to an event/show.

## Risks

- **Offline capture failure at the venue** — if the native page can't capture without connectivity, sign-ups are lost at the highest-intent moment. Surfaced as the lead open question.
- **Consent debt** — shipping capture without the consent log + unsubscribe is a compliance liability the moment the first email sends. Consent is not a fast-follow; it's part of the capture surface.
- **Org-shilling perception** — if the S/NC explainer/conversion layer feels like the band pushing the org, it damages the band's relationship with its audience (the asset this whole feature exists to grow). The tone constraint and per-band configurability in Stretch goals are the mitigation; design must treat them as hard requirements, not polish.
- **OTP deliverability at the venue** (pre-mortem) — the riskiest assumption is that the fan's phone receives the code email within seconds on venue connectivity. Mitigations: resend button with cooldown, SMTP transport already pooled; if real shows surface delivery latency, the fallback is the email+password path behind the same page (or revisiting SMS). Spike-free: better-auth OTP behavior is verifiable in dev with Mailpit before the web story builds on it.
- **OTP request abuse** (pre-mortem) — the send-OTP endpoint emails arbitrary addresses. Verify better-auth's OTP rate limits are active in prod config; the join payload GET sits behind the existing `rateLimiter`. Flag for the security gate either way.
- **Tier rewards display** (pre-mortem) — `subscriptionPlans` has name/price/interval but no rewards/description column; "rewards outlined clearly" can only render plan names in v1. The richer tier surface belongs to backlog `idea-subscription-split-band-snc`, which owns reshaping the plan model.

## Design decisions

- **Join-page auth → email OTP, passwordless** (user, 2026-06-13): extend the already-installed better-auth `emailOTP` plugin for `sign-in` type. Fan enters name + email, receives a 6-digit code, account is created with verified email on the spot — no password at the merch table (set later in settings). The OTP doubles as consent-quality email verification. Rejected: email+password (the friction the purpose-built tools exist to avoid); email-only-verify-later (weak consent record, and the verification email would land before preferences are chosen, violating the settled flow order).
- **Offline → online-only v1 with tolerant UX** (user, 2026-06-13): tiny/fast page, retries on transient failure, input never lost on error. PWA offline queue rejected for v1 — OTP delivery needs the fan's connection anyway, so a queue can't complete signup offline. **Revisit on first real-show failure report.**
- **Incentive → configurable incentive text** (user, 2026-06-13): band sets an optional incentive line; the post-signup confirmation screen displays it ("show this screen at the merch desk"). No redemption/prize infra.
- **S/NC explainer + CTA → on by default, per-band opt-out** (user, 2026-06-13): the tone constraint (platform voice, skippable, never gating) carries the no-shilling burden.
- **SMS — deferred.** Email-only v1; SMS is a later iteration if at-show conversion demands it.
- **CSV import (paper sheets) — deferred to a follow-up story**, not spawned now. It needs the lead-record shape v1 deliberately avoids; design it when picked up.
- **No follow-up email in v1** beyond the OTP itself. The flow completes in-app; lifecycle/welcome emails are backlog `community-subscription-lifecycle-emails`, gated on the preferences captured here.

## Architectural choice

**A dedicated public multi-step join flow reusing existing rails end-to-end.** New surface is deliberately thin: two tables, one API route file + service, one auth-config extension, one public web flow, one creator-manage section. Auth = better-auth emailOTP (client plugin `emailOTPClient` is already installed in `apps/web/src/lib/auth-client.ts`); follow = existing `POST /api/creators/:creatorId/follow`; preferences = existing notification-preferences API; CTA = existing `useCheckout` → Stripe Checkout on existing per-creator `subscriptionPlans`.

Rejected: **Tally-webhook fast-path** (brief option B) — doesn't own the capture surface, consent UX is vendor-bound; keep only as a fallback if the native page slips badly. **Extending `/register` with a `?follow=` param** — minimal code but fails the at-show bar: password friction, desktop-shaped page, no staging for incentive/prefs/explainer.

## Implementation Units

### Unit 1: Schema — join config + consent log
**File**: `apps/api/src/db/schema/creator.schema.ts` (join config) + `apps/api/src/db/schema/consent.schema.ts` (new)
**Story**: `email-capture-at-shows-join-api`

```ts
/** Per-creator join-page configuration. Row optional — absent row = defaults. */
export const creatorJoinConfigs = pgTable("creator_join_configs", {
  creatorId: text("creator_id").primaryKey()
    .references(() => creatorProfiles.id, { onDelete: "cascade" }),
  incentiveText: text("incentive_text"),                                  // null = no incentive line
  showSncExplainer: boolean("show_snc_explainer").notNull().default(true),
  showSubscribeCta: boolean("show_subscribe_cta").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Append-only consent records. GDPR: cascade-delete on user erasure. */
export const consentLog = pgTable("consent_log", {
  id: text("id").primaryKey(),                    // follow existing app-generated id convention
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  consentType: text("consent_type").notNull(),    // "email-contact"
  policyVersion: text("policy_version").notNull(),
  source: text("source").notNull(),               // "join:<creatorId>"
  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("consent_log_user_idx").on(t.userId)]);
```

**Implementation Notes**: migration via `drizzle-kit` only (never hand-written SQL). `PRIVACY_POLICY_VERSION` constant lives in `packages/shared/src/` so web and API reference one value.

**Acceptance Criteria**:
- [ ] Migration generated and applies cleanly; both tables present
- [ ] Absent `creator_join_configs` row behaves as defaults (explainer + CTA on, no incentive)

### Unit 2: Join service + routes
**File**: `apps/api/src/services/join.ts`, `apps/api/src/routes/join.routes.ts` (mounted in `apps/api/src/app.ts`)
**Story**: `email-capture-at-shows-join-api`

```ts
// services/join.ts
export interface JoinPagePayload {
  creator: { id: string; handle: string | null; displayName: string;
             avatar: DprImage | null; banner: ResponsiveImage | null };
  config: { incentiveText: string | null; showSncExplainer: boolean; showSubscribeCta: boolean };
  followerCount: number;
  creatorPlans: PublicPlan[];   // creator-scoped subscriptionPlans (id, name, price, interval)
  sncPlans: PublicPlan[];       // platform plans (creatorId null)
}
export const getJoinPagePayload = (handleOrId: string): Promise<Result<JoinPagePayload, AppError>>;
export const completeJoin = (userId: string, creatorId: string, policyVersion: string)
  : Promise<Result<void, AppError>>;   // follow (existing followCreator) + consentLog insert, idempotent
export const getJoinConfig = (creatorId: string): Promise<Result<JoinConfig, AppError>>;
export const updateJoinConfig = (creatorId: string, patch: Partial<JoinConfig>)
  : Promise<Result<JoinConfig, AppError>>;
```

Routes (`thin-handlers-fat-services`, `validator` + `describeRoute` on all):
- `GET /api/join/:handleOrId` — public, behind `rateLimiter` (existing middleware), dual-mode handle/id resolution per `human-readable-url-slug` pattern
- `POST /api/join/:creatorId/complete` — `requireAuth`; body `{ consent: true; policyVersion: string }` (zod: `consent` must be literal `true`); idempotent (re-follow is a no-op, consent re-log is fine — append-only)
- `GET/PATCH /api/creators/:creatorId/join-config` — creator-member ownership check following `creator-members.routes.ts` pattern

**Implementation Notes**: consent is recorded server-side only on `complete` — the checkbox state never travels alone. `completeJoin` validates the creator exists. Upsert semantics for `PATCH` (insert row on first write).

**Acceptance Criteria**:
- [ ] Happy-path + auth-failure tests per route (project convention)
- [ ] `complete` without `consent: true` → 422; never writes a follow
- [ ] Join payload returns defaults when no config row exists; 404 on unknown creator
- [ ] `PATCH join-config` rejected for non-members

### Unit 3: OTP sign-in extension
**File**: `apps/api/src/auth/auth.ts`
**Story**: `email-capture-at-shows-otp-signin`

Extend the existing `emailOTP` plugin block: handle `type === "sign-in"` in `sendVerificationOTP` (send "Your S/NC sign-in code" via existing `sendEmail`); set `disableSignUp: false` **explicitly** (OTP sign-in must auto-create the account — this is the load-bearing behavior).

**Implementation Notes**: OTP-created users have no `name` — the join flow collects name client-side and calls `authClient.updateUser({ name })` immediately after the session exists. Verify better-auth's built-in OTP rate limiting is active in production config; if not, note it for the security gate.

**Acceptance Criteria**:
- [ ] `sign-in` OTP email sends through `sendEmail` (Mailpit-verifiable in dev)
- [ ] OTP sign-in with a new email creates a user with verified email; existing email signs in to the existing account
- [ ] `forget-password` OTP path unchanged

### Unit 4: Public join flow (web)
**File**: `apps/web/src/routes/join/$handle.tsx` + `join.module.css`; step components under `apps/web/src/components/join/`
**Story**: `email-capture-at-shows-join-flow-web`

Mobile-first wizard, no `beforeLoad` auth redirect (public). `loader` fetches `GET /api/join/:handleOrId` via `fetchApiServer`. Steps:

1. **Capture** — band header (avatar/displayName), incentive line if set, name + email (`zod-mini-form-validation` pattern), consent checkbox + `/privacy` link → `authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" })`
2. **Code** — 6-digit input → `authClient.signIn.emailOtp({ email, otp })` → `updateUser({ name })` → `POST /api/join/:creatorId/complete`
3. **You're in** — band-voiced value recap ("here's what you get for following"), incentive "show this screen" callout
4. **Preferences** — condensed notification/contact preferences (existing prefs API; event types `go_live`/`new_content`, channel `email`), saved before any further contact
5. **S/NC + CTA** (skippable, only if config flags on) — platform-voiced explainer (visually distinct from band surface): *subscribing lets S/NC pick up artists like Animal Future as a label and help produce their content*; tier cards from `creatorPlans` (name/price/interval) → `useCheckout(planId)`; `sncPlans` shown secondarily; prominent "Done / maybe later"

Already-authed visitor: skip 1–2, land on a one-tap "Follow <band>" + consent confirm. Submission failures: retry with input preserved (settled offline posture).

**Implementation Notes**: errors via `RouteErrorBoundary`; design tokens only; keep the page dependency-light for venue load times. Step state is in-component (no router persistence) — a refresh restarts the flow, acceptable at-venue.

**Acceptance Criteria**:
- [ ] Full wizard happy path tested with mocked `authClient` + fetch (`vi-hoisted-module-mock`)
- [ ] Consent unchecked → cannot request OTP
- [ ] Steps 3–5 respect config flags (explainer/CTA hidden when off)
- [ ] Authed-visitor short-circuit path works
- [ ] No outbound email triggered by the flow other than the OTP

### Unit 5: Band QR + join settings (creator manage)
**File**: `apps/web/src/routes/creators/$creatorId/manage/join.tsx` + module css
**Story**: `email-capture-at-shows-creator-qr-settings`

New "Join page" section in the existing creator-manage shell: shows the join URL (`/join/<handle ?? id>`), QR preview rendered client-side with the `qrcode` npm package (SVG), print view (print stylesheet — full-page QR + band name + incentive line), copy-URL button, and the config form (incentive text, explainer toggle, CTA toggle) bound to `GET/PATCH /api/creators/:creatorId/join-config`.

**Acceptance Criteria**:
- [ ] QR encodes the public join URL; print view is legible at poster size (SVG, not canvas)
- [ ] Config edits round-trip; defaults shown before first save
- [ ] Section only visible to creator members

### Unit 6 (inside Unit 4's story): `/privacy` placeholder route
**File**: `apps/web/src/routes/privacy.tsx`
No privacy-policy page exists anywhere in the web app — the consent checkbox legally needs one. Ship a minimal static route whose policy text is **clearly marked operator-supplied** (org/legal authors the content; the route and `PRIVACY_POLICY_VERSION` wiring are ours).

## Implementation Order

1. `email-capture-at-shows-join-api` (Units 1–2) ∥ `email-capture-at-shows-otp-signin` (Unit 3) — independent
2. `email-capture-at-shows-creator-qr-settings` (Unit 5) — after join-api
3. `email-capture-at-shows-join-flow-web` (Units 4 + 6) — after join-api + otp-signin

## Testing

- **API**: route tests under `apps/api/tests/routes/join.routes.test.ts` + service tests (`drizzle-chainable-mock`); auth.ts OTP branch via `vi-doMock-dynamic-import` asserting `sendEmail` payloads.
- **Web**: wizard step tests under `apps/web/tests/` mirroring routes/components (`vi-hoisted-module-mock` for authClient/fetch); QR page tests assert encoded URL + config round-trip.
- **Integration (pre-review gate)**: `test-api-integration` covers join payload + complete against real dev DB.
- **E2E**: the join golden path is a natural addition to backlog `testing-creator-follow-unfollow-e2e` — noted there, not in this feature's scope.

## Revisit if

- The contact-record decision (identity vs lead) turns out to be cross-cutting enough to warrant a decision record — promote it from `/design`.
- First real-show failure report on flaky venue connectivity — reopen the PWA/offline-queue decision.
