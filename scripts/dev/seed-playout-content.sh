#!/usr/bin/env bash
set -euo pipefail

# ── Config ──

TEMP_DIR="/tmp/snc-playout-seed"
S3_BUCKET="snc-storage"
S3_PREFIX="playout"

# Read S3 credentials from the repo .env
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# S3 credentials are loaded by the Node.js upload script below via dotenv.
# Shell only needs TEMP_DIR, S3_BUCKET, S3_PREFIX (set above).

mkdir -p "$TEMP_DIR"

# ── Generate Test Clips ──

echo "Generating test clips..."

# Clip 1: Blue bars with 440Hz tone (30s)
ffmpeg -y -f lavfi -i "testsrc2=size=1280x720:rate=30:duration=30" \
  -f lavfi -i "sine=frequency=440:sample_rate=44100:duration=30" \
  -c:v libx264 -preset ultrafast -crf 23 -c:a aac -b:a 128k \
  -movflags +faststart "$TEMP_DIR/clip-01-bars.mp4" 2>/dev/null

# Clip 2: Color bars with 880Hz tone (30s)
ffmpeg -y -f lavfi -i "smptebars=size=1280x720:rate=30:duration=30" \
  -f lavfi -i "sine=frequency=880:sample_rate=44100:duration=30" \
  -c:v libx264 -preset ultrafast -crf 23 -c:a aac -b:a 128k \
  -movflags +faststart "$TEMP_DIR/clip-02-smpte.mp4" 2>/dev/null

# Clip 3: Color source with 660Hz tone (30s)
ffmpeg -y -f lavfi -i "color=c=blue:size=1280x720:rate=30:duration=30,drawtext=text='S/NC TV':fontsize=72:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2" \
  -f lavfi -i "sine=frequency=660:sample_rate=44100:duration=30" \
  -c:v libx264 -preset ultrafast -crf 23 -c:a aac -b:a 128k \
  -movflags +faststart "$TEMP_DIR/clip-03-color.mp4" 2>/dev/null

echo "Generated 3 test clips in $TEMP_DIR"

# ── Upload to S3 ──

echo "Uploading to S3..."

# Use node with @aws-sdk to upload (AWS CLI not available in dev container).
# dotenv loads S3 credentials from the repo .env automatically.
TEMP_DIR="$TEMP_DIR" S3_BUCKET="$S3_BUCKET" S3_PREFIX="$S3_PREFIX" \
  REPO_ROOT="$REPO_ROOT" \
  node --input-type=module <<'UPLOAD_SCRIPT'
import "dotenv/config";
import { config } from "dotenv";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createReadStream, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Load platform/.env (dotenv/config loads .env from cwd; also load explicit path)
config({ path: join(process.env.REPO_ROOT, ".env") });

const client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

const tempDir = process.env.TEMP_DIR;
const bucket = process.env.S3_BUCKET;
const prefix = process.env.S3_PREFIX;

const files = readdirSync(tempDir).filter(f => f.endsWith(".mp4"));

for (const file of files) {
  const filePath = join(tempDir, file);
  const key = `${prefix}/${file}`;
  const size = statSync(filePath).size;

  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: createReadStream(filePath),
    ContentType: "video/mp4",
    ContentLength: size,
  }));

  console.log(`  Uploaded: ${key} (${(size / 1024 / 1024).toFixed(1)} MB)`);
}

console.log(`Done — ${files.length} clips uploaded to s3://${bucket}/${prefix}/`);
UPLOAD_SCRIPT

# ── Cleanup ──

rm -rf "$TEMP_DIR"
echo "Temp files cleaned up."
