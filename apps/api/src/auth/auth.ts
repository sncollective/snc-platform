import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { jwt } from "better-auth/plugins/jwt";
import { oidcProvider } from "better-auth/plugins/oidc-provider";
import { emailOTP } from "better-auth/plugins/email-otp";

import { db } from "../db/connection.js";
import { config, parseOrigins } from "../config.js";
import * as userSchema from "../db/schema/user.schema.js";
import * as oidcSchema from "../db/schema/oidc.schema.js";
import { getUserRoles } from "./user-roles.js";
import { sendEmail } from "../email/send.js";
import { rootLogger } from "../logging/logger.js";

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
  emailVerification: {
    sendOnSignUp: true,
    requireEmailVerification: false,
    autoSignInAfterVerification: true,
    async sendVerificationEmail({ user, url }) {
      await sendEmail({
        to: user.email,
        subject: "Verify your S/NC email",
        html: `<p>Click <a href="${url}">here</a> to verify your email address.</p>`,
        text: `Verify your email: ${url}`,
      }).catch((e: unknown) => rootLogger.error({ error: e instanceof Error ? e.message : String(e) }, "Failed to send verification email"));
    },
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
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        if (type === "forget-password") {
          await sendEmail({
            to: email,
            subject: "Your S/NC password reset code",
            html: `<p>Your password reset code is: <strong>${otp}</strong></p><p>This code expires in 10 minutes.</p>`,
            text: `Your password reset code is: ${otp}\n\nThis code expires in 10 minutes.`,
          }).catch((e: unknown) => rootLogger.error({ error: e instanceof Error ? e.message : String(e) }, "Failed to send password reset OTP"));
        }
      },
    }),
  ],
});
