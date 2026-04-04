import { randomUUID, randomBytes } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { AppError, ok, err } from "@snc/shared";
import type { Result } from "@snc/shared";

import { db } from "../db/connection.js";
import { mastodonApps } from "../db/schema/mastodon.schema.js";
import { users, accounts, sessions } from "../db/schema/user.schema.js";
import { config } from "../config.js";
import { rootLogger } from "../logging/logger.js";

// ── Types ──

interface MastodonAppRegistration {
  client_id: string;
  client_secret: string;
}

interface MastodonTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  created_at: number;
}

interface MastodonAccount {
  id: string;
  username: string;
  acct: string;
  display_name: string;
  avatar: string | null;
}

interface MastodonAuthResult {
  userId: string;
  sessionToken: string;
  sessionId: string;
  expiresAt: Date;
}

// ── CSRF State Store ──

interface StateEntry {
  instanceDomain: string;
  expiresAt: number;
}

const stateStore = new Map<string, StateEntry>();

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ── Private Helpers ──

/**
 * Build the Mastodon redirect URI from config or fall back to the default.
 */
const getMastodonRedirectUri = (): string =>
  config.MASTODON_REDIRECT_URI ??
  `${config.BETTER_AUTH_URL}/api/auth/mastodon/callback`;

// ── Public API ──

/**
 * Look up or register an OAuth app for a Mastodon instance.
 * Caches app credentials in the mastodon_apps table to avoid re-registration.
 */
