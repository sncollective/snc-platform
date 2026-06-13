---
id: failed-upload-blocks-retry
kind: story
stage: review
tags: [content, user-station]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-04-18
updated: 2026-06-12
parent: null
---

# Failed Upload Blocks Retry

**Fix landed.** `onError` and completion-error handlers now remove the file from Uppy, triggering S3 multipart abort. Retrying after a failed upload no longer presents "already exists" errors.

## Original problem

After an upload error (e.g. CORS failure), retrying the same file failed with "already exists". Stale Uppy/S3 multipart state was not cleaned up on failure — the client held a stale reference to the in-progress multipart upload, and the server still had the incomplete multipart parts in Garage S3.

## Fix

`onError` and completion-error handlers now call the Uppy file removal API, which triggers Uppy/TUS's S3 multipart abort path. This clears the client-side stale state and ensures the server-side multipart upload is aborted, allowing the same file to be re-uploaded cleanly.

## Verification

- [ ] Upload a file, simulate a CORS or network error mid-upload.
- [ ] Retry the same file — upload proceeds without "already exists" error.
- [ ] Garage S3 has no orphaned multipart uploads after the retry.
- [ ] Successful uploads are unaffected.

## Review (2026-06-12)

**Verdict**: Approve with comments

**Blockers**: none
**Important**: none
**Nits**: story body recorded no file references or test evidence (pre-conversion item);
verification was run at review instead.

**Notes**: Fast lane with cheap verification (no test record existed on the item). Verified
at review: error-path `removeFile` cleanup present in
`apps/web/src/contexts/upload-context.tsx` (error handler at :356, completion-error at
:370-372, and :477-479), which triggers the Uppy/TUS S3 multipart abort path described in
the fix. Web unit suite 1600/1600 green.

**Hold — fix-verify loopback pending.** The behavioral checklist above (simulated
mid-upload failure → clean retry, no orphaned multipart uploads in Garage) is
user-verifiable in the running app and remains unchecked. Story stays at `stage: review`
until confirmed.

## Fix-verify: DEFERRED to staging/prod (2026-06-13)
Held at review, NOT failed. The verifying condition is a forced-failure / real-infra
path a dev station can't readily reproduce; it rides a staging or release
prod-verification check rather than the dev fix-verify loopback.
**Needs**: an upload killed mid-flight (CORS/network) then retried — confirm no
"already exists" and no orphaned Garage multipart parts.
