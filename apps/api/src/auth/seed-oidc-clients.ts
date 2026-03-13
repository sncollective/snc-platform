import { db } from "../db/connection.js";
import { oauthApplications } from "../db/schema/oidc.schema.js";
import { config } from "../config.js";

// ── Public API ──

/**
 * Ensures trusted OIDC clients from config exist in the database.
 * Called once at startup — uses INSERT ... ON CONFLICT DO UPDATE so
 * config changes (name, redirects, secret) are picked up on redeploy.
 */
export async function seedOidcClients(): Promise<void> {
  if (!config.SEAFILE_OIDC_CLIENT_ID || !config.SEAFILE_OIDC_CLIENT_SECRET) {
    return;
  }

  const now = new Date();

  await db
    .insert(oauthApplications)
    .values({
      id: crypto.randomUUID(),
      clientId: config.SEAFILE_OIDC_CLIENT_ID,
      clientSecret: config.SEAFILE_OIDC_CLIENT_SECRET,
      name: "Seafile",
      redirectUrls: JSON.stringify([
        "https://files.s-nc.org/oauth/callback/",
      ]),
      type: "web",
      disabled: false,
      metadata: null,
      userId: null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: oauthApplications.clientId,
      set: {
        clientSecret: config.SEAFILE_OIDC_CLIENT_SECRET,
        name: "Seafile",
        redirectUrls: JSON.stringify([
          "https://files.s-nc.org/oauth/callback/",
        ]),
        disabled: false,
        updatedAt: now,
      },
    });

  console.log("OIDC client seeded: Seafile");
}
