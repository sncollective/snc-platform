---
id: story-failed-upload-blocks-retry
kind: story
stage: review
tags: [content, user-station]
release_binding: null
created: 2026-04-18
updated: 2026-04-18
related_decisions: []
related_designs: []
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
