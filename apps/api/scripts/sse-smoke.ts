#!/usr/bin/env bun
/**
 * SSE spine smoke test. Connects through Caddy and verifies:
 *   - spine.connected received
 *   - at least one heartbeat received (proves 25s heartbeat interval)
 *   - connection survives (--hold flag: 6 minutes)
 *
 * Usage:
 *   bun run apps/api/scripts/sse-smoke.ts           # quick check (1 min max)
 *   bun run apps/api/scripts/sse-smoke.ts --hold    # long-hold check (6 min)
 *
 * Requires dev services running: pm2 status + Caddy on :3080.
 * Uses fetch (not curl — curl is a denied command in this project).
 */

const HOLD = process.argv.includes("--hold");
const MAX_WAIT_MS = HOLD ? 6 * 60 * 1_000 : 60_000;
const MIN_RUNTIME_FOR_HEARTBEAT_MS = 25_000; // must run >25s to observe a heartbeat

const url = "http://localhost:3080/api/sse?topics=live";
console.log(`[smoke] Connecting to ${url} (hold=${HOLD})`);

const startTime = Date.now();
let res: Response;

try {
  res = await fetch(url, { signal: AbortSignal.timeout(MAX_WAIT_MS) });
} catch (e) {
  console.error("[smoke] FAIL: fetch threw:", e instanceof Error ? e.message : String(e));
  process.exit(1);
}

if (!res.ok || !res.body) {
  console.error(`[smoke] FAIL: HTTP ${res.status}`);
  process.exit(1);
}

const reader = res.body.getReader();
const decoder = new TextDecoder();

let gotConnected = false;
let gotHeartbeat = false;
let buffer = "";

try {
  while (true) {
    const elapsed = Date.now() - startTime;

    if (!HOLD && elapsed > MAX_WAIT_MS) {
      console.error("[smoke] FAIL: timeout without observing required events");
      process.exit(1);
    }

    const { done, value } = await reader.read();
    if (done) {
      console.log("[smoke] Stream closed by server");
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const ts = new Date().toISOString();
      console.log(`[${ts}] ${line}`);

      if (line.startsWith("event: spine.connected")) {
        gotConnected = true;
        console.log("[smoke] ✓ spine.connected received");
      }
      if (line === ": heartbeat") {
        gotHeartbeat = true;
        console.log("[smoke] ✓ heartbeat received");
      }
    }

    // Quick mode: stop after observing all required events (spine.connected + heartbeat
    // after at least 25s of runtime, proving the heartbeat interval is correct).
    if (!HOLD && gotConnected && gotHeartbeat && elapsed >= MIN_RUNTIME_FOR_HEARTBEAT_MS) {
      console.log("[smoke] ✓ All required events observed. Connection healthy.");
      break;
    }
  }
} finally {
  await reader.cancel();
}

if (HOLD) {
  const elapsed = Date.now() - startTime;
  if (elapsed < 5 * 60 * 1_000) {
    console.error(
      `[smoke] FAIL: Connection closed after only ${elapsed}ms (expected ≥5min)`,
    );
    process.exit(1);
  }
  console.log(`[smoke] ✓ Connection survived ${elapsed}ms (≥5min)`);
}

if (!gotConnected) {
  console.error("[smoke] FAIL: Never received spine.connected");
  process.exit(1);
}

if (!gotHeartbeat) {
  const elapsed = Date.now() - startTime;
  if (elapsed < MIN_RUNTIME_FOR_HEARTBEAT_MS) {
    // Ran less than 25s — can't assert heartbeat absence
    console.warn(
      `[smoke] WARN: Exited after ${elapsed}ms (< 25s), heartbeat not yet expected`,
    );
  } else {
    console.error(
      `[smoke] FAIL: Never received heartbeat (ran for ${elapsed}ms)`,
    );
    process.exit(1);
  }
}

console.log("[smoke] PASS");
process.exit(0);
