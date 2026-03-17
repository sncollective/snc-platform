import { z } from "zod";

// ── Public Constants ──

export const ROLES = [
  "stakeholder",
  "admin",
] as const;

// ── Public Schemas ──

export const RoleSchema = z.enum(ROLES);

export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  emailVerified: z.boolean(),
  image: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const SessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  token: z.string(),
  expiresAt: z.iso.datetime(),
});

export const AuthSessionSchema = z.object({
  user: UserSchema,
  session: SessionSchema,
});

// ── Public Types ──

export type Role = z.infer<typeof RoleSchema>;
export type User = z.infer<typeof UserSchema>;
export type Session = z.infer<typeof SessionSchema>;
export type AuthSession = z.infer<typeof AuthSessionSchema>;
