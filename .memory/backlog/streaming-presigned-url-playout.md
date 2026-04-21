---
tags: [streaming]
release_binding: null
created: 2026-04-21
---

# Presigned URL Playout

Replace `s3://` URIs + AWS CLI with presigned HTTPS URLs + a custom `process:` protocol (curl) in Liquidsoap. This eliminates the AWS CLI dependency from the Liquidsoap image and removes credential passthrough to the player process. Requires a playlist refresh job (pg-boss cron) to handle URL expiry before the presigned window closes.

Design brief at `design/presigned-url-playout.md`. Only revisit if AWS CLI in the Liquidsoap image becomes a problem.
