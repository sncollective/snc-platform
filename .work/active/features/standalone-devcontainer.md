---
id: standalone-devcontainer
kind: feature
stage: implementing
tags: [developer-experience]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-06-11
parent: null
updated: 2026-06-11
---

# Standalone devcontainer — platform owns its own dev environment

## Brief

A standalone clone of this repo should boot a complete dev environment from nothing:
open in the devcontainer, services come up, `pm2 status` shows api + web running. Today
the repo has no `.devcontainer/`, no in-repo service-bootstrap entry point, no pre-commit
config, and no agent permission guardrails — the README documents manual setup
(bun install, Docker, optional Caddy) but nothing automates it. The substrate
(`.work/`, `.research/`, `.memory/`, rules, skills, lint scripts) is already fully
self-contained; this feature closes the remaining infrastructure gap.

Four deliverables:

1. **`.devcontainer/devcontainer.json`** — Python 3.12 base (lint scripts + pre-commit)
   with Node 24 + docker-in-docker features; installs ffmpeg, caddy, PM2, bun, playwright
   chromium; mounts `~/.claude-devcontainer/{.claude.json,.claude}` for Claude Code auth;
   forwards the platform port set (3000 API, 3001 web, 3002 staging, 3080/3082 Caddy,
   1935/1936 SRS RTMP, 3900 Garage, 8025 Mailpit, 8081 imgproxy, 8888 Liquidsoap harbor).
2. **Dev bootstrap scripts in `scripts/dev/`** — service startup (Caddy + docker compose
   stack + PM2 with the liquidsoap cold-boot stub), `.env` scaffolding from `.env.example`
   with fresh `BETTER_AUTH_SECRET`, idempotent Garage init (layout/bucket/key), playout
   content seeding + playlist generation + live-fallback test helpers. All paths
   repo-relative (resolve from `$BASH_SOURCE`), no absolute workspace paths. The
   `claude-net` overlay network stays optional: detected → compose with the
   `docker-compose.claude.yml` overlay; absent → standalone compose.
3. **`.pre-commit-config.yaml`** — gitleaks, `scripts/check-doc-links.py --files` on
   staged markdown, baseline hooks (trailing-whitespace, end-of-file-fixer, check-yaml,
   check-json). Installed by the devcontainer postCreate.
4. **`.claude/settings.json`** — project-scoped permission guardrails: deny reads of
   `.env*`, `*.pem`, `*.key`, secrets dirs; deny `curl`/`wget` (WebFetch instead);
   deny docker-compose file edits without review. Deny rules survive auto-accept mode;
   other agents honor them voluntarily.

## Design decisions

- **Script home is `scripts/dev/`, lifecycle names unchanged** (`start-dev.sh`,
  `ensure-env.sh`, `init-garage.sh`, plus the playout helpers): `scripts/` stays the
  substrate-lint home; `dev/` is the environment-bootstrap namespace. Stable names keep
  any external caller a pure path swap.
- **Path resolution is `BASH_SOURCE`-relative everywhere**: `REPO_ROOT="$(cd "$(dirname
  "${BASH_SOURCE[0]}")/../.." && pwd)"` — no absolute workspace paths, no CWD
  assumptions. The repo may be mounted at any `/workspaces/<name>`.
- **Devcontainer base mirrors the proven shape**: `python:3.12` image + `node:1`
  (v24) + `docker-in-docker:2` features. Python is load-bearing (pre-commit,
  `scripts/check-doc-links.py`, `scripts/scan-memory.py`); Node/Bun layer on top.
- **No child stories**: single-stride implementation (~6 new files, ports + config),
  tight cohesion, no parallelization payoff.
- **`generate-playout-playlist.sh` ports as-is** including its `aws` CLI dependency
  (start-dev already treats it as best-effort with a skip message); replacing the
  listing with the node SDK is a follow-up, not part of this port.

## Strategic decisions

