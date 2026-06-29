import { test, expect } from "@playwright/test";

import {
  fetchChannelHlsUrl,
  fetchCreatorQueueStatus,
  fetchHlsManifestSnapshot,
  queueCreatorContent,
} from "./helpers/playback-probes.js";
import { resetMayaProgramming, seedMayaProgramming } from "./helpers/test-control.js";
import { captureVisualTriageArtifact } from "./helpers/visual-triage.js";

/**
 * Native media-element snapshot read via `page.evaluate`. The hard CI gate is
 * the native `<video>` element only — Vidstack internal state is intentionally
 * avoided so the proof reflects real browser decode, not player intent.
 */
type VideoState = {
  exists: boolean;
  readyState: number;
  currentTime: number;
  paused: boolean;
  ended: boolean;
  errorCode: number | null;
};

const readVideoState = (page: import("@playwright/test").Page) =>
  page.evaluate<VideoState>(() => {
    const video =
      document.querySelector("[data-media-player] video") ??
      document.querySelector("video");
    if (!video) {
      return { exists: false, readyState: 0, currentTime: 0, paused: true, ended: false, errorCode: null };
    }
    const el = video as HTMLVideoElement;
    return {
      exists: true,
      readyState: el.readyState,
      currentTime: el.currentTime,
      paused: el.paused,
      ended: el.ended,
      errorCode: el.error ? el.error.code : null,
    };
  });

const STREAM_PRECONDITION_TIMEOUT_MS = 90_000;
const DECODE_TIMEOUT_MS = 30_000;
const PROGRESS_TIMEOUT_MS = 15_000;
const SETUP_POLL_INTERVALS_MS = [1_000, 2_000, 5_000];
const BROWSER_POLL_INTERVALS_MS = [250, 500, 1_000];

test.describe("Creator-channel browser playback proof (L3 hard gate)", () => {
  test.use({ storageState: "auth/stakeholder.json" });

  test.afterEach(async ({ page, request }, testInfo) => {
    // L4 visual-triage capture: when the browser-decode gate fails, retain a
    // focused player/video artifact so a vision-capable agent can inspect what
    // the user would have seen. Advisory triage only — never a CI gate; L3's
    // readyState + currentTime assertions remain the hard gate.
    if (testInfo.status !== testInfo.expectedStatus) {
      try {
        await captureVisualTriageArtifact(page, testInfo);
      } catch {
        // capture miss must never mask the real failure
      }
    }
    await resetMayaProgramming(request, {
      channelActive: false,
      syncPlaybackEngine: true,
    });
  });

  test("drives the Vidstack <video> element to decode and advance currentTime", async ({
    page,
    request,
  }, testInfo) => {
    test.setTimeout(300_000);
    test.skip(
      testInfo.project.name !== "chromium",
      "Browser decode proof needs a single chromium session to avoid cross-project DB races.",
    );

    // ── Stream preconditions (mirror the L1-L2 proof so this spec is self-contained) ──
    const seed = await seedMayaProgramming(request, {
      pool: true,
      queue: false,
      channelActive: true,
      syncPlaybackEngine: true,
    });
    const authenticatedRequest = page.context().request;

    await queueCreatorContent(authenticatedRequest, seed.channelId, seed.contentId);

    // The creator channel must be genuinely streaming before the browser proof:
    // the queued content is promoted to nowPlaying through the real track-event path.
    await expect
      .poll(
        async () => {
          const status = await fetchCreatorQueueStatus(authenticatedRequest, seed.channelId);
          return status.nowPlaying?.contentId ?? null;
        },
        {
          message: "Liquidsoap track-event should promote Studio Tour to creator nowPlaying",
          timeout: STREAM_PRECONDITION_TIMEOUT_MS,
          intervals: SETUP_POLL_INTERVALS_MS,
        },
      )
      .toBe(seed.contentId);

    let hlsUrl: string | null = null;
    await expect
      .poll(
        async () => {
          hlsUrl = await fetchChannelHlsUrl(request, seed.channelId);
          return hlsUrl;
        },
        {
          message: "Streaming status should expose Maya's creator-channel HLS URL",
          timeout: 30_000,
          intervals: SETUP_POLL_INTERVALS_MS,
        },
      )
      .not.toBeNull();
    if (hlsUrl === null) throw new Error("Streaming status did not expose a creator-channel HLS URL");

    await expect
      .poll(
        async () => {
          const snapshot = await fetchHlsManifestSnapshot(request, hlsUrl!);
          return snapshot.segmentUris.length;
        },
        {
          message: "Creator-channel HLS manifest should publish at least one media segment",
          timeout: STREAM_PRECONDITION_TIMEOUT_MS,
          intervals: SETUP_POLL_INTERVALS_MS,
        },
      )
      .toBeGreaterThan(0);

    // ── Browser decode proof ──
    await page.goto(`/live?channel=${seed.channelId}`);

    // The native <video> element rendered by Vidstack must exist before decode can be claimed.
    await expect
      .poll(
        async () => (await readVideoState(page)).exists,
        {
          message: "Vidstack should mount a native <video> element for the creator channel",
          timeout: DECODE_TIMEOUT_MS,
          intervals: BROWSER_POLL_INTERVALS_MS,
        },
      )
      .toBe(true);

    // Decode proof: the browser has a decodable frame (HAVE_CURRENT_DATA = 2).
    await expect
      .poll(
        async () => (await readVideoState(page)).readyState,
        {
          message: "Native <video> readyState should reach HAVE_CURRENT_DATA (2)",
          timeout: DECODE_TIMEOUT_MS,
          intervals: BROWSER_POLL_INTERVALS_MS,
        },
      )
      .toBeGreaterThanOrEqual(2);

    // Progress proof: currentTime advances over a bounded window after decode is reached.
    const baselineCurrentTime = (await readVideoState(page)).currentTime;

    await expect
      .poll(
        async () => (await readVideoState(page)).currentTime,
        {
          message: "Native <video> currentTime should advance after decode (playback is progressing)",
          timeout: PROGRESS_TIMEOUT_MS,
          intervals: [500, 1_000, 2_000],
        },
      )
      .toBeGreaterThan(baselineCurrentTime);
  });
});
