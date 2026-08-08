import { Hono } from "hono";
import { describeRoute } from "hono-openapi";

import { isLibraryAssetKey, NotFoundError } from "@snc/shared";

import type { AuthEnv } from "../middleware/auth-env.js";
import { streamFile } from "../lib/file-utils.js";
import { storage } from "../storage/index.js";
import { ERROR_404 } from "../lib/openapi-errors.js";

/** Public immutable raw-byte delivery for content-addressed library keys. */
export const libraryRawRoutes = new Hono<AuthEnv>();

libraryRawRoutes.get(
  "/raw/*",
  describeRoute({
    description: "Stream a content-addressed library image",
    tags: ["library"],
    responses: {
      200: {
        description: "Library image bytes",
        content: { "application/octet-stream": { schema: { type: "string", format: "binary" } } },
      },
      404: ERROR_404,
    },
  }),
  async (c) => {
    // Hono's `*` route matches the remainder but does not expose it through
    // `param("*")` in all supported runtimes; recover it from the normalized path.
    const marker = "/raw/";
    const markerIndex = c.req.path.indexOf(marker);
    const path = markerIndex === -1 ? "" : c.req.path.slice(markerIndex + marker.length);
    const key = `library/${path}`;
    if (!isLibraryAssetKey(key)) throw new NotFoundError("Library asset not found");
    return streamFile(c, storage, key, "Library asset not found", "public, max-age=31536000, immutable");
  },
);
