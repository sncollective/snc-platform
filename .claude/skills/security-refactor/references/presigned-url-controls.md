# Rule: Presigned URL Controls

> S3 presigned URLs use minimum necessary expiry. Upload validation enforces MIME type allowlists and size limits per purpose.

**Domain**: cross-cutting

## Motivation

OWASP A01 (Broken Access Control). Presigned URLs grant temporary direct access to storage — if the expiry is too long, a leaked URL provides extended unauthorized access. MIME and size validation prevents abuse (uploading executables as "images", massive files to exhaust storage).

## Before / After

### From this codebase: upload validation (correct pattern)

**Before:** *(what a violation would look like)*
```typescript
// No MIME or size validation — accepts anything
uploadRoutes.post("/presign", requireAuth, async (c) => {
  const { filename } = c.req.valid("json");
  const url = await getPresignedUploadUrl(filename, 7200); // 2 hour expiry
  return c.json({ url });
});
```

**After:** *(the established pattern)*
```typescript
uploadRoutes.post("/presign", requireAuth, validator("json", PresignRequestSchema), async (c) => {
  const { filename, purpose, mimeType, size } = c.req.valid("json");
  // Validates MIME against ACCEPTED_MIME_TYPES[purpose]
  // Validates size against MAX_FILE_SIZES[purpose]
  const url = await getPresignedUploadUrl(filename, 3600); // 1 hour expiry
  return c.json({ url });
});
```

### Synthetic example: overly generous expiry

**Before:**
```typescript
const presignedUrl = await getSignedUrl(s3Client, command, {
  expiresIn: 86400, // 24 hours — too long
});
```

**After:**
```typescript
const presignedUrl = await getSignedUrl(s3Client, command, {
  expiresIn: 3600, // 1 hour — minimum needed for large uploads
});
```

## Exceptions

- Download URLs for published content may use longer expiry (content is already public)
- VOD stream URLs from Owncast pipeline may need different expiry based on stream duration

## Scope

- Applies to: `apps/api/src/routes/upload.routes.ts`, any code generating presigned URLs
- Does NOT apply to: Garage bucket configuration (that's infra), lifecycle rules
