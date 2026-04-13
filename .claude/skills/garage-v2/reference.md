# Garage v2 API Reference

## Admin API v2

**Base URL:** `http://host:3903`
**Auth:** `Authorization: Bearer <admin_token>`

All Admin API endpoints use the `/v2/` prefix. Methods are POST unless noted.

### Cluster

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v2/GetClusterStatus` | Node list and layout version |
| GET | `/v2/GetClusterHealth` | Quorum status, node counts, partition health |
| GET | `/v2/GetClusterStatistics` | Freeform cluster stats |
| POST | `/v2/ConnectClusterNodes` | Connect to other nodes |

```typescript
// GetClusterHealth response
{
  status: "healthy" | "degraded" | "unavailable",
  knownNodes: number,
  connectedNodes: number,
  storageNodes: number,
  storageNodesUp: number,
  partitions: number,
  partitionsQuorum: number,
  partitionsAllOk: number
}
```

### Layout

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v2/GetClusterLayout` | Current layout with roles and staged changes |
| GET | `/v2/GetClusterLayoutHistory` | Layout version history |
| POST | `/v2/UpdateClusterLayout` | Stage role changes (assign node to zone) |
| POST | `/v2/ApplyClusterLayout` | Apply staged changes (requires version number) |
| POST | `/v2/PreviewClusterLayoutChanges` | Preview without applying |
| POST | `/v2/RevertClusterLayout` | Clear staged changes |
| POST | `/v2/ClusterLayoutSkipDeadNodes` | Force layout progress past dead nodes |

```typescript
// UpdateClusterLayout request — assign a node
{ id: "<node-id>", zone: "dc1", capacity: 1073741824, tags: ["fast"] }

// UpdateClusterLayout request — remove a node
{ id: "<node-id>", remove: true }

// ApplyClusterLayout request
{ version: 1 }
```

### Access Keys

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v2/ListKeys` | List all keys (id, name, expired) |
| POST | `/v2/CreateKey` | Create key (returns secret — shown once) |
| GET | `/v2/GetKeyInfo?id=<id>` | Get key details |
| GET | `/v2/GetKeyInfo?search=<name>` | Find key by name |
| POST | `/v2/UpdateKey?id=<id>` | Update key name or permissions |
| POST | `/v2/DeleteKey?id=<id>` | Delete a key |
| POST | `/v2/ImportKey` | Import existing key pair |

```typescript
// CreateKey request
{ name: "my-app-key" }

// CreateKey response (secret shown only once)
{
  accessKeyId: "GK...",
  secretAccessKey: "...",
  name: "my-app-key",
  permissions: { createBucket: false },
  buckets: []
}

// GetKeyInfo response
{
  accessKeyId: "GK...",
  name: "my-app-key",
  secretAccessKey: null, // only shown with ?showSecretKey=true
  permissions: { createBucket: false },
  buckets: [{ id: "...", globalAliases: ["my-bucket"], localAliases: [], permissions: { read: true, write: true, owner: false } }]
}

// ImportKey request
{ accessKeyId: "GK...", secretAccessKey: "...", name: "imported-key" }
```

### Buckets

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v2/ListBuckets` | List all buckets |
| POST | `/v2/CreateBucket` | Create bucket with optional alias |
| GET | `/v2/GetBucketInfo?id=<id>` | Get bucket by ID |
| GET | `/v2/GetBucketInfo?globalAlias=<alias>` | Get bucket by alias |
| POST | `/v2/UpdateBucket?id=<id>` | Update website access or quotas |
| POST | `/v2/DeleteBucket?id=<id>` | Delete bucket (must be empty) |
| POST | `/v2/CleanupIncompleteUploads` | Abort old multipart uploads |
| GET | `/v2/InspectObject?bucketId=<id>&key=<key>` | Inspect object versions/metadata |

```typescript
// CreateBucket request
{ globalAlias: "my-bucket" }

// CreateBucket with local alias
{ localAlias: { accessKeyId: "GK...", alias: "my-local-name", permissions: { read: true, write: true, owner: true } } }

// GetBucketInfo response
{
  id: "...",
  created: "2024-01-01T00:00:00Z",
  globalAliases: ["my-bucket"],
  websiteAccess: false,
  keys: [{ accessKeyId: "GK...", name: "key-name", permissions: { read: true, write: true, owner: true } }],
  objects: 1234,
  bytes: 5678901,
  quotas: { maxSize: null, maxObjects: null }
}

// UpdateBucket request
{ websiteAccess: true, quotas: { maxSize: 10737418240 } }

// CleanupIncompleteUploads request
{ bucketId: "...", olderThanSecs: 86400 }
// Response: { uploadsDeleted: 3 }
```

### Permissions

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/v2/AllowBucketKey` | Grant permissions (flags set to true are activated; others unchanged) |
| POST | `/v2/DenyBucketKey` | Revoke permissions (flags set to true are deactivated) |

```typescript
// AllowBucketKey request
{
  bucketId: "...",
  accessKeyId: "GK...",
  permissions: { read: true, write: true, owner: false }
}
// Response: GetBucketInfoResponse
```

### Bucket Aliases

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/v2/AddBucketAlias` | Add global or local alias |
| POST | `/v2/RemoveBucketAlias` | Remove global or local alias |

