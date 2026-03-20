import { z } from "zod";

export const STUDIO_SERVICES = [
  "recording",
  "podcast",
  "practice-space",
  "venue-hire",
] as const;

export type StudioService = (typeof STUDIO_SERVICES)[number];

export const STUDIO_SERVICE_LABELS: Record<StudioService, string> = {
  recording: "Recording",
  podcast: "Podcast Production",
  "practice-space": "Practice Space",
  "venue-hire": "Venue Hire",
};

export const StudioInquirySchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(254),
  service: z.enum(STUDIO_SERVICES),
  message: z.string().min(10).max(2000),
});

export type StudioInquiry = z.infer<typeof StudioInquirySchema>;

export const StudioInquiryResponseSchema = z.object({
  success: z.literal(true),
});
