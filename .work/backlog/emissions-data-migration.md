---
tags: [emissions]
release_binding: null
created: 2026-04-20
---

# Emissions Data Migration

Migrate historical emissions data from the JSON flat-file format into the platform database.

Read `docs/emissions/data/2026.json` (and future year files). Write a migration script that parses the JSON and inserts records via POST to `/api/emissions/entries` or direct DB insert via Drizzle. Verify row counts and spot-check values post-import. Leave source files in place until the Phase 5 deprecation step.
