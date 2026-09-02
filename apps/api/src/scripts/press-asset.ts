/**
 * press-asset.ts — sanctioned agent path for uploading press images into a
 * creator's owned press namespace (creators/<id>/press/...) against the dev
 * stack. Settled per work item press-agent-asset-ingest-and-edit-path: script
 * (not an API endpoint), legacy press namespace (not content-library keys),
 * config edits stay on the seed-press.ts content lane.
 *
 * Usage:
 *   cd apps/api && ./node_modules/.bin/tsx --import ./src/env.ts \
 *     src/scripts/press-asset.ts <handle> <localFile> <keySuffix>
 *
 * Example:
 *   ... press-asset.ts animalfuture /path/to/FullBand1.jpg epk-hero-v01.jpg
 *
 * Prints the resulting storage key plus detected dimensions — map slots/crops
 * content-side from those (crops are a press-config concern; imgproxy cuts).
 * Enforces the platform's own ingest contract: jpg/png/webp by magic bytes,
 * the shared 10MB image size limit (the PDF render path enforces the same
 * limit at read time, so oversized uploads would fail downstream anyway).
 * Uploading to an existing key overwrites it.
 */
import { readFile } from "node:fs/promises";

import { eq } from "drizzle-orm";

import { MAX_FILE_SIZES } from "@snc/shared";

import { db, sql } from "../db/connection.js";
import { creatorProfiles } from "../db/schema/creator.schema.js";
import { detectImage } from "../lib/image-detect.js";
import { storage } from "../storage/index.js";

if (process.env.NODE_ENV === "production") {
  console.error("Error: press-asset.ts is a dev/staging utility; production ingest goes through the manage editor.");
  process.exit(1);
}

const CONTENT_TYPES = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const;

const [handle, localFile, keySuffix] = process.argv.slice(2);
if (!handle || !localFile || !keySuffix) {
  console.error("Usage: press-asset.ts <handle> <localFile> <keySuffix>");
  process.exit(1);
}
if (/\.(env|pem|key)/i.test(localFile)) {
  console.error("Refusing to upload a secret-looking file.");
  process.exit(1);
}
if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(keySuffix)) {
  console.error(`Error: keySuffix "${keySuffix}" must be a flat filename (letters, digits, dots, dashes, underscores; no slashes or "..").`);
  process.exit(1);
}

try {
  const [profile] = await db
    .select({ id: creatorProfiles.id })
    .from(creatorProfiles)
    .where(eq(creatorProfiles.handle, handle))
    .limit(1);
  if (!profile) {
    console.error(`Error: creator handle "${handle}" not found (run seed-press.ts first).`);
    process.exitCode = 1;
  } else {
    const bytes = await readFile(localFile);
    if (bytes.byteLength > MAX_FILE_SIZES.image) {
      console.error(
        `Error: ${localFile} is ${(bytes.byteLength / 1024 / 1024).toFixed(1)}MB, over the ${(MAX_FILE_SIZES.image / 1024 / 1024).toFixed(0)}MB image limit. Downscale or re-export, then retry.`,
      );
      process.exitCode = 1;
    } else {
      const detected = detectImage(bytes);
      if (!detected) {
        console.error("Error: file is not a recognized jpg/png/webp (magic-byte sniff failed).");
        process.exitCode = 1;
      } else {
        const contentType = CONTENT_TYPES[detected.type];
        const key = `creators/${profile.id}/press/${keySuffix}`;
        const result = await storage.upload(
          key,
          new Blob([bytes]).stream() as ReadableStream<Uint8Array>,
          { contentType, contentLength: bytes.byteLength },
        );
        if (!result.ok) {
          console.error(`Error uploading to ${key}: ${result.error.message}`);
          process.exitCode = 1;
        } else {
          const dimensions = detected.width && detected.height
            ? `${detected.width}x${detected.height}`
            : "dimensions unreadable from header";
          console.log(`${key} (${result.value.size} bytes, ${contentType}, ${dimensions})`);
        }
      }
    }
  }
} catch (error) {
  console.error("Error uploading press asset:", error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
