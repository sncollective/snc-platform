import { z } from "zod";

// ── Public Schemas ──

export const StreamStatusSchema = z.object({
  isLive: z.boolean(),
  viewerCount: z.number().int().min(0),
  lastLiveAt: z.string().datetime().nullable(),
  hlsUrl: z.string().url().nullable(),
});

// ── Public Types ──

export type StreamStatus = z.infer<typeof StreamStatusSchema>;
