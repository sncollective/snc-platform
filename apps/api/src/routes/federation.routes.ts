import { createRequire } from "node:module";

import {
  createFederation,
  generateCryptoKeyPair,
  exportJwk,
  importJwk,
  MemoryKvStore,
} from "@fedify/fedify";
import type { KvStore, MessageQueue } from "@fedify/fedify";
import { Person, Image } from "@fedify/fedify/vocab";
import { PostgresKvStore, PostgresMessageQueue } from "@fedify/postgres";
import { federation as fedifyMiddleware } from "@fedify/hono";
import { Hono } from "hono";
import { eq } from "drizzle-orm";

import { config } from "../config.js";
import { sql, db } from "../db/connection.js";
import { creatorProfiles } from "../db/schema/creator.schema.js";
import { getFrontendBaseUrl } from "../lib/route-utils.js";

// ── Module-level Constants ──

const require = createRequire(import.meta.url);
const { version: VERSION } = require("../../package.json") as { version: string };

// ── Types ──

interface StoredKeyPair {
  publicKey: JsonWebKey;
  privateKey: JsonWebKey;
}

// ── Factory ──

/**
 * Create the federation Hono app. Accepts an optional KV store and message queue
 * for dependency injection in tests.
 */
export function createFederationApp(
  kv: KvStore = new PostgresKvStore(sql),
  queue: MessageQueue = new PostgresMessageQueue(sql),
): Hono {
  const domain = config.FEDERATION_DOMAIN;

  const fed = createFederation<void>({
    kv,
    queue,
    origin: `https://${domain}`,
    manuallyStartQueue: true,
  });

  // ── Actor dispatcher ──

  // Register stub inbox — required by Fedify before actors can advertise inboxes.
  // Actual inbox processing is out of scope for the discovery-layer phase.
  fed.setInboxListeners("/ap/actors/{identifier}/inbox", "/ap/inbox");

  fed
    .setActorDispatcher("/ap/actors/{identifier}", async (ctx, identifier) => {
      const rows = await db
        .select({
          id: creatorProfiles.id,
          handle: creatorProfiles.handle,
          displayName: creatorProfiles.displayName,
          bio: creatorProfiles.bio,
          avatarKey: creatorProfiles.avatarKey,
        })
        .from(creatorProfiles)
        .where(eq(creatorProfiles.handle, identifier));

      const profile = rows[0];
      if (!profile) return null;

      const frontendBase = getFrontendBaseUrl();
      const creatorSlug = profile.handle ?? profile.id;
      const profileUrl = new URL(`${frontendBase}/creators/${creatorSlug}`);

      return new Person({
        id: ctx.getActorUri(identifier),
        preferredUsername: identifier,
        name: profile.displayName,
        summary: profile.bio ?? null,
        url: profileUrl,
        inbox: ctx.getInboxUri(identifier),
        icon: profile.avatarKey
          ? new Image({
              url: new URL(
                `https://${domain}/api/creators/${creatorSlug}/avatar`,
              ),
            })
          : null,
      });
    })
    .setKeyPairsDispatcher(async (_ctx, identifier) => {
      const stored = await kv.get<StoredKeyPair>(["keypairs", identifier]);

      if (stored) {
        return [
          {
            publicKey: await importJwk(stored.publicKey, "public"),
            privateKey: await importJwk(stored.privateKey, "private"),
          },
        ];
      }

      const newPair = await generateCryptoKeyPair("RSASSA-PKCS1-v1_5");
      await kv.set(["keypairs", identifier], {
        publicKey: await exportJwk(newPair.publicKey),
        privateKey: await exportJwk(newPair.privateKey),
      });

      return [newPair];
    });

  // ── NodeInfo dispatcher ──

  fed.setNodeInfoDispatcher("/.well-known/nodeinfo/2.1", async (_ctx) => ({
    software: {
      name: "snc",
      version: VERSION,
      homepage: new URL("https://s-nc.org"),
    },
    protocols: ["activitypub"],
    openRegistrations: false,
    usage: {
      users: { total: 0, activeMonth: 0, activeHalfYear: 0 },
      localPosts: 0,
      localComments: 0,
    },
  }));

  // ── Hono app ──

  const honoApp = new Hono();
  honoApp.use("*", fedifyMiddleware(fed, () => undefined));

  return honoApp;
}

// ── Production singleton ──

export const federationRoutes = createFederationApp();

// ── Test helper ──

/** Create a federation Hono app with an in-memory KV store for testing. */
export function createTestFederationApp(): Hono {
  return createFederationApp(new MemoryKvStore());
}