### Admin Tokens

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v2/ListAdminTokens` | List all admin tokens |
| POST | `/v2/CreateAdminToken` | Create scoped token (secret shown once) |
| GET | `/v2/GetAdminTokenInfo?id=<id>` | Get token info |
| GET | `/v2/GetCurrentAdminTokenInfo` | Get calling token info |
| POST | `/v2/UpdateAdminToken?id=<id>` | Update token name/scope |
| POST | `/v2/DeleteAdminToken?id=<id>` | Delete token |

```typescript
// CreateAdminToken request
{ name: "deploy-key", scope: ["ReadClusterStatus", "ReadBucketInfo"] }
// Response includes secretToken (shown only once)
```

### Node Operations

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v2/GetNodeInfo?node=<id|self|*>` | Node version, DB engine, features |
| GET | `/v2/GetNodeStatistics?node=<id>` | Node-level stats |
| POST | `/v2/CreateMetadataSnapshot?node=<id>` | Trigger metadata snapshot |
| POST | `/v2/LaunchRepairOperation?node=<id>` | Launch repair |

### Health & Metrics

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Returns 200 if quorum OK, 503 otherwise |
| GET | `/metrics` | Prometheus-format metrics |
| GET | `/check?domain=<domain>` | Check if domain maps to a website bucket |

### CORS Configuration (via Admin API)

```typescript
// PUT /v2/PutBucketCorsConfiguration?id=<bucketId>
// Body:
{
  corsRules: [{
    allowedOrigins: ["http://localhost:3080", "https://s-nc.org"],
    allowedMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
    allowedHeaders: ["*"],
    exposeHeaders: ["ETag", "x-amz-request-id"],
    maxAgeSeconds: 3600
  }]
}
```

---

## S3 API Compatibility

**Base URL:** `http://host:3900`
**Auth:** AWS Signature v4 (v2 not supported)
**URL Style:** Path-style (`host/bucket/key`) or virtual-hosted (`bucket.host/key` with `root_domain` config)

### Fully Supported Operations

| Category | Operations |
|----------|-----------|
| **Bucket** | CreateBucket, DeleteBucket, HeadBucket, ListBuckets |
| **Object** | GetObject, PutObject, DeleteObject, DeleteObjects, CopyObject, HeadObject, PostObject |
| **Listing** | ListObjects, ListObjectsV2 |
| **Multipart** | CreateMultipartUpload, AbortMultipartUpload, CompleteMultipartUpload, ListMultipartUploads, ListParts, UploadPart, UploadPartCopy |
| **CORS** | PutBucketCors, GetBucketCors, DeleteBucketCors |
| **Presigned URLs** | Full support (GET and PUT) |
| **Encryption** | SSE-C (client-managed keys) |

### Partially Supported

| Operation | Limitation |
|-----------|-----------|
| PutBucketWebsite | Stores index/error doc only; redirects not supported |
| PutBucketLifecycleConfiguration | Only `AbortIncompleteMultipartUpload` and `Expiration` actions |
| ListObjects (v1) | Potential encoding bugs with `encoding-type=url` |

### Not Supported (returns 501)

| Category | Operations |
|----------|-----------|
| **ACLs** | GetBucketAcl, PutBucketAcl, GetObjectAcl, PutObjectAcl |
| **Policies** | GetBucketPolicy, PutBucketPolicy, DeleteBucketPolicy |
| **Versioning** | GetBucketVersioning, PutBucketVersioning, ListObjectVersions |
| **Replication** | All replication operations |
| **Locking** | Object lock, legal hold, retention |
| **Tagging** | Bucket and object tagging |
| **Encryption** | Bucket-level encryption config (SSE-S3, SSE-KMS) |
| **Analytics** | Metrics, logging, analytics, inventory |
| **Notifications** | Event notifications |
| **Other** | Accelerate, Intelligent-Tiering, Public Access Block, Select |

### Multipart Upload

Full support for chunked uploads:

```typescript
import { CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand, ListPartsCommand } from "@aws-sdk/client-s3"

// 1. Initiate
const { UploadId } = await s3.send(new CreateMultipartUploadCommand({
  Bucket: "my-bucket", Key: "large-file.mp4", ContentType: "video/mp4"
}))

// 2. Upload parts (minimum 5MB per part except last)
const { ETag } = await s3.send(new UploadPartCommand({
  Bucket: "my-bucket", Key: "large-file.mp4", UploadId, PartNumber: 1, Body: chunk
}))

// 3. Complete
await s3.send(new CompleteMultipartUploadCommand({
  Bucket: "my-bucket", Key: "large-file.mp4", UploadId,
  MultipartUpload: { Parts: [{ PartNumber: 1, ETag }] }
}))

// Abort if needed
await s3.send(new AbortMultipartUploadCommand({
  Bucket: "my-bucket", Key: "large-file.mp4", UploadId
}))
```

### Server-Side Streaming Upload (`@aws-sdk/lib-storage`)

