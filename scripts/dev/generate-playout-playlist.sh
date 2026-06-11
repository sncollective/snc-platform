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

echo "Listing playout content in s3://$S3_BUCKET/$S3_PREFIX/..."

KEYS=$(aws --endpoint-url http://localhost:3900 s3 ls "s3://$S3_BUCKET/$S3_PREFIX/" 2>/dev/null \
  | awk '{print $NF}' \
  | grep '\.mp4$' \
  | sort)

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
