---
id: standalone-devcontainer
kind: feature
stage: drafting
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
