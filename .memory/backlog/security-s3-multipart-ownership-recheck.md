---
tags: [security, content]
release_binding: null
created: 2026-04-20
---

# S3 Multipart Upload: Missing Ownership Re-check on Complete/Abort

`upload.routes.ts:429` — The complete and abort endpoints for multipart uploads do not re-verify that the caller owns the multipart upload being finalized or cancelled.

Exploitability is low because the `uploadId` is server-generated and opaque, so guessing a valid `uploadId` is not practical. However, there is no explicit ownership enforcement: any authenticated user who discovers or intercepts a valid `uploadId` could complete or abort another user's upload.

Suggested fix: at the start of the complete and abort handlers, look up the multipart upload record (if stored) and verify it belongs to the requesting user before forwarding the S3 call. If no server-side record is kept, add a short-lived association between `uploadId` and `userId` at initiation time.

Confidence: medium. Low exploitability in practice, but the ownership gap is real and worth closing before horizontal scaling increases concurrent uploads.
