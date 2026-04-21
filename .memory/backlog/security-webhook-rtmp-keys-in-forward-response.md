---
tags: [security, streaming]
release_binding: null
created: 2026-04-20
---

# Webhook: Third-Party RTMP Keys Returned in on_forward Callback Response

`streaming.routes.ts:354-380` — Simulcast URLs containing third-party stream keys (e.g. Twitch, YouTube ingest URLs with embedded secrets) are included in the body returned to SRS's `on_forward` callback. These keys are returned in plaintext in the response payload.

Current mitigations reduce practical exploitability:
- `verifySrsCallback` enforces HMAC timing-safe callback authentication (as of 2026-03-31), so external callers cannot trigger this endpoint.
- The rate limiter provides a secondary barrier.

Residual risk: if the callback auth layer is bypassed or the secret is leaked, the `on_forward` response exposes third-party stream keys that creators have configured for simulcast. Additionally, these keys may be appearing in API audit logs (structured log lines that include the full callback response body), where they could be readable to anyone with log access.

Recommended investigation:
1. Audit whether `on_forward` response bodies are logged. If so, mask the `urls` field before logging (replace stream keys with `***`).
2. Consider whether the full simulcast URL needs to be in the in-memory response, or whether a lookup-by-id pattern could avoid transmitting keys in transit.

Tag `streaming` because the fix is in the streaming routes; `security` because the concern is third-party credential exposure.