- **Bootstrap is repo-owned**: every script the devcontainer lifecycle calls lives under
  `scripts/dev/` in this repo — a standalone clone needs no external orchestration.
- **`claude-net` stays graceful-optional**: the external overlay network is detected at
  startup, never required — `docker-compose.claude.yml` remains a compose overlay applied
  only when the network exists.
- **Port surface is platform-only**: no IDE-hosting or sibling-project ports; just the
  service set above.
- **Pre-commit + guardrails mirror the substrate's self-containment**: the repo enforces
  its own hygiene (secrets, doc links) and agent safety locally, with no assumption about
  where it's cloned.

## Architectural choice

One option was a compose-based devcontainer (`dockerComposeFile` in devcontainer.json,
services as siblings of the dev container). Rejected: the service stack is already
orchestrated by `start-dev.sh` via docker-in-docker with the `--wait` health barrier and
conditional `claude-net` overlay — moving orchestration into the devcontainer spec would
fork that logic and lose the "re-run start-dev.sh anytime" recovery path. Chosen: image +
features devcontainer that delegates all service lifecycle to `scripts/dev/start-dev.sh`
(single source of truth for boot, identical inside and outside the container).

## Implementation Units

### Unit 1: `scripts/dev/` bootstrap scripts (trickiest — path portability)

**Files**: `scripts/dev/{start-dev.sh, ensure-env.sh, init-garage.sh,
generate-playout-playlist.sh, seed-playout-content.sh, test-live-fallback.sh,
squash-baseline.sql}`

Common header for every shell script:

```bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
```

Per-script behavior (all existing behavior preserved):

- **`start-dev.sh`** — caddy via `$REPO_ROOT/Caddyfile.dev`; wait for dockerd (30s);
  write liquidsoap cold-boot stub to `$REPO_ROOT/liquidsoap/playout.liq` if absent;
  `cd "$REPO_ROOT"`; compose up with `docker-compose.claude.yml` overlay iff
  `docker network inspect claude-net` succeeds, else standalone; `init-garage.sh`;
  best-effort playlist generation; `pm2 start "$REPO_ROOT/ecosystem.config.cjs"`.
- **`ensure-env.sh`** — `cd "$REPO_ROOT"`; first run copies `.env.example → .env` and
  mints `BETTER_AUTH_SECRET` via `openssl rand -base64 32`; rebuilds append missing
  `KEY=` lines, never overwrite existing values.
- **`init-garage.sh`** — unchanged logic (docker-exec based, idempotent, deterministic
  dev credentials); replace its run-from-repo-dir assumption (`.env`, `apps/api`
  relative reads) with `$REPO_ROOT`-anchored paths so it works from any CWD.
- **`generate-playout-playlist.sh`** — output to `$REPO_ROOT/liquidsoap/playlist.m3u`
  (gitignored); creds via dotenv from `$REPO_ROOT/.env`; `aws` CLI listing kept as-is.
- **`seed-playout-content.sh`** — `PLATFORM_DIR` → `$REPO_ROOT`; ffmpeg test clips +
  node-SDK upload unchanged.
- **`test-live-fallback.sh`** — no paths; copy verbatim.
- **`squash-baseline.sql`** — copy verbatim; fix its usage comment to the new path.

**Acceptance Criteria**:
- [ ] `bash -n` passes on all five scripts; no string `/workspaces/` anywhere in `scripts/dev/`
- [ ] `grep -rn "workspaces/" scripts/dev/` is empty
- [ ] `ensure-env.sh` run twice against a temp `.env.example` copy: creates then no-ops
- [ ] `start-dev.sh` runs to completion in the current environment (services healthy, pm2 up) when invoked by absolute path from an arbitrary CWD outside the repo

### Unit 2: `.devcontainer/devcontainer.json`

Image `mcr.microsoft.com/devcontainers/python:3.12`; features `node:1` (v24),
`docker-in-docker:2` (moby false). Mounts: `${localEnv:HOME}/.claude-devcontainer/.claude.json`
and `.claude` → `/home/vscode/`. Lifecycle:

