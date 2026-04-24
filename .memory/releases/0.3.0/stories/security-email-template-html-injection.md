---
id: story-security-email-template-html-injection
kind: story
stage: done
tags: [security, community]
release_binding: 0.3.0
created: 2026-04-24
updated: 2026-04-24
related_decisions: []
related_designs: []
parent: null
---

Surfaced by the 0.3.0 security-gate scan (api/storage+lib+db+config). **S2 elevated to release-binding** given 0.3.0 exercises the go-live + invite email flows with user-controlled creator names.

[email/templates/go-live.ts](../../apps/api/src/email/templates/go-live.ts), [new-content.ts](../../apps/api/src/email/templates/new-content.ts), and [invite.ts](../../apps/api/src/email/templates/invite.ts) all interpolate user-controlled fields — creator `displayName`, content `title`, invite-payload `displayName` + `role` — directly into HTML bodies without calling `escapeHtml()`. The helper already exists and is correctly used in [templates.ts](../../apps/api/src/email/templates.ts) for the inquiry template; it just isn't applied to the three notification/invite templates.

Exploit shape: a creator sets their profile `displayName` to e.g. `Alice<img src=x onerror=...>`; every follower receiving a go-live or new-content email gets that payload rendered in a context where some mail clients will evaluate attributes. Also minor attribute-injection via crafted URL values if any value ever makes it into an `href`.

Fix is 3-call-sites wide and mechanical — already-tested helper.

## What changes

In the three affected template files:
1. Import `escapeHtml` from `../templates.js` (same module that defines it).
2. Wrap every interpolated user-controlled string in `escapeHtml(...)` before the template literal emits it.
3. URL values (`liveUrl`, `contentUrl`, `acceptUrl`) should use `escapeHtml` too — they're already origin-bound via `getFrontendBaseUrl()` after the 0.3.0 refactor fixes, but the HTML-context escape is still needed for the quote-attribute safety.

## Tasks

- [ ] `email/templates/go-live.ts` — escape `creatorName`, `contentTitle`, `contentUrl`, `liveUrl`.
- [ ] `email/templates/new-content.ts` — escape `creatorName`, `contentTitle`, `contentUrl`.
- [ ] `email/templates/invite.ts` — escape `displayName`, `role`, `acceptUrl`.
- [ ] Add a unit test per template that asserts an `<script>` payload in the creator name ends up as `&lt;script&gt;` in the rendered HTML.

## Verification

- Unit tests green.
- Optional manual: seed a creator with `displayName: "Alice<script>alert(1)</script>"`, trigger a go-live notification (mailpit catches it), inspect the HTML body in mailpit — should contain `&lt;script&gt;`, not `<script>`.

## Risks

None. `escapeHtml` is the same helper already in use on the inquiry template; behavior is well-understood.
