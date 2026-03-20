# Pattern: Upload Replace Workflow

Parameterized private handler performs ownership → size pre-check → parse → MIME validate → sanitize → delete-old → upload-new → DB-update → response for replacing user-uploaded files.

## Rationale
Multiple upload endpoints (avatar, banner, media, thumbnail, cover art) share the same validation and storage workflow. A single parameterized private function eliminates per-field duplication while keeping the multi-step sequence correct and auditable in one place.

## Examples

### Example 1: Parameterized avatar/banner handler in creator routes
**File**: `apps/api/src/routes/creator.routes.ts:132`
```typescript
const handleImageUpload = async (
  c: Context<AuthEnv>,
  field: "avatar" | "banner",
): Promise<Response> => {
  const creatorId = c.req.param("creatorId");
  const user = c.get("user");

  // 1. Ownership check
  if (creatorId !== user.id) {
    throw new ForbiddenError("Cannot upload to another creator's profile");
  }

  // 2. Content-Length pre-check (reject oversized requests before reading body)
  const contentLengthHeader = c.req.header("content-length");
  if (contentLengthHeader) {
    const contentLength = parseInt(contentLengthHeader, 10);
    if (!Number.isNaN(contentLength) && contentLength > MAX_FILE_SIZES.image) {
      throw new ValidationError(`File size exceeds the ${MAX_FILE_SIZES.image} byte limit`);
    }
  }

  // 3. Parse multipart body and extract file
  const body = await c.req.parseBody();
  const file = body["file"];
  if (!(file instanceof File)) {
    throw new ValidationError("No file provided in 'file' form field");
  }

  // 4. Validate actual file size
  if (file.size > MAX_FILE_SIZES.image) {
    throw new ValidationError(`File size ${file.size} exceeds the ${MAX_FILE_SIZES.image} byte limit`);
  }

  // 5. Validate MIME type
  if (!(ACCEPTED_MIME_TYPES.image as readonly string[]).includes(file.type)) {
    throw new ValidationError(`Invalid MIME type '${file.type}'`);
  }

  // 6. Generate storage key
  const sanitized = sanitizeFilename(file.name || field);
  const key = `creators/${creatorId}/${field}/${sanitized}`;

  // 7. Ensure profile exists (lazy upsert)
  let profile = await findCreatorProfile(creatorId);
  if (!profile) {
    profile = await ensureCreatorProfile(creatorId, user.name);
  }

  // 8. Delete old file before re-uploading
  const oldKey = field === "avatar" ? profile.avatarKey : profile.bannerKey;
  if (oldKey) {
    const deleteResult = await storage.delete(oldKey);
    if (!deleteResult.ok) {
      console.error(`Failed to delete old ${field}:`, deleteResult.error.message);
    }
  }

  // 9. Upload new file
  const uploadResult = await storage.upload(key, file.stream(), {
    contentType: file.type,
    contentLength: file.size,
  });
  if (!uploadResult.ok) {
    throw new AppError("UPLOAD_ERROR", `Failed to upload ${field}`, 500);
  }

  // 10. Update DB with new storage key
  const [updated] = await db
    .update(creatorProfiles)
    .set({ [field === "avatar" ? "avatarKey" : "bannerKey"]: key, updatedAt: new Date() })
    .where(eq(creatorProfiles.userId, creatorId))
    .returning();
  if (!updated) throw new NotFoundError("Creator profile not found");

  return c.json(await toProfileResponse(updated));
};

// Two route handlers delegate to the same function, varying only field:
creatorRoutes.post("/:creatorId/avatar", requireAuth, requireRole("creator"), ..., async (c) =>
  handleImageUpload(c, "avatar"),
);
creatorRoutes.post("/:creatorId/banner", requireAuth, requireRole("creator"), ..., async (c) =>
  handleImageUpload(c, "banner"),
);
```

### Example 2: Content upload handler with dynamic field constraints
**File**: `apps/api/src/routes/content.routes.ts:434`
```typescript
contentRoutes.post(
  "/:id/upload",
  requireAuth,
  validator("query", UploadQuerySchema),
  async (c) => {
    const { field } = c.req.valid("query" as never) as { field: "media" | "thumbnail" | "coverArt" };
    const contentItem = await requireContentOwnership(c);

    // Dynamic constraints based on content type + upload field
    const { maxSize, acceptedTypes } = getUploadConstraints(contentItem.type, field);

    // Content-Length pre-check
    const contentLengthHeader = c.req.header("content-length");
    if (contentLengthHeader) {
      const contentLength = parseInt(contentLengthHeader, 10);
      if (!Number.isNaN(contentLength) && contentLength > maxSize) {
        throw new ValidationError(`File size exceeds limit`);
      }
    }

    // Parse + validate
    const body = await c.req.parseBody();
    const file = body["file"];
    if (!(file instanceof File)) throw new ValidationError("No file provided");
    if (file.size > maxSize) throw new ValidationError("File too large");
    if (!(acceptedTypes as readonly string[]).includes(file.type)) {
      throw new ValidationError("Invalid MIME type");
    }

    // Key, delete old, upload new, DB update — same sequence as creator handler
    const sanitized = sanitizeFilename(file.name);
    const key = `content/${contentItem.id}/${field}/${sanitized}`;
    const oldKey = FIELD_KEY_MAP[field](contentItem);
    if (oldKey) await storage.delete(oldKey);
    await storage.upload(key, file.stream(), { contentType: file.type, contentLength: file.size });
    await db.update(content)
      .set({ [FIELD_KEY_MAP_COLUMNS[field]]: key, updatedAt: new Date() })
      .where(eq(content.id, contentItem.id));
    // ...
  },
);
```

## When to Use
- Any route that replaces a user-uploaded file stored via `StorageProvider`
- When multiple HTTP endpoints share the same upload logic differing only in the target field name
- Always apply the full sequence in order: ownership → size → parse → MIME → sanitize → delete-old → upload → DB

## When NOT to Use
- Creating new content records where there is no "old file" to clean up (skip step 8)
- Append-only uploads (logs, archives) where old files should be kept

## Common Violations
- **Skipping Content-Length pre-check**: Without the header check, an oversized request body is fully read into memory before validation. Always pre-check before `parseBody()`.
- **Uploading before deleting**: Storing the new file before removing the old one risks orphaned storage objects if the DB update fails. Always delete-old before upload-new.
- **Missing ownership check**: The route middleware (`requireAuth`, `requireRole`) is insufficient — verify the resource belongs to the authenticated user inside the handler before touching storage.
- **Not validating actual file size**: The `Content-Length` header can be spoofed; always validate `file.size` after parsing.
