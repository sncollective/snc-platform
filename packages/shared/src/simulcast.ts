import { z } from "zod";

// ── Platform Registry ──

export const SIMULCAST_PLATFORMS = {
  twitch: { label: "Twitch", rtmpPrefix: "rtmp://live.twitch.tv/app" },
  youtube: { label: "YouTube", rtmpPrefix: "rtmp://a.rtmp.youtube.com/live2" },
  custom: { label: "Custom", rtmpPrefix: null },
} as const satisfies Record<string, { label: string; rtmpPrefix: string | null }>;

export type SimulcastPlatform = keyof typeof SIMULCAST_PLATFORMS;

export const SIMULCAST_PLATFORM_KEYS = Object.keys(SIMULCAST_PLATFORMS) as [
  SimulcastPlatform,
  ...SimulcastPlatform[],
];

// ── API Schemas ──

export const SimulcastDestinationSchema = z.object({
  id: z.string(),
  platform: z.enum(SIMULCAST_PLATFORM_KEYS),
  label: z.string(),
  rtmpUrl: z.string(),
  streamKeyPrefix: z.string(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type SimulcastDestination = z.infer<typeof SimulcastDestinationSchema>;

export const SimulcastDestinationListResponseSchema = z.object({
  destinations: z.array(SimulcastDestinationSchema),
});

export type SimulcastDestinationListResponse = z.infer<
  typeof SimulcastDestinationListResponseSchema
>;

export const CreateSimulcastDestinationSchema = z.object({
  platform: z.enum(SIMULCAST_PLATFORM_KEYS),
  label: z.string().min(1).max(100),
  rtmpUrl: z.string().url().min(1),
  streamKey: z.string().min(1).max(500),
});

export type CreateSimulcastDestination = z.infer<typeof CreateSimulcastDestinationSchema>;

export const UpdateSimulcastDestinationSchema = z.object({
  platform: z.enum(SIMULCAST_PLATFORM_KEYS).optional(),
  label: z.string().min(1).max(100).optional(),
  rtmpUrl: z.string().url().min(1).optional(),
  streamKey: z.string().min(1).max(500).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateSimulcastDestination = z.infer<typeof UpdateSimulcastDestinationSchema>;
