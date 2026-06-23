---
source_handle: rclone-garage-config
fetched: 2026-06-23
source_url: https://garagehq.deuxfleurs.fr/cookbook/clients.html
provenance: source-direct
---

## Summary

Garage's official documentation provides an rclone configuration template for using rclone with Garage S3. Garage is not in rclone's built-in provider list but works via the `provider = Other` path with `force_path_style = true`.

## Key passages

**Configuration template from Garage documentation:**
```ini
[garage]
type = s3
provider = Other
env_auth = false
access_key_id = <access key>
secret_access_key = <secret key>
region = <region>
endpoint = <endpoint>
force_path_style = true
acl = private
bucket_acl = private
```

**Critical requirement — `force_path_style = true`:** Garage does not support DNS-style bucket addressing (the AWS default). Path-style addressing (e.g., `https://endpoint/bucket/key` rather than `https://bucket.endpoint/key`) must be forced.

**Region:** Set to the configured Garage region (often literally `garage`). Garage documentation notes it "should normally redirect your client to the correct region" — but manual configuration is safer.

**rclone provider selection:** Uses `provider = Other` since Garage has no dedicated rclone backend entry. This is the documented approach from the authoritative source (Garage's own cookbook).

## Structural metadata

- Type: official documentation
- Scope: Garage S3 + rclone configuration
- Format: Garage documentation site
