UPDATE content
SET thumbnail_key = cover_art_key
WHERE cover_art_key IS NOT NULL AND thumbnail_key IS NULL;--> statement-breakpoint
