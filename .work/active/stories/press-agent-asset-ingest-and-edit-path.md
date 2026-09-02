---
id: press-agent-asset-ingest-and-edit-path
kind: story
stage: implementing
tags: [press, devx]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-09-02
updated: 2026-09-02
---

# Sanctioned agent path for press assets (and config edits) against dev

The campaign sessions (records/animal-future cwd) now drive EPK/press
proof generation through the dev machinery: seed content -> publish ->
render PDFs from the public endpoints. Two gaps force platform-repo
detours per proof cycle and should get a sanctioned agent path:

1. **Asset ingest.** Getting an image into a creator's owned press
   namespace (`creators/<id>/press/...`) has no agent-usable surface - the
   manage editor's flow is interactive. A small utility script was
   drafted in the campaign session and reverted per the lane split;
   it uploads a local file via the existing `storage.upload` and prints
   the key:

   ```ts
   // apps/api/src/scripts/press-asset.ts (draft; refine to taste)
   // Usage: press-asset.ts <handle> <localFile> <keySuffix>
   import { createReadStream } from "node:fs";
   import { stat } from "node:fs/promises";
   import { Readable } from "node:stream";
   import { eq } from "drizzle-orm";
   import { db, sql } from "../db/connection.js";
   import { creatorProfiles } from "../db/schema/creator.schema.js";
   import { storage } from "../storage/index.js";

   const [handle, localFile, keySuffix] = process.argv.slice(2);
   if (!handle || !localFile || !keySuffix) { console.error("Usage: press-asset.ts <handle> <localFile> <keySuffix>"); process.exit(1); }
   if (/\.(env|pem|key)/i.test(localFile)) { console.error("Refusing to upload a secret-looking file."); process.exit(1); }
   const contentType = localFile.endsWith(".png") ? "image/png" : localFile.match(/\.webp$/i) ? "image/webp" : "image/jpeg";
   const [profile] = await db.select({ id: creatorProfiles.id }).from(creatorProfiles).where(eq(creatorProfiles.handle, handle)).limit(1);
   if (!profile) { console.error(`Error: creator handle "${handle}" not found (run seed-press.ts first).`); process.exitCode = 1; }
   else {
     const key = `creators/${profile.id}/press/${keySuffix}`;
     const size = (await stat(localFile)).size;
     const webStream = Readable.toWeb(createReadStream(localFile)) as unknown as ReadableStream<Uint8Array>;
     const result = await storage.upload(key, webStream, { contentType, contentLength: size });
     if (!result.ok) { console.error(`Error uploading to ${key}: ${result.error.message}`); process.exitCode = 1; }
     else console.log(`${key} (${result.value.size} bytes, ${contentType})`);
   }
   await sql.end();
   ```

   Questions to settle here: script vs API endpoint, key naming
   convention, and whether content-library keys (tusd flow) should be the
   agent path instead of the legacy press namespace.

2. **Config edits without platform-repo commits.** Copy/link edits
   currently require editing `seed-press.ts` (a platform-repo content
   commit per tweak) because PATCH /press-config + publish are
   auth-gated. Decide the sanctioned agent route: a dev-scoped service
   token / agent login for the manage endpoints, a seed-bypass script
   (upsert from a campaign-owned JSON), or accepting seed commits as the
   path. The operator's intent is that campaign-side agents iterate
   proofs freely ("changes to taste") while code changes route through
   this repo's own lane.

Context: campaign deadline pressure is real (cycle-2 pitches close
~2026-09-03; release 2026-09-17). Item 1 is the short-term unblock;
item 2 is the durable pattern.
