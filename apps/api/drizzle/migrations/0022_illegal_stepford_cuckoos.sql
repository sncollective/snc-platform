-- Custom SQL migration file, put your code below! --
UPDATE content
SET slug = LOWER(
  REGEXP_REPLACE(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        LEFT(title, 80),
        '[^a-zA-Z0-9\s_-]', '', 'g'
      ),
      '\s+', '-', 'g'
    ),
    '-+', '-', 'g'
  )
)
WHERE slug IS NULL; ----- statement-breakpoint