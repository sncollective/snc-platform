import { z } from "zod";

// ── Public Constants ──

export const INVITE_TYPES = ["creator_owner", "team_member"] as const;

// ── Public Types ──

export type InviteType = (typeof INVITE_TYPES)[number];

// ── Public Schemas ──

export const InviteTypeSchema = z.enum(INVITE_TYPES);

export const CreateCreatorOwnerInviteSchema = z.object({
  type: z.literal("creator_owner"),
  email: z.string().email(),
  displayName: z.string().min(1).max(100),
});

export const CreateTeamMemberInviteSchema = z.object({
  type: z.literal("team_member"),
  email: z.string().email(),
  creatorId: z.string().min(1),
  role: z.enum(["owner", "editor", "viewer"]),
});

export const CreateInviteSchema = z.discriminatedUnion("type", [
  CreateCreatorOwnerInviteSchema,
  CreateTeamMemberInviteSchema,
]);

export const InviteResponseSchema = z.object({
  id: z.string(),
  type: InviteTypeSchema,
  email: z.string(),
  expiresAt: z.string(),
  createdAt: z.string(),
});

export const ValidateInviteResponseSchema = z.object({
  id: z.string(),
  type: InviteTypeSchema,
  email: z.string(),
  expiresAt: z.string(),
  payload: z.record(z.string(), z.unknown()),
});

// ── Public Types (derived) ──

export type CreateInvite = z.infer<typeof CreateInviteSchema>;
export type InviteResponse = z.infer<typeof InviteResponseSchema>;
export type ValidateInviteResponse = z.infer<typeof ValidateInviteResponseSchema>;
