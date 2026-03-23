-- Migration Baseline Squash — 2026-03-23
--
-- Run this ONCE on each deployed database (demo, prod) BEFORE deploying
-- the squashed migration code. This tells Drizzle's migration runner
-- that the baseline has already been applied.
--
-- Usage:
--   psql -h <host> -U <user> -d <db> -f scripts/squash-baseline.sql
--
-- What this does:
--   1. Clears old migration tracking entries (25 rows → 0)
--   2. Inserts a single entry for the new baseline migration
--   3. On next deploy, db:migrate sees the baseline is "already applied" and skips it
--
-- Safe to run multiple times (DELETE + INSERT is idempotent for this purpose).
-- If you accidentally deploy WITHOUT running this first, PostgreSQL will throw
-- "relation already exists" and roll back — no data loss, just a failed deploy.
-- Recovery: run this script, then re-deploy.

BEGIN;

DELETE FROM drizzle.__drizzle_migrations;

INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
VALUES (
  '31de8ded56afae213f2f4044f1da34ddde46973b9bc47df66d6b50f2b4e172de',
  1774224016964
);

-- Verify
SELECT id, LEFT(hash, 16) || '...' AS hash_prefix, created_at
FROM drizzle.__drizzle_migrations;

COMMIT;
