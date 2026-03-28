import { pgTable, text, timestamp, index, integer } from "drizzle-orm/pg-core";

import type { ProcessingJobType, ProcessingJobStatus } from "@snc/shared";

import { content } from "./content.schema.js";

// ── Processing Jobs ──

export const processingJobs = pgTable(
  "processing_jobs",
  {
    id: text("id").primaryKey(),
    contentId: text("content_id")
      .notNull()
      .references(() => content.id, { onDelete: "cascade" }),
    type: text("type").$type<ProcessingJobType>().notNull(),
    status: text("status").$type<ProcessingJobStatus>().notNull().default("queued"),
    progress: integer("progress"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("processing_jobs_content_idx").on(table.contentId),
    index("processing_jobs_status_idx").on(table.status),
    index("processing_jobs_type_status_idx").on(table.type, table.status),
  ],
);
