---
paths:
  - "apps/api/src/db/**"
  - "apps/api/drizzle/**"
---

# Drizzle Migrations

**Never hand-write migration SQL files, `_journal.json` entries, or snapshot JSON files. Always use `drizzle-kit generate`.**

## The Only Valid Workflow

```
1. Edit Drizzle schema files (src/db/schema/*.schema.ts)
2. Run:  bun run --filter @snc/api db:generate
3. Run:  bun run --filter @snc/api db:migrate
```

There is no other path. Do not create `.sql` files by hand. Do not add entries to `_journal.json` by hand. Do not write `INSERT`, `ALTER TABLE`, or any DDL directly.

## Why This Matters

`drizzle-kit generate` does three things you cannot replicate reliably by hand:
- Creates the SQL file with correct Drizzle conventions (statement breakpoints, etc.)
- Adds a `_journal.json` entry with a real `Date.now()` timestamp
- Updates the snapshot JSON that drizzle-kit uses to diff the next migration

Hand-written entries have caused real problems in this repo: fabricated timestamps ended up in the future, causing subsequent `db:generate` runs to produce out-of-order entries that get silently skipped. This is not hypothetical — it happened.

## How to Spot a Hand-Written Migration

If you see any of these, the migration was hand-written and needs to be regenerated:
- **Round timestamps** in `_journal.json` ending in `000000` (e.g., `1774200000000`) — real `Date.now()` values have millisecond noise
- **Descriptive filenames** like `0011_creator_team.sql` — `drizzle-kit` generates random two-word names like `0008_lyrical_albert_cleary.sql`
- **Missing snapshot** in `meta/` — every `db:generate` creates a corresponding `NNNN_snapshot.json`

## Custom SQL (Data Backfills, Manual DDL)

If a migration needs custom SQL that drizzle-kit can't generate from schema changes:

```
bun run --filter @snc/api db:generate --custom
```

This creates a blank `.sql` file with a proper journal entry and snapshot. Fill in the SQL, then run `db:migrate`. Never create the file yourself.

## Rules

1. **One migration per schema change** — don't combine unrelated changes. Run `db:generate` after each logical schema modification.
2. **Never edit `_journal.json` manually** — unless fixing a known timestamp ordering issue (like the one this rule exists because of).
3. **Never fabricate timestamps** — `_journal.json` `when` values must come from `drizzle-kit generate`.
4. **Never skip `db:generate`** — even if you "know what the SQL should be." The snapshot and journal matter as much as the SQL.
