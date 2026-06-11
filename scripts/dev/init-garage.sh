#!/usr/bin/env bash
# Initialize Garage dev instance — layout, bucket, and API key.
# Idempotent: safe to run multiple times. Skips steps that are already done.
# Uses the Garage CLI via docker exec (more reliable than the admin HTTP API).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

CONTAINER="snc-garage"
GARAGE="docker exec $CONTAINER /garage"
BUCKET="snc-storage"
KEY_NAME="snc-dev-key"

# Deterministic dev credentials — committed to .env.example so `cp .env.example .env`
# is a complete bootstrap. Garage in dev only listens on localhost, so these aren't
# a real exposure. Rotate (and update .env.example) if Garage is ever exposed beyond
# localhost.
DEV_KEY_ID="GKdeadbeefdeadbeefdeadbeef"
DEV_SECRET="deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"
IMGPROXY_KEY_ID="GKfeedfacefeedfacefeedface"
IMGPROXY_SECRET="feedfacefeedfacefeedfacefeedfacefeedfacefeedfacefeedfacefeedface"

# Wait for Garage to be reachable
echo "Waiting for Garage..."
for i in $(seq 1 30); do
  if $GARAGE stats >/dev/null 2>&1; then
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "ERROR: Garage not reachable after 30s"
    exit 1
  fi
  sleep 1
done
echo "Garage ready"

# Apply layout if not yet configured
LAYOUT_VERSION=$($GARAGE layout show 2>&1 | grep "Current cluster layout version:" | awk '{print $NF}' || echo "0")

if [ "$LAYOUT_VERSION" -eq 0 ]; then
  echo "Configuring Garage layout..."

  # Get the node ID (first 16 hex chars from status output)
  NODE_ID=$($GARAGE status 2>&1 | grep -oP '^[0-9a-f]{16}' | head -1)

  if [ -z "$NODE_ID" ]; then
    echo "ERROR: Could not determine Garage node ID"
    exit 1
  fi

  echo "Node ID: $NODE_ID"

  $GARAGE layout assign "$NODE_ID" -z dev -c 1G -t dev 2>&1 | tail -1
  $GARAGE layout apply --version 1 2>&1 | tail -3

  echo "Layout applied"
else
  echo "Layout already configured (version $LAYOUT_VERSION)"
fi

# Import deterministic dev API key, re-importing if the existing key drifted from
# the expected deterministic ID (e.g., volume predates the deterministic-keys pivot).
existing_id=$($GARAGE key info "$KEY_NAME" 2>/dev/null | awk '/^Key ID:/ {print $3; exit}')
if [ "$existing_id" = "$DEV_KEY_ID" ]; then
  echo "API key '$KEY_NAME' already imported with deterministic ID"
elif [ -n "$existing_id" ]; then
  echo "API key '$KEY_NAME' has drifted ID ($existing_id) — re-importing deterministic ID"
  $GARAGE key delete --yes "$KEY_NAME" 2>&1 | tail -1
  $GARAGE key import --yes -n "$KEY_NAME" "$DEV_KEY_ID" "$DEV_SECRET" 2>&1 | tail -1
else
  echo "Importing dev API key '$KEY_NAME'..."
  $GARAGE key import --yes -n "$KEY_NAME" "$DEV_KEY_ID" "$DEV_SECRET" 2>&1 | tail -1
fi

# Create bucket if it doesn't exist
if $GARAGE bucket info "$BUCKET" >/dev/null 2>&1; then
  echo "Bucket '$BUCKET' already exists"
else
  echo "Creating bucket '$BUCKET'..."
  $GARAGE bucket create "$BUCKET" 2>&1 | tail -1
  echo "Bucket '$BUCKET' created"
fi

# Ensure dev key has owner access on the bucket (idempotent — re-allowing is a no-op)
$GARAGE bucket allow --read --write --owner "$BUCKET" --key "$KEY_NAME" 2>&1 | tail -1

