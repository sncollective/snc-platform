#!/usr/bin/env bash
set -euo pipefail

echo "Starting live test stream to Liquidsoap RTMP input (port 1936)..."
echo "Liquidsoap should switch from playlist to this live source."
echo "Press Ctrl+C to stop — Liquidsoap should switch back to playlist."
echo ""

ffmpeg -re \
  -f lavfi -i "testsrc2=size=1280x720:rate=30" \
  -f lavfi -i "sine=frequency=1000:sample_rate=44100" \
  -c:v libx264 -preset ultrafast -tune zerolatency -g 60 \
  -c:a aac -b:a 128k \
  -f flv "rtmp://localhost:1936/live/stream"
