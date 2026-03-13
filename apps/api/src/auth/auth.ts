import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { jwt } from "better-auth/plugins/jwt";
import { oidcProvider } from "better-auth/plugins/oidc-provider";

import { db } from "../db/connection.js";
import { config, parseOrigins } from "../config.js";
import * as userSchema from "../db/schema/user.schema.js";
import { userRoles } from "../db/schema/user.schema.js";
import * as oidcSchema from "../db/schema/oidc.schema.js";
import { getUserRoles } from "./user-roles.js";

// ── Private Helpers ──

const schema = { ...userSchema, ...oidcSchema };

// ── Public API ──

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
    usePlural: true,
  }),
  secret: config.BETTER_AUTH_SECRET,
  baseURL: config.BETTER_AUTH_URL,
  basePath: "/api/auth",
  emailAndPassword: {
    enabled: true,
  },
  trustedOrigins: parseOrigins(config.CORS_ORIGIN),
  plugins: [
    jwt({
      disableSettingJwtHeader: true,
      jwks: {
        keyPairConfig: { alg: "RS256" },
      },
      jwt: {
        issuer: `${config.BETTER_AUTH_URL}/api/auth`,
      },
    }),
    oidcProvider({
      loginPage: "/login",
      requirePKCE: false,
      useJWTPlugin: true,
      trustedClients: config.SEAFILE_OIDC_CLIENT_ID
        ? [
            {
              clientId: config.SEAFILE_OIDC_CLIENT_ID,
              clientSecret: config.SEAFILE_OIDC_CLIENT_SECRET!,
              name: "Seafile",
              metadata: null,
              redirectUrls: ["https://files.s-nc.org/oauth/callback/"],
              type: "web",
              disabled: false,
              skipConsent: true,
            },
          ]
        : [],
      async getAdditionalUserInfoClaim(user) {
        const roles = await getUserRoles(user.id);
        return { roles };
      },
    }),
  ],
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await db.insert(userRoles).values({
            userId: user.id,
            role: "subscriber",
          });
        },
      },
    },
  },
});
