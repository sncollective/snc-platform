import { z } from "zod";

// ── Probe Result ──

export const ProbeResultSchema = z.object({
  videoCodec: z.string().nullable(),
  audioCodec: z.string().nullable(),
  subtitleCodec: z.string().nullable(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  duration: z.number().nullable(),
  bitrate: z.number().int().nullable(),
});

export type ProbeResult = z.infer<typeof ProbeResultSchema>;

// ── Processing Job Response ──

export const ProcessingJobResponseSchema = z.object({
  id: z.string(),
  contentId: z.string(),
  type: z.string(),
  status: z.string(),
  progress: z.number().int().nullable(),
  error: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
});

export type ProcessingJobResponse = z.infer<typeof ProcessingJobResponseSchema>;

// ── Codecs that need transcoding ──

/** Codecs that are NOT universally browser-compatible and require transcoding to H.264. */
export const TRANSCODE_REQUIRED_VIDEO_CODECS = [
  "hevc", "h265",
  "prores",
  "vp9",
  "av1",
  "mpeg2video",
  "mpeg4",
  "wmv3", "vc1",
] as const;

/** Check if a video codec requires transcoding for universal browser playback. */
export const requiresTranscode = (videoCodec: string | null): boolean => {
  if (!videoCodec) return false;
  const normalized = videoCodec.toLowerCase();
  return (TRANSCODE_REQUIRED_VIDEO_CODECS as readonly string[]).includes(normalized);
};
