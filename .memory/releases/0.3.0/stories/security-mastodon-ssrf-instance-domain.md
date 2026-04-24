---
id: story-security-mastodon-ssrf-instance-domain
kind: story
stage: done
tags: [security, access-model]
release_binding: 0.3.0
created: 2026-04-24
updated: 2026-04-24
related_decisions: []
related_designs: []
parent: null
---

Surfaced by the 0.3.0 security-gate scan (api/services+jobs+auth). **S1 — SSRF.**

[mastodon-auth.ts:85](../../apps/api/src/services/mastodon-auth.ts#L85) (and the sibling `startMastodonAuth` flow) accepts `instanceDomain` as a bare `z.string().min(1)` with no hostname validation. The service immediately uses it to construct `https://${instanceDomain}/api/v1/apps` and fetch. An unauthenticated caller to `POST /api/auth/mastodon/start` can supply:

- `localhost`, `127.0.0.1` — probe local services
- `169.254.169.254` — AWS metadata endpoint (credential theft in any cloud-hosted deployment)
- internal Docker service names (`snc-postgres`, `snc-garage`, etc.) — enumerate internal infra
- `file:///...` — already blocked by the `https://` prefix but worth noting

Exploitable pre-auth. Classic SSRF pattern.

## What changes

Add a strict hostname validation on the `instanceDomain` field in `MastodonStartSchema` (in `packages/shared/` or wherever it lives) and re-assert at the service boundary:

- Must parse as a valid URL hostname (no path, no protocol prefix, no `@`).
- Reject bare IPv4/IPv6 addresses.
- Reject private IP ranges after DNS resolution would be ideal, but schema-level rejection of literal IPs + localhost handles the easy cases. Full DNS-rebind-safe SSRF defense is out of scope for this fix; a `revisit_if` will flag if we ship to a cloud with metadata-endpoint exposure.
- Reject `localhost`, `.local`, `.internal`, `.docker.internal`.

Use a Zod `.refine()` so the rejection produces a clean `ValidationError` via the existing validator middleware.

## Tasks

- [ ] Add `isPublicHostname(s: string): boolean` helper — probably in `@snc/shared` alongside `HANDLE_REGEX` etc., or a new `net-validation.ts`.
- [ ] Apply `.refine(isPublicHostname, { message: "Invalid Mastodon instance hostname" })` to the `instanceDomain` field in the Zod schema.
- [ ] Also validate defensively inside `mastodon-auth.ts:getOrRegisterApp` + `startMastodonAuth` — the service should never trust the caller to have validated.
- [ ] Unit tests: reject `localhost`, `127.0.0.1`, `10.0.0.1`, `169.254.169.254`, `snc-postgres`, `example.com:8080` (port should be stripped or rejected); accept `mastodon.social`, `mastodon.example.com`.

## Verification

- Unit tests green.
- Manual: `curl -X POST http://localhost:3000/api/auth/mastodon/start -d '{"instanceDomain":"localhost"}' ...` → 400 ValidationError.

## Risks

Low. Mastodon federation inherently depends on external hostnames; the validation filters obvious-bad values without restricting legitimate public instances. The helper may also be reusable for any future ActivityPub federation surfaces.
