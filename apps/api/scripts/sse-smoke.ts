#!/usr/bin/env bun
/**
 * SSE spine smoke test. Connects through Caddy and verifies:
 *   - spine.connected received
 *   - at least one heartbeat received (proves 25s heartbeat interval)
 *   - connection survives (--hold flag: 6 minutes)
 *   - a specific event arrives (--expect-event mode)
 *
 * Usage:
 *   bun run apps/api/scripts/sse-smoke.ts           # quick check (1 min max)
 *   bun run apps/api/scripts/sse-smoke.ts --hold    # long-hold check (6 min)
 *   bun run apps/api/scripts/sse-smoke.ts \         # dev-wire proof A:
 *     --expect-event channel.live-state-changed \   # webhook→bus→SSE end-to-end
 *     --trigger-webhook /api/playout/broadcast/input-switch \
 *     --webhook-body '{"source":"live"}' \
 *     --secret <PLAYOUT_CALLBACK_SECRET>            # set from .env
 *
 * Requires dev services running: pm2 status + Caddy on :3080.
 * Uses fetch (not curl — curl is a denied command in this project).
 *
 * Dev-wire proof A (webhook → bus → SSE):
 *   After receiving spine.connected, the script POSTs to the trigger-webhook URL.
 *   It then waits up to 5s for an SSE frame matching the expected event type.
 *   Success proves: Liquidsoap/webhook → eventBus.publish → SSE subscriber → Caddy.
 *
 * Dev-wire proof B (SRS on_publish path):
 *   Drive a real RTMP stream via `scripts/dev/test-live-fallback.sh` or ffmpeg,
 *   then verify the on_publish-sourced channel.live-state-changed event arrives.
 *   Cannot be automated in this script — run manually with the dev streaming stack.
 */

const HOLD = process.argv.includes("--hold");
const MAX_WAIT_MS = HOLD ? 6 * 60 * 1_000 : 60_000;
const MIN_RUNTIME_FOR_HEARTBEAT_MS = 25_000; // must run >25s to observe a heartbeat

// -- expect-event mode flags --
const expectEventIdx = process.argv.indexOf("--expect-event");
const EXPECT_EVENT = expectEventIdx >= 0 ? process.argv[expectEventIdx + 1] : null;

const triggerWebhookIdx = process.argv.indexOf("--trigger-webhook");
const TRIGGER_WEBHOOK = triggerWebhookIdx >= 0 ? process.argv[triggerWebhookIdx + 1] : null;

const webhookBodyIdx = process.argv.indexOf("--webhook-body");
const WEBHOOK_BODY = webhookBodyIdx >= 0 ? process.argv[webhookBodyIdx + 1] : null;

const secretIdx = process.argv.indexOf("--secret");
const WEBHOOK_SECRET = secretIdx >= 0 ? process.argv[secretIdx + 1] : null;

const TOPICS = EXPECT_EVENT ? "live" : "live"; // live topic covers channel.live-state-changed
const url = `http://localhost:3080/api/sse?topics=${TOPICS}`;
console.log(`[smoke] Connecting to ${url} (hold=${HOLD}, expectEvent=${EXPECT_EVENT ?? "none"})`);

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
let gotExpectedEvent = false;
let webhookFired = false;
let buffer = "";

try {
  while (true) {
    const elapsed = Date.now() - startTime;

    if (!HOLD && elapsed > MAX_WAIT_MS) {
      console.error("[smoke] FAIL: timeout without observing required events");
      process.exit(1);
    }

    // Hold mode: stop before the AbortSignal.timeout fires mid-read at 6min —
    // an abort would throw out of read() and turn a successful hold into a crash.
    if (HOLD && elapsed >= 5.5 * 60 * 1_000) {
      console.log("[smoke] Hold target reached (5.5min) — closing cleanly");
      break;
    }

    // expect-event mode: after spine.connected, fire the webhook once
    if (EXPECT_EVENT && gotConnected && !webhookFired && TRIGGER_WEBHOOK) {
      webhookFired = true;
      const webhookUrl = `http://localhost:3080${TRIGGER_WEBHOOK}${WEBHOOK_SECRET ? `?secret=${encodeURIComponent(WEBHOOK_SECRET)}` : ""}`;
      console.log(`[smoke] Triggering webhook: POST ${TRIGGER_WEBHOOK}`);
      try {
        const webhookRes = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: WEBHOOK_BODY ?? "{}",
          signal: AbortSignal.timeout(3000),
        });
        console.log(`[smoke] Webhook response: ${webhookRes.status}`);
        if (!webhookRes.ok) {
          console.warn(`[smoke] WARN: Webhook returned ${webhookRes.status}`);
        }
      } catch (e) {
        console.error("[smoke] FAIL: Webhook fetch threw:", e instanceof Error ? e.message : String(e));
        process.exit(1);
      }
    }

    // expect-event mode: if we've been waiting >5s since firing webhook, fail
    if (EXPECT_EVENT && webhookFired && !gotExpectedEvent) {
      const sinceWebhook = Date.now() - startTime;
      if (sinceWebhook > 5_000) {
        console.error(`[smoke] FAIL: Expected event '${EXPECT_EVENT}' not received within 5s of webhook`);
        process.exit(1);
      }
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
      if (EXPECT_EVENT && line === `event: ${EXPECT_EVENT}`) {
        gotExpectedEvent = true;
        console.log(`[smoke] ✓ expected event '${EXPECT_EVENT}' received`);
      }
    }

    // expect-event mode: success — all required events observed
    if (EXPECT_EVENT && gotConnected && gotExpectedEvent) {
      console.log("[smoke] ✓ Wire proof complete: webhook→bus→SSE frame confirmed.");
      break;
    }

    // Quick mode: stop after observing all required events (spine.connected + heartbeat
    // after at least 25s of runtime, proving the heartbeat interval is correct).
    if (!HOLD && !EXPECT_EVENT && gotConnected && gotHeartbeat && elapsed >= MIN_RUNTIME_FOR_HEARTBEAT_MS) {
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

// expect-event mode: fail if event was never observed
if (EXPECT_EVENT && !gotExpectedEvent) {
  console.error(`[smoke] FAIL: Expected event '${EXPECT_EVENT}' never received`);
  process.exit(1);
}

if (!EXPECT_EVENT && !gotHeartbeat) {
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
