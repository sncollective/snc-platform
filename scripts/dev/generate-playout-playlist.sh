#!/usr/bin/env bash
set -euo pipefail

# ── Config ──

S3_BUCKET="snc-storage"
S3_PREFIX="playout"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OUTPUT_FILE="$REPO_ROOT/liquidsoap/playlist.m3u"

mkdir -p "$(dirname "$OUTPUT_FILE")"

# ── Load S3 credentials ──

cd "$REPO_ROOT/apps/api"

# Extract credentials from .env via dotenv (same source as the API)
export AWS_ACCESS_KEY_ID=$(node -e "require('dotenv').config({path:'../../.env',quiet:true}); process.stdout.write(process.env.S3_ACCESS_KEY_ID || '')" 2>/dev/null)
export AWS_SECRET_ACCESS_KEY=$(node -e "require('dotenv').config({path:'../../.env',quiet:true}); process.stdout.write(process.env.S3_SECRET_ACCESS_KEY || '')" 2>/dev/null)
export AWS_DEFAULT_REGION="garage"

if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
  echo "Error: S3 credentials not found in .env"
  exit 1
fi

# ── List S3 objects and generate s3:// URIs ──
# AWS CLI isn't available in the dev container; list via node + @aws-sdk (same
# approach as seed-playout-content.sh's upload). cwd is already apps/api (set
# above), so dotenv + @aws-sdk resolve there.

echo "Listing playout content in s3://$S3_BUCKET/$S3_PREFIX/..."

KEYS=$(
  S3_BUCKET="$S3_BUCKET" S3_PREFIX="$S3_PREFIX" REPO_ROOT="$REPO_ROOT" \
  node --input-type=module <<'LIST_SCRIPT'
import { config } from "dotenv";
import { join } from "node:path";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

config({ path: join(process.env.REPO_ROOT, ".env"), quiet: true });

const client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

const prefix = process.env.S3_PREFIX;
const out = await client.send(new ListObjectsV2Command({
  Bucket: process.env.S3_BUCKET,
  Prefix: `${prefix}/`,
}));

for (const obj of out.Contents ?? []) {
  const key = obj.Key.slice(`${prefix}/`.length);
  if (key.endsWith(".mp4")) console.log(key);
}
LIST_SCRIPT
)

if [ -z "$KEYS" ]; then
  echo "No MP4 files found in s3://$S3_BUCKET/$S3_PREFIX/"
  echo "Run scripts/dev/seed-playout-content.sh first."
  exit 1
fi

# ── Write M3U playlist with s3:// URIs ──

echo "#EXTM3U" > "$OUTPUT_FILE"

COUNT=0
while IFS= read -r key; do
  echo "s3://$S3_BUCKET/$S3_PREFIX/$key" >> "$OUTPUT_FILE"
  echo "  $key"
  COUNT=$((COUNT + 1))
done <<< "$KEYS"

echo "Playlist written to $OUTPUT_FILE ($COUNT tracks, s3:// URIs)"
echo "Liquidsoap will pick up the playlist on next reload cycle."
