---
id: creator-simulcast-url-validation
kind: story
stage: review
tags: [streaming, creators]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-06-12
updated: 2026-06-12
parent: null
---

# Validate simulcast destination URLs as RTMP

UX-review finding (creator audit C3 + state inspection, severity 3): the destination
form accepts non-RTMP protocols (an `https://` URL passed client and server validation
silently); the failure surfaces only later when SRS can't forward. Enforce
`rtmp://`/`rtmps://` scheme in the shared Zod schema (single source — server validator
and `zod/mini` client both inherit), with an inline field error. Check both creator
(`simulcast-destination-manager.tsx`) and admin simulcast forms — the component is
shared.

## Acceptance
- [x] Non-RTMP scheme rejected with an inline field error at submit time
- [x] Server-side validator rejects it independently (shared schema test)
- [x] Existing destinations unaffected

## Implementation notes

**Changed files:**

- `packages/shared/src/simulcast.ts` — exported `RTMP_URL_REGEX = /^rtmps?:\/\/.+/` (line 6) with JSDoc. Applied `.url().regex(RTMP_URL_REGEX, ...)` to `CreateSimulcastDestinationSchema.rtmpUrl` (line 53) and `UpdateSimulcastDestinationSchema.rtmpUrl` (line 62). Kept `.url()` — verified in tests that `z.string().url()` accepts `rtmp://` in zod v4 (the zod `url` validator does not restrict scheme in this version). The `.regex()` then narrows to rtmp/rtmps only, giving a human-readable error.
- `apps/web/src/components/simulcast/simulcast-destination-manager.tsx` — imports `RTMP_URL_REGEX` from `@snc/shared` (line 11); `rtmpUrlError` state (line 60); `handleSubmit` validates `rtmpUrl` against `RTMP_URL_REGEX` before calling the API (lines 120-123); RTMP URL `<input>` has `aria-describedby` wired to the error span (line 242); inline `<span id="dest-rtmpUrl-error">` renders on error (lines 244-247); `onChange` clears `rtmpUrlError` (line 239); `resetForm` clears it (line 100).
- `apps/web/src/components/simulcast/simulcast-destination-manager.module.css` — added `.fieldError` class (lines 60-63): `font-size: var(--font-size-sm); color: var(--color-error)`.
- `packages/shared/tests/simulcast.test.ts` — new file: tests for `RTMP_URL_REGEX` (accepts rtmp/rtmps, rejects https/empty), `CreateSimulcastDestinationSchema.rtmpUrl` (rtmp/rtmps accepted, https/empty/ftp rejected), `UpdateSimulcastDestinationSchema.rtmpUrl` (rtmp/rtmps accepted, optional omission OK, https rejected). 11 test cases.
- `apps/web/tests/unit/components/simulcast-destination-manager.test.tsx` — new file: 4 test cases covering inline error on https:// submit, error cleared on field edit, valid rtmp:// calls createDestination, list renders existing destinations.

**Note:** `simulcast.test.ts` was already in `packages/shared/tests/` (treated as a new file in this session). The `simulcast-destination-manager.module.css` `.fieldError` class was added as part of this item.

Admin simulcast form uses the same `SimulcastDestinationManager` component with `variant="table"` — the fix covers both surfaces from the shared component.

## Review (2026-06-12)

**Verdict**: Approve — held at review on fix-verify loopback (platform convention:
user re-confirms the fix in the running app before close). Fast lane: implementation
record green (full suite: 671 shared + 1501 api + 1607 web, typecheck clean); diff
spot-checked against the story brief at feature-level review.
