-- Custom SQL migration file, put your code below! --
-- Backfill channels.ownership / channels.role from the legacy channels.type enum.
-- Part of unified-channel-model expand-migrate-contract (expand step). `type` stays
-- authoritative until the migrate step cuts consumers over.
--   playout   -> platform / playout
--   broadcast -> platform / broadcast
--   live      -> creator  / live-ingest  (the airing-state conflation; identity is live-ingest)
--   scheduled -> platform / playout      (dead enum value; none expected, mapped defensively)

UPDATE "channels" SET "ownership" = 'platform', "role" = 'playout'     WHERE "type" = 'playout';--> statement-breakpoint
UPDATE "channels" SET "ownership" = 'platform', "role" = 'broadcast'   WHERE "type" = 'broadcast';--> statement-breakpoint
UPDATE "channels" SET "ownership" = 'creator',  "role" = 'live-ingest' WHERE "type" = 'live';--> statement-breakpoint
UPDATE "channels" SET "ownership" = 'platform', "role" = 'playout'     WHERE "type" = 'scheduled';