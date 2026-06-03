---
tags: [documentation]
release_binding: null
created: 2026-04-20
---

# Logging Conventions — Add Pino Section to CLAUDE.md

Pino is used across 23+ files with structured JSON logging, request-scoped child loggers (`c.var.logger` vs `rootLogger`), header redaction, and audit logging for admin actions. No mention exists in CLAUDE.md coding conventions.

Add a Logging section covering: when to use which logger, what to log, and redaction rules.

Originated 2026-03-24. Target audience: developers reviewing agent work or contributing manually.
