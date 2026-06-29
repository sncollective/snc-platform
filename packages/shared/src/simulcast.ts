import { z } from "zod";

// ── Validation Constants ──

/** Matches rtmp:// or rtmps:// URLs with at least a host component after the scheme. */
export const RTMP_URL_REGEX = /^rtmps?:\/\/.+/;

const ALLOWED_RTMP_PORTS = new Set(["", "1935", "443"]);
const BUILT_IN_SIMULCAST_DOMAINS = {
  twitch: ["twitch.tv"],
  youtube: ["youtube.com"],
} as const;

const normalizeHost = (host: string): string =>
  host.toLowerCase().replace(/^\[/, "").replace(/\]$/, "").replace(/\.$/, "");

const isIPv4PrivateOrInternal = (host: string): boolean => {
  const parts = host.split(".");
  if (parts.length !== 4) return false;
  const octets = parts.map((part) => Number(part));
  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return false;
  }

  const a = octets[0]!;
  const b = octets[1]!;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
};

const isIPv6PrivateOrInternal = (host: string): boolean => {
  if (!host.includes(":")) return false;
  if (host === "::" || host === "::1") return true;
  if (host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe8") || host.startsWith("fe9") || host.startsWith("fea") || host.startsWith("feb")) {
    return true;
  }
  const embeddedIPv4 = host.match(/(?:^|:)(\d{1,3}(?:\.\d{1,3}){3})$/)?.[1];
  return embeddedIPv4 ? isIPv4PrivateOrInternal(embeddedIPv4) : false;
};

const isInternalHostname = (host: string): boolean =>
  host === "localhost" ||
  host.endsWith(".localhost") ||
  host.endsWith(".local") ||
  host.endsWith(".internal") ||
  (!host.includes(".") && !host.includes(":"));

const isHostInDomain = (host: string, domain: string): boolean =>
  host === domain || host.endsWith(`.${domain}`);

/** True when a destination URL is safe for server-side RTMP forwarding. */
export const isAllowedSimulcastRtmpUrl = (
  rawUrl: string,
  platform?: SimulcastPlatform,
): boolean => {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }

  if (url.protocol !== "rtmp:" && url.protocol !== "rtmps:") return false;
  if (!ALLOWED_RTMP_PORTS.has(url.port)) return false;

  const host = normalizeHost(url.hostname);
  if (!host) return false;
  if (isInternalHostname(host) || isIPv4PrivateOrInternal(host) || isIPv6PrivateOrInternal(host)) {
    return false;
  }

  const allowedDomains =
    platform === "twitch" || platform === "youtube"
      ? BUILT_IN_SIMULCAST_DOMAINS[platform]
      : undefined;
  if (allowedDomains && !allowedDomains.some((domain) => isHostInDomain(host, domain))) {
    return false;
  }

  return true;
};

// ── Platform Registry ──

/**
 * Supported simulcast targets and their RTMP ingest prefixes.
 *
 * A `null` `rtmpPrefix` (e.g. `custom`) means no built-in endpoint — the user
 * supplies the full RTMP URL.
 */
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

/** Maximum simulcast destinations a single creator can configure. */
export const MAX_CREATOR_SIMULCAST_DESTINATIONS = 5;

// ── API Schemas ──

export const SimulcastDestinationSchema = z.object({
  id: z.string(),
  platform: z.enum(SIMULCAST_PLATFORM_KEYS),
  label: z.string(),
  rtmpUrl: z.string(),
  streamKeyPrefix: z.string(),
  isActive: z.boolean(),
  creatorId: z.string().nullable(),
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

const SimulcastRtmpUrlSchema = z
  .string()
  .url()
  .regex(RTMP_URL_REGEX, "Must be an rtmp:// or rtmps:// URL")
  .refine((url) => isAllowedSimulcastRtmpUrl(url), {
    message: "RTMP destination must use a public host and port 1935 or 443",
  });

export const CreateSimulcastDestinationSchema = z
  .object({
    platform: z.enum(SIMULCAST_PLATFORM_KEYS),
    label: z.string().min(1).max(100),
    rtmpUrl: SimulcastRtmpUrlSchema,
    streamKey: z.string().min(1).max(500),
  })
  .superRefine((value, ctx) => {
    if (!isAllowedSimulcastRtmpUrl(value.rtmpUrl, value.platform)) {
      ctx.addIssue({
        code: "custom",
        path: ["rtmpUrl"],
        message: "Built-in simulcast platforms must use their approved RTMP ingest domain",
      });
    }
  });

export type CreateSimulcastDestination = z.infer<typeof CreateSimulcastDestinationSchema>;

export const UpdateSimulcastDestinationSchema = z
  .object({
    platform: z.enum(SIMULCAST_PLATFORM_KEYS).optional(),
    label: z.string().min(1).max(100).optional(),
    rtmpUrl: SimulcastRtmpUrlSchema.optional(),
    streamKey: z.string().min(1).max(500).optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.rtmpUrl !== undefined &&
      value.platform !== undefined &&
      !isAllowedSimulcastRtmpUrl(value.rtmpUrl, value.platform)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["rtmpUrl"],
        message: "Built-in simulcast platforms must use their approved RTMP ingest domain",
      });
    }
  });

export type UpdateSimulcastDestination = z.infer<typeof UpdateSimulcastDestinationSchema>;