# Configure CORS for browser uploads via S3 PutBucketCors (idempotent)
# Uses the S3 API from the host, not docker exec (Garage image has no wget/curl).
echo "Configuring CORS on bucket '$BUCKET'..."

# S3 credentials come from env or the .env file
S3_AK="${S3_ACCESS_KEY_ID:-}"
S3_SK="${S3_SECRET_ACCESS_KEY:-}"

# Fall back to reading from the repo .env if not in env
if [ -z "$S3_AK" ] && [ -f "$REPO_ROOT/.env" ]; then
  S3_AK=$(grep '^S3_ACCESS_KEY_ID=' "$REPO_ROOT/.env" 2>/dev/null | cut -d= -f2 || true)
  S3_SK=$(grep '^S3_SECRET_ACCESS_KEY=' "$REPO_ROOT/.env" 2>/dev/null | cut -d= -f2 || true)
fi

if [ -n "$S3_AK" ] && [ -n "$S3_SK" ]; then
  # Use Node.js with @aws-sdk/client-s3 from the platform API workspace
  # Run from apps/api/ where @aws-sdk/client-s3 is installed.
  # Anchored at $REPO_ROOT so this works from any CWD.
  API_DIR="$(cd "$REPO_ROOT/apps/api" 2>/dev/null && pwd || echo "")"
  if [ -n "$API_DIR" ]; then
    (cd "$API_DIR" && \
    S3_ACCESS_KEY_ID="$S3_AK" S3_SECRET_ACCESS_KEY="$S3_SK" S3_BUCKET="$BUCKET" \
    node --experimental-strip-types -e "
      import { S3Client, PutBucketCorsCommand } from '@aws-sdk/client-s3';
      const client = new S3Client({
        endpoint: 'http://localhost:3900',
        region: 'garage',
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        },
        forcePathStyle: true,
      });
      await client.send(new PutBucketCorsCommand({
        Bucket: process.env.S3_BUCKET,
        CORSConfiguration: {
          CORSRules: [{
            AllowedOrigins: ['*'],
            AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
            AllowedHeaders: ['*'],
            ExposeHeaders: ['ETag', 'x-amz-request-id'],
            MaxAgeSeconds: 3600,
          }],
        },
      }));
    ") && echo "CORS configured" || echo "CORS setup failed (S3 API error — check credentials)"
  else
    echo "CORS skipped — apps/api/ not found"
  fi
else
  echo "CORS skipped — S3 credentials not yet available (add S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY to .env, then re-run)"
fi

# ── Create read-only API key for imgproxy ──

IMGPROXY_KEY_NAME="imgproxy-reader"

existing_imgproxy_id=$($GARAGE key info "$IMGPROXY_KEY_NAME" 2>/dev/null | awk '/^Key ID:/ {print $3; exit}')
if [ "$existing_imgproxy_id" = "$IMGPROXY_KEY_ID" ]; then
  echo "API key '$IMGPROXY_KEY_NAME' already imported with deterministic ID"
elif [ -n "$existing_imgproxy_id" ]; then
  echo "API key '$IMGPROXY_KEY_NAME' has drifted ID ($existing_imgproxy_id) — re-importing deterministic ID"
  $GARAGE key delete --yes "$IMGPROXY_KEY_NAME" 2>&1 | tail -1
  $GARAGE key import --yes -n "$IMGPROXY_KEY_NAME" "$IMGPROXY_KEY_ID" "$IMGPROXY_SECRET" 2>&1 | tail -1
else
  echo "Importing read-only dev API key '$IMGPROXY_KEY_NAME'..."
  $GARAGE key import --yes -n "$IMGPROXY_KEY_NAME" "$IMGPROXY_KEY_ID" "$IMGPROXY_SECRET" 2>&1 | tail -1
fi

# Ensure imgproxy key has read access on the bucket (idempotent)
$GARAGE bucket allow --read "$BUCKET" --key "$IMGPROXY_KEY_NAME" 2>&1 | tail -1

echo "Garage dev setup complete"
