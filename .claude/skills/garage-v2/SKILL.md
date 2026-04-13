---
name: garage-v2
description: >
  Garage v2 S3-compatible object storage reference. Auto-loads when working with
  Garage, S3 storage, bucket management, @aws-sdk/client-s3, presigned URLs,
  multipart uploads, object storage, PutObjectCommand, GetObjectCommand.
user-invocable: false
---

# Garage v2 Reference

> **Version:** 2.2.0
> **Docs:** https://garagehq.deuxfleurs.fr/documentation/

See [reference.md](reference.md) for the full Admin API v2 and S3 compatibility reference.

## Key Gotchas

### S3 Client Configuration

`forcePathStyle: true` is required when using the AWS SDK v3 with Garage. Garage uses path-style URLs (`host/bucket/key`) by default — virtual-hosted-style (`bucket.host/key`) requires configuring `root_domain` in `garage.toml`.

```typescript
// Required for Garage
new S3Client({
  endpoint: "http://garage:3900",
  region: "garage",
  forcePathStyle: true,
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
  credentials: { accessKeyId: "...", secretAccessKey: "..." },
})
```

The `requestChecksumCalculation` and `responseChecksumValidation` options are needed because AWS SDK v3 changed defaults — without them, some operations fail against Garage.

### No ACLs or Bucket Policies

Garage does **not** implement S3 ACLs or bucket policies. All ACL/policy API calls return 501. Instead, Garage uses its own per-access-key-per-bucket permission model managed through the Admin API:

```
POST /v2/AllowBucketKey
{ "bucketId": "...", "accessKeyId": "...", "permissions": { "read": true, "write": true, "owner": true } }
```

### Lifecycle Limitations

Only two lifecycle actions are supported:
- `AbortIncompleteMultipartUpload` — auto-clean abandoned uploads
- `Expiration` — auto-delete objects after a period

No support for: transitions, versioning, intelligent tiering, or any other lifecycle action.

### No Object Versioning

`GetBucketVersioning` always returns "not enabled." `PutBucketVersioning` and `ListObjectVersions` are not implemented.

### Signature Version

Only AWS Signature v4 is supported. Signature v2 (deprecated) is not implemented.

### CORS Configuration

CORS can be set via either:
- Admin API: `PUT /v2/PutBucketCorsConfiguration?id={bucketId}` (with bearer token)
- S3 API: `PutBucketCors` (with S3 credentials)

Don't set CORS in both Caddy/reverse proxy and Garage — browsers reject duplicate CORS headers.

### Two Separate APIs

Garage exposes two independent APIs on different ports:
- **S3 API** (default 3900) — standard S3 operations with AWS SDK
- **Admin API** (default 3903) — cluster management, keys, buckets, permissions (bearer token auth)

Don't confuse them — S3 credentials don't work on the Admin API and vice versa.

## Anti-Patterns

1. **Don't use ACL or bucket policy S3 calls** — they return 501 Not Implemented. Use the Admin API's `AllowBucketKey`/`DenyBucketKey` instead.

2. **Don't use virtual-hosted-style URLs without configuring `root_domain`** — set `forcePathStyle: true` in the SDK or configure `root_domain` in `garage.toml`.

3. **Don't set CORS in both reverse proxy and Garage** — browsers reject responses with duplicate CORS headers. Configure CORS in one place only.

4. **Don't assume S3 feature parity** — Garage returns 501 for unimplemented features. Check the compatibility table in reference.md before using advanced S3 features.

5. **Don't use tagging, replication, or notification APIs** — none are implemented.

## Resources

- [Garage Documentation](https://garagehq.deuxfleurs.fr/documentation/)
- [S3 Compatibility Table](https://garagehq.deuxfleurs.fr/documentation/reference-manual/s3-compatibility/)
- [Admin API v2 Spec (OpenAPI)](https://garagehq.deuxfleurs.fr/api/garage-admin-v2.json)
