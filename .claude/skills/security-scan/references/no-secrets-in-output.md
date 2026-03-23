# Rule: No Secrets in Output

> Error messages, logs, and API responses must never contain secrets, tokens, API keys, or storage credentials.

**Domain**: code

## Motivation

OWASP A02 (Cryptographic Failures). Secrets that leak into logs, error responses, or client-side code can be harvested from log aggregators, browser dev tools, or error reporting services. A single leaked API key can compromise an entire service.

## Before / After

### From this codebase: password reset error logging

**Before:**
```typescript
// auth.ts — current pattern
sendPasswordResetOTP(email, otp).catch((e) =>
  console.error("Failed to send password reset OTP:", e)
);
// If the error object contains the OTP or email, they appear in logs
```

**After:**
```typescript
sendPasswordResetOTP(email, otp).catch((e) =>
  console.error("Failed to send password reset OTP:", {
    error: e instanceof Error ? e.message : "Unknown error",
    // Never log the OTP itself or the recipient email
  })
);
```

### Synthetic example: S3 credentials in error

**Before:**
```typescript
try {
  await s3Client.send(new PutObjectCommand(params));
} catch (e) {
  // SDK error may include the access key ID in the message
  console.error("S3 upload failed:", e);
  throw new AppError("UPLOAD_FAILED", e.message, 500);
}
```

**After:**
```typescript
try {
  await s3Client.send(new PutObjectCommand(params));
} catch (e) {
  console.error("S3 upload failed:", {
    bucket: params.Bucket,
    key: params.Key,
    code: e.name,
  });
  throw new AppError("UPLOAD_FAILED", "File upload failed", 500);
}
```

## Exceptions

- Debug logging in development (gated behind `NODE_ENV === "development"`) may include more detail, but never raw secrets
- Seed scripts that print generated credentials for initial setup

## Scope

- Applies to: all `catch` blocks, error handlers, `console.error` calls in `apps/api/src/`
- Does NOT apply to: config.ts (which validates secrets but doesn't log them), seed scripts
