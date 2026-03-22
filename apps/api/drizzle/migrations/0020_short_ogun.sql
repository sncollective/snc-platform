-- Backfill NULL handles on creator_profiles from display_name.
-- Generates a slug (lowercase, spaces→hyphens, strip non-alphanumeric),
-- then appends a numeric suffix for duplicates.

WITH slugged AS (
  SELECT
    id,
    left(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(lower(display_name), '\s+', '-', 'g'),
            '[^a-z0-9_-]', '', 'g'
          ),
          '-+', '-', 'g'
        ),
        '^-|-$', '', 'g'
      ),
      30
    ) AS base_handle
  FROM creator_profiles
  WHERE handle IS NULL
),
numbered AS (
  SELECT
    id,
    base_handle,
    row_number() OVER (PARTITION BY base_handle ORDER BY id) AS rn
  FROM slugged
)
UPDATE creator_profiles
SET handle = CASE
  WHEN numbered.rn = 1 AND NOT EXISTS (
    SELECT 1 FROM creator_profiles cp WHERE cp.handle = numbered.base_handle
  ) THEN numbered.base_handle
  ELSE left(numbered.base_handle || '-' || numbered.rn, 30)
END,
updated_at = now()
FROM numbered
WHERE creator_profiles.id = numbered.id;