export async function getOrRegisterApp(
  instanceDomain: string,
  redirectUri: string,
): Promise<Result<MastodonAppRegistration>> {
  // Check DB cache first
  const [existing] = await db
    .select()
    .from(mastodonApps)
    .where(eq(mastodonApps.instanceDomain, instanceDomain));

  if (existing) {
    return ok({ client_id: existing.clientId, client_secret: existing.clientSecret });
  }

  // Register a new app with the instance
  let regResponse: Response;
  try {
    regResponse = await fetch(`https://${instanceDomain}/api/v1/apps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_name: "S/NC",
        redirect_uris: redirectUri,
        scopes: "read:accounts",
        website: config.BETTER_AUTH_URL,
      }),
    });
  } catch (e) {
    rootLogger.error({ instanceDomain, error: e instanceof Error ? e.message : String(e) }, "Mastodon app registration fetch failed");
    return err(new AppError("MASTODON_UNREACHABLE", `Could not reach Mastodon instance: ${instanceDomain}`, 502));
  }

  if (!regResponse.ok) {
    rootLogger.error({ instanceDomain, status: regResponse.status }, "Mastodon app registration rejected");
    return err(new AppError("MASTODON_REGISTRATION_FAILED", `Mastodon instance rejected app registration`, 502));
  }

  const registration = (await regResponse.json()) as MastodonAppRegistration;

  // Persist to DB cache
  await db
    .insert(mastodonApps)
    .values({
      instanceDomain,
      clientId: registration.client_id,
      clientSecret: registration.client_secret,
    })
    .onConflictDoNothing();

  return ok(registration);
}

/**
 * Generate an authorization URL for the Mastodon OAuth flow.
 * Returns the URL and a CSRF state token stored in memory.
 */
export async function startMastodonAuth(
  instanceDomain: string,
): Promise<Result<{ authorizationUrl: string; state: string }>> {
  const redirectUri = getMastodonRedirectUri();
  const appResult = await getOrRegisterApp(instanceDomain, redirectUri);
  if (!appResult.ok) return appResult;

  const state = randomBytes(32).toString("hex");
  stateStore.set(state, {
    instanceDomain,
    expiresAt: Date.now() + STATE_TTL_MS,
  });

  const params = new URLSearchParams({
    client_id: appResult.value.client_id,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "read:accounts",
    state,
  });

  const authorizationUrl = `https://${instanceDomain}/oauth/authorize?${params.toString()}`;
  return ok({ authorizationUrl, state });
}

/**
 * Handle the Mastodon OAuth callback: exchange code for token, fetch profile,
 * and create or link the user account. Returns a session for the authenticated user.
 */
export async function handleMastodonCallback(
  code: string,
  state: string,
): Promise<Result<MastodonAuthResult>> {
  // Validate CSRF state
  const stateEntry = stateStore.get(state);
  if (!stateEntry) {
    return err(new AppError("MASTODON_INVALID_STATE", "Invalid or expired OAuth state", 400));
  }
  if (Date.now() > stateEntry.expiresAt) {
    stateStore.delete(state);
    return err(new AppError("MASTODON_STATE_EXPIRED", "OAuth state has expired", 400));
  }
  stateStore.delete(state);

  const { instanceDomain } = stateEntry;
  const redirectUri = getMastodonRedirectUri();

  const appResult = await getOrRegisterApp(instanceDomain, redirectUri);
  if (!appResult.ok) return appResult;

  // Exchange code for token
  let tokenResponse: Response;
  try {
    tokenResponse = await fetch(`https://${instanceDomain}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: appResult.value.client_id,
        client_secret: appResult.value.client_secret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code,
        scope: "read:accounts",
      }),
    });
  } catch (e) {
    rootLogger.error({ instanceDomain, error: e instanceof Error ? e.message : String(e) }, "Mastodon token exchange fetch failed");
    return err(new AppError("MASTODON_UNREACHABLE", `Could not reach Mastodon instance: ${instanceDomain}`, 502));
  }

  if (!tokenResponse.ok) {
    return err(new AppError("MASTODON_TOKEN_FAILED", "Failed to exchange authorization code", 502));
  }

  const tokenData = (await tokenResponse.json()) as MastodonTokenResponse;

  // Fetch the user profile
  let profileResponse: Response;
  try {
    profileResponse = await fetch(`https://${instanceDomain}/api/v1/accounts/verify_credentials`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
  } catch (e) {
    rootLogger.error({ instanceDomain, error: e instanceof Error ? e.message : String(e) }, "Mastodon profile fetch failed");
    return err(new AppError("MASTODON_UNREACHABLE", `Could not reach Mastodon instance: ${instanceDomain}`, 502));
  }

  if (!profileResponse.ok) {
    return err(new AppError("MASTODON_PROFILE_FAILED", "Failed to fetch Mastodon profile", 502));
  }

  const profile = (await profileResponse.json()) as MastodonAccount;
  const providerAccountId = `${profile.username}@${instanceDomain}`;
  const emailPlaceholder = `${profile.username}@${instanceDomain}`;

  // Check for existing linked account
  const [existingAccount] = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.providerId, "mastodon"),
        eq(accounts.accountId, providerAccountId),
      ),
    );

  let userId: string;

  if (existingAccount) {
    userId = existingAccount.userId;

    // Update access token
    const now = new Date();
    await db
      .update(accounts)
      .set({ accessToken: tokenData.access_token, updatedAt: now })
      .where(eq(accounts.id, existingAccount.id));
  } else {
    // Check if a user with the placeholder email already exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, emailPlaceholder));

    const now = new Date();

    if (existingUser) {
      userId = existingUser.id;
    } else {
      // Create a new user
      const newUserId = randomUUID();
      const displayName = profile.display_name || profile.username;
      await db.insert(users).values({
        id: newUserId,
        name: displayName,
        email: emailPlaceholder,
        emailVerified: false,
        image: profile.avatar ?? null,
        createdAt: now,
        updatedAt: now,
      });
      userId = newUserId;
    }

    // Create the account link
    await db.insert(accounts).values({
      id: randomUUID(),
      userId,
      accountId: providerAccountId,
      providerId: "mastodon",
      accessToken: tokenData.access_token,
      refreshToken: null,
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null,
      scope: tokenData.scope,
      idToken: null,
      password: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Create a Better Auth-compatible session
  const sessionToken = randomBytes(32).toString("hex");
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const now = new Date();

  await db.insert(sessions).values({
    id: sessionId,
    userId,
    token: sessionToken,
    expiresAt,
    ipAddress: null,
    userAgent: null,
    createdAt: now,
    updatedAt: now,
  });

  rootLogger.info({ event: "mastodon_login", userId, instanceDomain }, "Mastodon login successful");

  return ok({ userId, sessionToken, sessionId, expiresAt });
}

/**
 * Remove expired CSRF states from the in-memory store.
 * Safe to call periodically — no-op if store is empty.
 */
export function cleanExpiredStates(): void {
  const now = Date.now();
  for (const [key, entry] of stateStore.entries()) {
    if (now > entry.expiresAt) {
      stateStore.delete(key);
    }
  }
}
