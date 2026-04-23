---
date: 2026-04-23
tags: [content, media-pipeline, uploads]
session_type: implement
related_items:
  - feature-resumable-uploads-tus
related_decisions: []
related_designs: []
---

# Session: `resumable-uploads-tus` implemented — last event-enabling feature clears to review one day before Animal Future

Picked up at the pause point from the 2026-04-22 review-sprint wrap. `resumable-uploads-tus` — explicitly flagged as the last event-enabling item — is now at `stage: review`. All six sub-units landed, typecheck + test suites green, tusd container healthy. Manual cross-session resume verification is the only remaining pre-review step; `/review` owns it along with 0.3.0 binding.

## Arc

Orchestrated six implementation units via `/implement` with staged agent spawning.

**Wave 1 (parallel, 4 units):**

1. **Unit 2 — shared types** — `packages/shared/src/tusd.ts` + index re-export. Clean.
2. **Unit 5 — completion refactor** — extracted `completeUploadFlow`, `verifyOwnership`, `recordUpload`, and the `PURPOSE_*` dispatch tables out of `upload.routes.ts` into `services/upload-completion.ts`. Added `skipKeyValidation?: boolean` to the params so tusd post-finish can bypass the canonical-path check (tus objects live under `tus/` prefix). Preserved `verifyOwnership`'s `{ contentType?: string }` return and its `UnauthorizedError` throw — the design's `AppError("UNAUTHORIZED", …)` suggestion would have changed error semantics for the presign/multipart routes that call it.
3. **Unit 1 — tusd docker + Caddy** — new `snc-tusd` service on `:8070`, S3 backend against `snc-garage`, hooks POST to `host.docker.internal:3000/api/tusd/hooks`. Deviated from the design's Vite-proxy approach — the actual dev substrate is Caddy, and `Caddyfile.dev` already had a stale `handle /uploads/*` → API route. Repointed it to `localhost:8070` and gave tusd `-base-path=/uploads/` so the path matches through the reverse proxy without rewrite directives. Browser uses relative `/uploads/`, stays same-origin, no CORS.
4. **Unit 6 — orphan cleanup job** — handler in `jobs/handlers/cleanup-incomplete-uploads.ts`, dual-path (Garage Admin API preferred, S3 `ListMultipartUploads`+`AbortMultipartUpload` fallback). Cron `0 3 * * *`, 24h threshold. Moved `GARAGE_ADMIN_TOKEN` into `config.ts` with a dev default rather than the design's hardcoded module constant.

Wave 1 initially had two stream-idle-timeouts (Units 1 and 5 hit ~900s before returning without changes). Respawned with tighter scopes — explicit "do not run test:unit" guardrail, since typecheck alone is sufficient for intermediate verification and orchestrator runs the full suite at the end. Both completed on retry in ~3-4 min.

Post-Wave 1, caught two API typecheck errors:
- `GARAGE_ADMIN_TOKEN` missing from `ENV_SCHEMA` — Unit 6's agent reported adding it but didn't actually modify `config.ts`. Added inline.
- `ReturnType<typeof rootLogger.child>` triggered TS2379 under `exactOptionalPropertyTypes: true` on pino v9 typings (`Logger<never, boolean>` vs `Logger<string, boolean>` mismatch). Replaced with a minimal structural `CleanupLogger` interface. Avoids the generic-parameter churn entirely.

**Wave 2 — Unit 3 (API hook route):**

`routes/tusd-hooks.routes.ts` with handlers for `pre-create`, `post-finish`, `post-terminate`, plus unknown-type fallback. No `requireAuth` middleware — tusd's POSTs come from the docker network carrying forwarded `Cookie`/`Authorization` headers, so auth is validated manually via `auth.api.getSession()`. `pre-create` checks session + metadata shape; ownership is deferred to `post-finish` where `completeUploadFlow({ skipKeyValidation: true })` runs the same path as the existing `POST /api/uploads/complete` route. 13 unit tests cover every rejection case + happy path. All pass.

**Wave 3 — Unit 4 (web upload-context dual-Uppy):**

`contexts/upload-context.tsx` rewrite. Two Uppy instances now: `tusUppyRef` for `content-media` + `playout-media` (via `@uppy/tus@^5.1.1`), `s3UppyRef` for thumbnails, avatars, banners (via existing `@uppy/aws-s3`). Routing in `startUpload` dispatches on `TUS_UPLOAD_PURPOSES.has(purpose)`. Event wiring split: `onTusSuccess` marks complete immediately (the post-finish hook already recorded the upload server-side — client passes empty-string key to its callback); `onS3Success` keeps the existing `completeUpload()` call. `cancelUpload` tries both instances via `uppy.getFile(id)` probe. Public `useUpload()` API unchanged.

