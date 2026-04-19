---
tags: [deploy]
release_binding: null
created: 2026-04-18
---

# systemd graceful exit

`systemctl restart snc-api` hangs. Investigate SIGTERM handling, pg-boss shutdown, and `TimeoutStopSec` in the unit file.

Migrated from `boards/platform/release-0.2.1/BOARD.md` Backlog lane (2026-04-18).
