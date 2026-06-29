import { z } from "zod";

import { DprImageSchema, ResponsiveImageSchema } from "./content.js";
import { PRIVACY_POLICY_VERSION } from "./consent.js";

// ── Join Config ──

/** Per-creator join-page configuration (the editable surface). */
export const JoinConfigSchema = z.object({
  incentiveText: z.string().nullable(),
  showSncExplainer: z.boolean(),
  showSubscribeCta: z.boolean(),
});
export type JoinConfig = z.infer<typeof JoinConfigSchema>;

/** Patch shape for updating a creator's join config (all fields optional). */
export const JoinConfigPatchSchema = z.object({
  incentiveText: z.string().nullable().optional(),
  showSncExplainer: z.boolean().optional(),
  showSubscribeCta: z.boolean().optional(),
});
export type JoinConfigPatch = z.infer<typeof JoinConfigPatchSchema>;

// ── Join Page Payload ──

/** A subscription plan as shown publicly on the join page. */
export const PublicPlanSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number().int(), // cents
  interval: z.string(), // "month" | "year"
});
export type PublicPlan = z.infer<typeof PublicPlanSchema>;

/** Everything the public join page needs in one fetch. */
export const JoinPagePayloadSchema = z.object({
  creator: z.object({
    id: z.string(),
    handle: z.string().nullable(),
    displayName: z.string(),
    avatar: DprImageSchema.nullable(),
    banner: ResponsiveImageSchema.nullable(),
  }),
  config: JoinConfigSchema,
  followerCount: z.number().int().min(0),
  creatorPlans: z.array(PublicPlanSchema),
  sncPlans: z.array(PublicPlanSchema),
});
export type JoinPagePayload = z.infer<typeof JoinPagePayloadSchema>;

/** Body for completing a join (consent must be explicit). */
export const CompleteJoinRequestSchema = z.object({
  consent: z.literal(true),
  policyVersion: z.literal(PRIVACY_POLICY_VERSION),
});
export type CompleteJoinRequest = z.infer<typeof CompleteJoinRequestSchema>;

/** Default join config when no row exists. */
export const DEFAULT_JOIN_CONFIG: JoinConfig = {
  incentiveText: null,
  showSncExplainer: true,
  showSubscribeCta: true,
};
