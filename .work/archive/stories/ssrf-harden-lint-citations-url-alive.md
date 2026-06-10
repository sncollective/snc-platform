---
id: ssrf-harden-lint-citations-url-alive
kind: story
stage: done
tags: [security, workflow]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-06-06
updated: 2026-06-06
parent: ard-upgrade-v0-4-1
---

# SSRF-harden `url_alive` in `lint-citations.py`

Re-vendor ARD v0.4.1's SSRF fence into `scripts/lint-citations.py:url_alive()` (currently `scripts/lint-citations.py:104` — a bare `urllib.request.urlopen(HEAD)` with no guards). A hostile or compromised attestation `source_url` can currently aim the linter at the cloud-metadata endpoint (`169.254.169.254`) or internal addresses (SSRF). The fix restricts the liveness probe to public web targets. Verdicts on legitimate public URLs are unchanged; a refused URL reports as the existing low-severity `unreachable-source` warn (no new status code, no behavior change for valid corpora).

## Tasks

- [x] **Scheme allow-list** — `_url_probe_safe` refuses any non-`http(s)` scheme before any network call.
- [x] **Public-IP-only resolution** — `_host_is_public` resolves the host (`socket.getaddrinfo`) and refuses if any resolved IP is loopback / link-local / private / reserved / multicast / unspecified (closes `169.254.169.254` + internal ranges). All resolved addresses must pass.
- [x] **Per-redirect re-validation** — `url_alive` disables urllib auto-redirect (`_NoRedirect`) and re-runs the guard on every hop before connecting (cap `_MAX_REDIRECTS = 5`).
- [x] **Refusal → existing warn** — a refused URL returns `False`, surfacing as the current low-severity `unreachable-source` warn; no new status, no error.
- [x] **Tests** — `scripts/tests/test_lint_citations_url_alive.py` (stdlib `unittest`, zero-dep, offline): scheme refusal, metadata/loopback/private/unspecified refusal, missing-host refusal, public-literal-IP allowed, and `url_alive` short-circuit-without-connect. 11/11 pass.
- [~] **Conformance parity** — end-to-end lint runs clean over `.research/` (28 files, exit 0); public-URL verdicts unchanged. *Note: the upstream 16/16 conformance fixtures are not vendored into platform yet (sibling story #3); machine-checked parity lands with that. The offline guard suite + end-to-end smoke stand in until then.*

## Implementation note

Live happy-path (a real public URL returning 200) and live redirect-following are network/integration cases left out of the offline unit set — they need a local mock server. The security-critical guard is fully covered offline because `getaddrinfo` on a literal IP does not hit DNS. No new third-party test dep introduced (platform had no Python test convention; this establishes a stdlib-`unittest` one under `scripts/tests/`).

## Reference

The canonical hardened `url_alive` is the v0.4.1 reference implementation in ARD's `kernel/lint-citations.py`. Per the project boundary, copy the logic **in** — do not link to or import from root's `ard/`. (Decision: adopt the kernel contract in-tree — `platform-0014`.)

## Risks

- **Over-refusal** — an over-broad IP check could reject legitimate public URLs that happen to resolve through a CDN edge; mirror the upstream allow/deny exactly rather than hand-rolling.
- **DNS-rebinding window** — resolve-then-connect has a TOCTOU gap in principle; the upstream patch's posture (re-validate per hop, refuse non-public) is the accepted fence — match it, don't over-engineer.

## Review result

Passed 2026-06-06 on the automated test evidence (11/11 offline guard suite + clean end-to-end lint smoke over `.research/`, exit 0). **Not release-bound by design** — this is dev/CI lint tooling, not a shipped/deployed artifact, so there is no deploy surface to bind to; `release_binding` stays `null`. Conformance-parity machine check remains pending the in-tree `kernel/` vendor (sibling story #3).

## Revisit if

- Upstream changes the `url_alive` fence again (re-sync from the pinned kernel).
- Platform's lint moves to data-sourcing from a vendored `kernel/` copy (sibling story #4) — at which point this hand-vendored function may instead come straight from the in-tree `kernel/lint-citations.py`; reconcile so the logic isn't carried twice.

Decision records: platform-0014