Ignored the design's "Remove @uppy/aws-s3 after migration" bullet — internally inconsistent with the dual-instance plan. Skipped the Vite proxy change per the Wave 1 routing decision.

**Final verification:** shared 657/657, api (after fixing the config.test.ts `toStrictEqual` shape to include the new `GARAGE_ADMIN_TOKEN` key) + 13 new tusd tests pass, web 1599/1599. API typecheck 0 errors, web typecheck 30 pre-existing errors in unrelated files (`audio-detail.tsx`, `video-detail.tsx`, `chat-user-card.test.tsx`, `channel-card.test.tsx`) — none in tusd-touched files.

**Post-session catch:** Unit 6's agent had reported success on `register-workers.ts` wiring, but the grep at commit time showed neither `register-workers.ts` nor `queue-names.ts` had been touched. The handler file existed and typechecked standalone (it only imports types and `config`), so the typecheck suite passed without catching this — the job would simply never run at startup. Wired inline: queue name added, `boss.createQueue` + `boss.work` + `boss.schedule` call added alongside the notification-send block.

## Learnings

- **Agent success reports are aspirational, not authoritative.** Two cases this session where a Sonnet agent returned "clean, all done" but the actual file changes didn't land (Unit 6's `register-workers.ts` wiring; Unit 6's `config.ts` env-var addition). Final verification that runs typecheck + tests across the whole surface is necessary — but isn't sufficient for runtime-wired code paths that aren't exercised by existing tests (the job-worker registration is one). Grep for the expected symbol at the expected call site before declaring the unit done. Probably worth a convention for the orchestrator — "grep for the integration touchpoint, not just for the new file" during Step 9 verification.

- **Stream-idle timeouts are about the harness, not the work.** Both Wave 1 timeouts (Unit 1 and Unit 5) hit ~900s with partial output and left no file changes. Not a code-complexity issue — the respawned agents with identical scopes completed in 3-4 min. The tighter retry prompts with an explicit "do not run long tests inline" guardrail helped, but the root cause was probably just transient. Tool budget and explicit completion signals matter for agent stability on Opus orchestration of Sonnet workers.

- **Design-level routing assumptions need live grounding.** The design called for a Vite dev proxy that doesn't exist — this project uses Caddy as the dev entry point, and the `/uploads/*` route was already plumbed (pointed at the wrong target). Would have been a dead-end rabbit hole if implemented as-written. Grounding step 3 of `/implement` caught it because I read the actual dev server config before spawning agents. General pattern: when a design proposes infrastructure, verify that the proposed infrastructure exists as assumed before delegating.

- **Pino v9 `.child()` return type collides with `exactOptionalPropertyTypes: true`.** `ReturnType<typeof rootLogger.child>` resolves to `Logger<never, boolean>`, but function parameter positions inferred the "same" type as `Logger<string, boolean>` somewhere in the instantiation — the `.on()` method's listener signature diverges because of the generic. Structural duck-typed interfaces (`{ info, warn, debug }` shape) sidestep the issue cleanly. Worth noting for future helpers that want to accept child loggers — prefer structural over `ReturnType<typeof ...child>`.

- **Dual-instance Uppy is cleaner than conditional plugin switching.** The design's choice to run two separate Uppy instances (tus for large, S3 for small) sidesteps the complexity of per-file plugin selection at runtime, which would have required wrapping plugin methods in `if (TUS_UPLOAD_PURPOSES.has(purpose))`. Two instances share `dispatch` + `callbacksRef` and the public API stays identical. Cost is two `Uppy()` objects in memory and two sets of event listener wiring; benefit is each instance's plugin config stays focused.

- **Caddy `base-path` aligns upstream and downstream paths for free.** Tusd's `-base-path=/uploads/` flag lets the reverse proxy forward requests verbatim without `rewrite` directives — what the browser hits (`/uploads/abc`) is literally what tusd serves. Saves the `strip_prefix` / `rewrite` hassle that would have been needed if tusd insisted on `/files/` internally.

## State at end of session

`resumable-uploads-tus` at `stage: review`, `release_binding: null`. Ready for `/review` to handle the manual cross-session resume test (refresh page at 50%, re-drop file, confirm resume) and bind to 0.3.0. Animal Future is tomorrow (2026-04-24) — the refactor batch remains untouched and is not event-enabling; can defer past the event to 0.3.1 if review surfaces blockers here.
