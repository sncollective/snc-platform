---
id: story-fix-garage-key-probe-fatal
kind: story
stage: review
tags: [bug, developer-experience]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-06-11
updated: 2026-06-11
---

# Devcontainer cold boot dies silently when the Garage key-info probe blips

## Symptom

`postStartCommand` (`scripts/dev/start-dev.sh`) fails intermittently on devcontainer
cold boot with exit code 1 and no error output. Boot log ends at
`Layout already configured (version 1)`; nothing after — no key/bucket/CORS messages,
no PM2 start. Re-running the script by hand later succeeds. Surfaced during the
user-at-station cold-boot acceptance of the standalone-devcontainer feature.

## Root cause

`scripts/dev/init-garage.sh` probes for the deterministic dev keys with

```bash
existing_id=$($GARAGE key info "$KEY_NAME" 2>/dev/null | awk '/^Key ID:/ {print $3; exit}')
```

(line 64 for `snc-dev-key`, same shape at line 145 for `imgproxy-reader`). The script
runs under `set -euo pipefail`. Every `garage` CLI invocation opens a fresh RPC
handshake to the daemon (port 3901); right after a cold Garage start that handshake
can transiently fail even though `stats` / `layout show` succeeded moments earlier.
When it does, the pipeline goes non-zero, the assignment fails, and `set -e` kills
the whole script — silently, because the probe's stderr is sent to `/dev/null`. The
probe is purely informational (an empty result already routes to the key-import
branch), so its failure must never be fatal, and certainly not silent.

## Fix approach

Extract both probes into one `probe_key_id()` helper that:

- captures `garage key info` output into a variable first and parses with `awk`
  from the variable (no pipeline → no pipefail kill; also removes the awk
  early-`exit` SIGPIPE surface on the docker-exec stream);
- retries briefly (3 × 1s) so a cold-boot RPC blip doesn't misread an existing key
  as missing;
- returns 0 with empty output when the key genuinely isn't there — the existing
  import branch handles that case, and a *real* persistent Garage failure then
  surfaces loudly in the unsilenced import/allow commands instead of dying mute.

Minimal scope: only the two probe sites change; import/delete/allow logic untouched.

## Regression test

No shell-test surface in this repo (per the standalone-devcontainer feature's
testing posture: mechanical verification only). Closest approximation, recorded
here and run in-session:

- **Repro harness (pre-fix):** `set -euo pipefail; GARAGE=false;
  existing_id=$($GARAGE key info … | awk …); echo "never reached"` → exits 1
  printing nothing after the layout line, byte-matching the boot log.
- **Post-fix harness:** the `probe_key_id` function extracted from the script and
  run with `GARAGE=false` under `set -euo pipefail` → returns empty, script
  continues to the import branch instead of dying.
- Plus `bash -n`, a clean `bash scripts/dev/init-garage.sh` end-to-end run, and a
  full `bash scripts/dev/start-dev.sh` cycle.

## Implementation notes

- Files changed: `scripts/dev/init-garage.sh` — both key-info probes replaced by one
  `probe_key_id()` helper (capture-then-parse, 3×1s retry, non-fatal empty-on-missing);
  nothing else touched.
- Test added: none committable (no shell-test surface) — pre/post harnesses run
  in-session as documented under §Regression test; post-fix harness sources
  `probe_key_id` from the script and confirms a failing `$GARAGE` degrades to the
  import branch instead of killing the script.
- Verification: `bash -n` clean; `bash scripts/dev/init-garage.sh` exit 0 with all
  idempotent branches taken; full `bash scripts/dev/start-dev.sh` cycle ran to
  completion (PM2 api/web/web-staging online, API `/health` → `{"status":"ok"}`).
  True cold-boot re-verification (fresh devcontainer "Reopen in Container") remains
  the user-at-station confirmation step, per the fix-verify loopback convention.
- Adjacent issues parked: none.
