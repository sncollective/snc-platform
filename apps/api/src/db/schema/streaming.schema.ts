import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
  integer,
  boolean,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { creatorProfiles } from "./creator.schema.js";

// ── Simulcast Destinations ──

export const simulcastDestinations = pgTable(
  "simulcast_destinations",
  {
    id: text("id").primaryKey(),
    platform: text("platform").notNull(), // "twitch" | "youtube" | "custom"
    label: text("label").notNull(),
    rtmpUrl: text("rtmp_url").notNull(),
    streamKey: text("stream_key").notNull(),
    isActive: boolean("is_active").notNull().default(false),
    creatorId: text("creator_id").references(() => creatorProfiles.id, {
      onDelete: "cascade",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("simulcast_destinations_active_idx").on(table.isActive),
    index("simulcast_destinations_creator_active_idx").on(
      table.creatorId,
      table.isActive,
    ),
  ],
);

// ── Stream Keys ──

export const streamKeys = pgTable(
  "stream_keys",
  {
    id: text("id").primaryKey(),
    creatorId: text("creator_id")
      .notNull()
      .references(() => creatorProfiles.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    keyHash: text("key_hash").notNull(),
    keyPrefix: text("key_prefix").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    index("stream_keys_creator_idx").on(table.creatorId),
    index("stream_keys_hash_idx").on(table.keyHash),
  ],
);

// ── Stream Sessions ──

export const streamSessions = pgTable(
  "stream_sessions",
  {
    id: text("id").primaryKey(),
    creatorId: text("creator_id")
      .notNull()
      .references(() => creatorProfiles.id, { onDelete: "cascade" }),
    streamKeyId: text("stream_key_id")
      .notNull()
      .references(() => streamKeys.id, { onDelete: "set null" }),
    srsClientId: text("srs_client_id").notNull(),
    srsStreamName: text("srs_stream_name").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    peakViewers: integer("peak_viewers").notNull().default(0),
  },
  (table) => [
    index("stream_sessions_creator_idx").on(table.creatorId),
    index("stream_sessions_active_idx").on(table.endedAt),
    index("stream_sessions_srs_client_idx").on(table.srsClientId),
  ],
);

// ── Stream Events ──

export const streamEvents = pgTable(
  "stream_events",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").references(() => streamSessions.id, {
      onDelete: "set null",
    }),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("stream_events_session_idx").on(table.sessionId),
    index("stream_events_type_idx").on(table.eventType),
  ],
);

// ── Channels ──

export const channels = pgTable(
  "channels",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    type: text("type").notNull(), // "playout" | "live" | "scheduled" | "broadcast"
    thumbnailUrl: text("thumbnail_url"),
    srsStreamName: text("srs_stream_name").notNull(),
    creatorId: text("creator_id").references(() => creatorProfiles.id, {
      onDelete: "set null",
    }),
    streamSessionId: text("stream_session_id").references(
      () => streamSessions.id,
      { onDelete: "set null" },
    ),
    defaultPlayoutChannelId: text("default_playout_channel_id"),
    isActive: boolean("is_active").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("channels_srs_stream_name_idx").on(table.srsStreamName),
    index("channels_type_active_idx").on(table.type, table.isActive),
    index("channels_creator_idx").on(table.creatorId),
  ],
);