- `onCreateCommand`: iptables-nft switch + dockerd restart dance (required for
  docker-in-docker on container rebuild).
- `postCreateCommand`: apt ffmpeg + caddy; `npm i -g pm2 bun@1.3.12`; `bun install`;
  `bash scripts/dev/ensure-env.sh`; `(cd apps/e2e && bunx playwright install --with-deps
  chromium)`; `pip install --user pre-commit && python3 -m pre_commit install`.
- `postStartCommand`: `bash scripts/dev/start-dev.sh`.

Ports + labels: 3000 API, 3001 Web, 3002 Web (Staging), 3080/3082 Caddy dev/staging,
1935/1936 SRS RTMP, 3900 Garage (ignore), 8025 Mailpit, 8081 imgproxy (ignore),
8888 Liquidsoap harbor (ignore). Extensions: prettier, eslint, python, docker,
gitlens, errorlens, claude-code. `remoteUser: vscode`.

**Acceptance Criteria**:
- [ ] Valid JSON (`python3 -m json.tool`)
- [ ] No absolute workspace paths — lifecycle commands rely on workspace-root CWD
- [ ] Port list contains exactly the platform service set above

### Unit 3: `.pre-commit-config.yaml`

gitleaks; local hook `check-doc-links` running `python3 scripts/check-doc-links.py
--files` on staged markdown; baseline hooks (trailing-whitespace, end-of-file-fixer,
check-yaml, check-json). Installed by Unit 2's postCreate.

**Acceptance Criteria**:
- [ ] `pre-commit run --all-files` passes on the current tree (or surfaced violations are fixed in this stride)

### Unit 4: `.claude/settings.json`

Permission guardrails: deny Read on `.env*`, `**/*.pem`, `**/*.key`, `secrets/**`,
`credentials/**`; deny Bash `curl *` and `wget *`; deny destructive git
(`push --force*`, `reset --hard*`, `clean -fd*`, `branch -D*`) and `sudo *`.
Attribution empty (commits attributed to the human author from git config).

**Acceptance Criteria**:
- [ ] Valid JSON; deny rules cover the secret-file and outbound-HTTP classes
- [ ] No allow-rules that would loosen anything beyond current behavior

### Unit 5: Docs touch

- `README.md` §Getting Started: lead with "open in the devcontainer — everything below
  is automated"; keep the manual path.
- `AGENTS.md` / `CLAUDE.md`: name `scripts/dev/start-dev.sh` as the service entry point
  and `.devcontainer/` as the environment definition.

**Acceptance Criteria**:
- [ ] `python3 scripts/check-doc-links.py` clean

## Implementation Order

1. Unit 1 (scripts — everything else points at them)
2. Unit 2 (devcontainer referencing the scripts)
3. Units 3 + 4 (independent config)
4. Unit 5 (docs last, describing what now exists)

## Testing

Config-and-scripts feature — no unit-test surface. Verification is mechanical checks per
unit (bash -n, JSON/YAML validity, link check) plus one live `start-dev.sh` cycle from an
arbitrary CWD (compose stack healthy, Garage initialized, pm2 api+web online). Full
cold-boot verification (fresh container build from this repo alone) requires a container
rebuild and is a user-at-station acceptance step — tracked in Risks.

## Risks

- **Cold-boot devcontainer build is not verifiable in-session** (can't rebuild the
  container we're running in). Mitigation: every lifecycle command is independently
  exercised in-session; final sign-off is one manual "Reopen in Container" by the
  operator. Tagged acceptance: manual.
- **`generate-playout-playlist.sh` depends on the `aws` CLI**, which the devcontainer
  does not install — already best-effort today (start-dev skips with a message). Park a
  follow-up to port the listing to the node SDK if playlist bootstrap should be turnkey.
- **`bun@1.3.12` pin in postCreate** will drift; acceptable — same pin strategy as the
  engines field, bumped deliberately.
