import { randomUUID, randomBytes, createHash } from "node:crypto";

import { eq, and, isNull, gt } from "drizzle-orm";
import { AppError } from "@snc/shared";
import type { Result } from "@snc/shared";
import type { InviteType, CreateInvite } from "@snc/shared";
import { ok, err } from "@snc/shared";

import { db } from "../db/connection.js";
import { inviteTokens } from "../db/schema/invite.schema.js";
import { creatorProfiles, creatorMembers } from "../db/schema/creator.schema.js";
import { users } from "../db/schema/user.schema.js";
import { sendEmail, isEmailConfigured } from "../email/send.js";
import { formatInviteEmail } from "../email/templates/invite.js";
import { generateUniqueSlug } from "./slug.js";
import { rootLogger } from "../logging/logger.js";

// ── Private Constants ──

const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const TOKEN_BYTES = 32;

// ── Private Helpers ──

const hashToken = (raw: string): string =>
  createHash("sha256").update(raw).digest("hex");

// ── Public Types ──

export interface InviteCreatedResult {
  id: string;
  email: string;
  expiresAt: Date;
}

export interface ValidatedInvite {
  id: string;
  type: InviteType;
  email: string;
  payload: Record<string, unknown>;
  expiresAt: Date;
}

// ── Public API ──

/**
 * Create an invite token, store hashed, and send via email.
 *
 * @returns err with EMAIL_NOT_CONFIGURED (503) if SMTP is not set up.
 */
export const createInvite = async (
  input: CreateInvite,
  createdBy: string,
): Promise<Result<InviteCreatedResult, AppError>> => {
  if (!isEmailConfigured()) {
    return err(new AppError("EMAIL_NOT_CONFIGURED", "Email sending is not configured", 503));
  }

  const id = randomUUID();
  const rawToken = randomBytes(TOKEN_BYTES).toString("base64url");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_MS);

  const payload =
    input.type === "creator_owner"
      ? { displayName: input.displayName }
      : { creatorId: input.creatorId, role: input.role };

  await db.insert(inviteTokens).values({
    id,
    type: input.type,
    email: input.email,
    payload,
    tokenHash,
    expiresAt,
    createdBy,
  });

  // Send invite email
  const emailContent = formatInviteEmail({
    type: input.type,
    email: input.email,
    token: rawToken,
    payload,
  });

  await sendEmail({
    to: input.email,
    subject: emailContent.subject,
    html: emailContent.html,
    text: emailContent.text,
  });

  rootLogger.info(
    { inviteId: id, type: input.type, email: input.email },
    "Invite created and sent",
  );

  return ok({ id, email: input.email, expiresAt });
};

/**
 * Validate an invite token. Returns invite details if valid.
 * Does NOT mark as accepted — that happens on accept.
 *
 * @returns err with INVITE_INVALID (404) for expired, used, or unknown tokens.
 */
export const validateInvite = async (
  rawToken: string,
): Promise<Result<ValidatedInvite, AppError>> => {
  const tokenHash = hashToken(rawToken);

  const [invite] = await db
    .select()
    .from(inviteTokens)
    .where(
      and(
        eq(inviteTokens.tokenHash, tokenHash),
        isNull(inviteTokens.acceptedAt),
        gt(inviteTokens.expiresAt, new Date()),
      ),
    );

  if (!invite) {
    return err(new AppError("INVITE_INVALID", "Invite is invalid, expired, or already used", 404));
  }

  return ok({
    id: invite.id,
    type: invite.type,
    email: invite.email,
    payload: invite.payload as Record<string, unknown>,
    expiresAt: invite.expiresAt,
  });
};

/**
 * Accept an invite. Creates creator profile (for owner invites) or adds
 * team member (for team invites). Marks invite as accepted.
 *
 * @returns err with INVITE_EMAIL_MISMATCH (403) if the accepting user's email
 *   does not match the invite, or INVITE_INVALID (404) if the token is invalid.
 */
export const acceptInvite = async (
  rawToken: string,
  userId: string,
): Promise<Result<{ type: InviteType; creatorId: string }, AppError>> => {
  const validateResult = await validateInvite(rawToken);
  if (!validateResult.ok) return validateResult;

  const invite = validateResult.value;

  // Verify the accepting user's email matches the invite
  const [user] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId));

  if (!user || user.email !== invite.email) {
    return err(
      new AppError("INVITE_EMAIL_MISMATCH", "This invite was sent to a different email address", 403),
    );
  }

  let creatorId: string;

  if (invite.type === "creator_owner") {
    const payload = invite.payload as { displayName: string };
    creatorId = randomUUID();
    const handle = await generateUniqueSlug(payload.displayName, {
      table: creatorProfiles,
      slugColumn: creatorProfiles.handle,
      maxLength: 30,
      fallbackPrefix: "creator",
    });

    await db.insert(creatorProfiles).values({
      id: creatorId,
      displayName: payload.displayName,
      handle,
      status: "inactive",
    });

    await db.insert(creatorMembers).values({
      creatorId,
      userId,
      role: "owner",
    });

    rootLogger.info(
      { inviteId: invite.id, creatorId, userId },
      "Creator profile created via invite",
    );
  } else {
    const payload = invite.payload as { creatorId: string; role: string };
    creatorId = payload.creatorId;

    await db
      .insert(creatorMembers)
      .values({
        creatorId: payload.creatorId,
        userId,
        role: payload.role as "owner" | "editor" | "viewer",
      })
      .onConflictDoNothing(); // Already a member — no-op

    rootLogger.info(
      { inviteId: invite.id, creatorId, userId, role: payload.role },
      "Team member added via invite",
    );
  }

  // Mark invite as accepted
  await db
    .update(inviteTokens)
    .set({ acceptedAt: new Date() })
    .where(eq(inviteTokens.id, invite.id));

  return ok({ type: invite.type, creatorId });
};