High-level `Upload` utility that automatically handles multipart chunking for server-side uploads. Streams data in chunks instead of buffering the entire file into memory. Compatible with Garage's multipart S3 API.

**Package:** `@aws-sdk/lib-storage` (must be installed separately from `@aws-sdk/client-s3`)

```typescript
import { Upload } from "@aws-sdk/lib-storage";
import { S3Client } from "@aws-sdk/client-s3";
import { createReadStream } from "node:fs";
```

**Types:**

```typescript
interface Options extends Partial<Configuration> {
  client: S3Client;
  params: PutObjectCommandInput &
    Partial<CreateMultipartUploadCommandInput & UploadPartCommandInput & CompleteMultipartUploadCommandInput>;
}

interface Configuration {
  queueSize: number;         // Concurrent part uploads (default: 4)
  partSize: number;          // Bytes per chunk (minimum 5MB, default: 5MB)
  leavePartsOnError: boolean; // Skip abort on failure (default: false)
  tags: Tag[];               // Tags to attach after upload
  abortController?: AbortController;
}

interface Progress {
  loaded?: number;   // Bytes transferred so far
  total?: number;    // Total bytes (if known)
  part?: number;     // Current part number
  Key?: string;      // S3 object key
  Bucket?: string;   // S3 bucket name
}
```

**Usage:**

```typescript
// Stream a file to S3 without buffering into memory
const upload = new Upload({
  client: s3Client,
  params: {
    Bucket: "my-bucket",
    Key: "large-file.mp4",
    ContentType: "video/mp4",
    Body: createReadStream("/tmp/large-file.mp4"),
  },
  // Optional: tune chunk size and concurrency
  partSize: 10 * 1024 * 1024, // 10MB chunks
  queueSize: 4,                // 4 concurrent uploads
});

// Optional: track progress
upload.on("httpUploadProgress", (progress: Progress) => {
  console.log(`${progress.loaded}/${progress.total} bytes`);
});

// Wait for completion — returns CompleteMultipartUploadCommandOutput
const result = await upload.done();

// Abort if needed
await upload.abort();
```

**Behavior:**
- For small files (fits in one `partSize`), uses a single `PutObjectCommand` internally
- For large files, automatically creates multipart upload, uploads parts concurrently, and completes
- `partSize` minimum is 5MB (S3 requirement); if set lower, it's clamped to 5MB
- If file size > `partSize * 10000`, `partSize` is auto-increased (S3 allows max 10,000 parts)
- `leavePartsOnError: false` (default) aborts the multipart upload on failure, cleaning up parts
- Body accepts: `ReadableStream`, Node.js `Readable`, `Buffer`, `Uint8Array`, `string`, `Blob`
- Uses the same `S3Client` instance as other operations — no separate client needed

**Garage compatibility:** Fully compatible — Garage supports all required multipart operations (`CreateMultipartUpload`, `UploadPart`, `CompleteMultipartUpload`, `AbortMultipartUpload`).

### Presigned URLs

```typescript
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3"

// Download URL (GET)
const downloadUrl = await getSignedUrl(s3, new GetObjectCommand({
  Bucket: "my-bucket", Key: "file.pdf"
}), { expiresIn: 3600 })

// Upload URL (PUT) — for direct browser-to-storage uploads
const uploadUrl = await getSignedUrl(s3, new PutObjectCommand({
  Bucket: "my-bucket", Key: "uploads/new-file.pdf", ContentType: "application/pdf"
}), { expiresIn: 3600 })
```

### Lifecycle Rules

```typescript
import { PutBucketLifecycleConfigurationCommand } from "@aws-sdk/client-s3"

await s3.send(new PutBucketLifecycleConfigurationCommand({
  Bucket: "my-bucket",
  LifecycleConfiguration: {
    Rules: [{
      ID: "abort-incomplete-uploads",
      Status: "Enabled",
      Filter: { Prefix: "" },
      AbortIncompleteMultipartUpload: { DaysAfterInitiation: 1 }
    }, {
      ID: "expire-temp-files",
      Status: "Enabled",
      Filter: { Prefix: "tmp/" },
      Expiration: { Days: 7 }
    }]
  }
}))
```

### Configuration Reference (garage.toml)

```toml
metadata_dir = "/var/lib/garage/meta"
data_dir = "/var/lib/garage/data"
db_engine = "lmdb"                    # lmdb (faster) or sqlite

replication_factor = 1                 # 1 for dev, 2+ for production
consistency_mode = "consistent"        # "consistent" or "degraded"

rpc_secret = "<64-hex-chars>"          # Shared secret for inter-node RPC
rpc_bind_addr = "[::]:3901"

[s3_api]
s3_region = "garage"
api_bind_addr = "[::]:3900"
root_domain = ".s3.garage.localhost"   # For virtual-hosted-style URLs

[s3_web]
bind_addr = "[::]:3902"               # Static website hosting
root_domain = ".web.garage.localhost"

[admin]
api_bind_addr = "[::]:3903"
admin_token = "<token>"                # Bearer token for admin API
metrics_token = "<token>"              # Bearer token for /metrics
```
