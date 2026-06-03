---
tags: [refactor]
release_binding: null
created: 2026-04-20
updated: 2026-04-21
---

# Scan i18n Rule Library

Create a `scan-i18n` rule library under the refactor-scan family. Covers hardcoded user-facing strings, missing locale-aware date/number formatting, string concatenation instead of message templates, and missing lang attributes. Follow the `create-scan-*` pattern used by existing scan libraries (see [scan-design-system-rule-library.md](scan-design-system-rule-library.md) for a sibling).
