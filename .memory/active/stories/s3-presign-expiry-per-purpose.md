---
id: story-s3-presign-expiry-per-purpose
kind: story
stage: done
tags: [security]
release_binding: 0.2.1
created: 2026-04-18
updated: 2026-04-18
related_decisions: []
related_designs: []
parent: null
---

# S3 Presign Expiry Per Purpose

## Overview

Replaced a single uniform presign expiry duration with per-purpose expiry values calibrated to the expected use window for each asset type.

## Change

| Purpose | Expiry |
|---------|--------|
| Images (avatars, thumbnails, banners) | 5 minutes |
| Media / multipart uploads | 1 hour |

Previously all presigned URLs shared the same expiry. The shorter window for images reduces the window of opportunity if a presigned URL is intercepted or leaked. The longer window for media accommodates large file uploads that may take significant time to complete.

## Rationale

Presigned URLs grant temporary write access to S3 storage. A shorter expiry limits the blast radius of a leaked URL. Image uploads are typically fast (seconds to a few minutes) so a 5-minute window is sufficient. Media uploads for large video files may take 10–30 minutes, so a 1-hour window is appropriate.

## Affected Files

- `platform/apps/api/src/storage/` — presign URL generation helpers
- Any route handlers that call the presign functions

## Verification

Inspect the generated presigned URLs in API responses and confirm the expiry embedded in the URL (or the `Expires` header) matches the expected values for each purpose.
