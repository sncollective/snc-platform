import { test, expect } from "@playwright/test";

import {
  fetchChannelHlsUrl,
  fetchCreatorQueueStatus,
  fetchHlsManifestSnapshot,
  queueCreatorContent,
} from "./helpers/playback-probes.js";
import { resetMayaProgramming, seedMayaProgramming } from "./helpers/test-control.js";

const STUDIO_TOUR_TITLE = "Studio Tour 2026";
const PLAYBACK_PROOF_TIMEOUT_MS = 90_000;
const POLL_INTERVALS_MS = [1_000, 2_000, 5_000];

test.describe("Creator-channel queued playback machine proof", () => {
  test.use({ storageState: "auth/stakeholder.json" });

  test.afterEach(async ({ request }) => {
    await resetMayaProgramming(request, {
      channelActive: false,
      syncPlaybackEngine: true,
    });
  });

  test("promotes Maya's queued content to nowPlaying and grows the channel HLS manifest", async ({
    page,
    request,
  }, testInfo) => {
    test.setTimeout(300_000);
    test.skip(
      testInfo.project.name !== "chromium",
      "Creator playback proof mutates Maya's shared queue; chromium-only avoids cross-project DB races.",
    );

    const seed = await seedMayaProgramming(request, {
      pool: true,
      queue: false,
      channelActive: true,
      syncPlaybackEngine: true,
    });
    const authenticatedRequest = page.context().request;

    const queued = await queueCreatorContent(
      authenticatedRequest,
      seed.channelId,
      seed.contentId,
    );
    expect(queued.contentId).toBe(seed.contentId);

    await expect
      .poll(
        async () => {
          const status = await fetchCreatorQueueStatus(authenticatedRequest, seed.channelId);
          return status.nowPlaying?.contentId ?? null;
        },
        {
          message: "Liquidsoap track-event should promote Studio Tour to creator nowPlaying",
          timeout: PLAYBACK_PROOF_TIMEOUT_MS,
          intervals: POLL_INTERVALS_MS,
        },
      )
      .toBe(seed.contentId);

    const queueStatus = await fetchCreatorQueueStatus(authenticatedRequest, seed.channelId);
    expect(queueStatus.nowPlaying?.title).toBe(STUDIO_TOUR_TITLE);

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
          intervals: POLL_INTERVALS_MS,
        },
      )
      .not.toBeNull();

    if (hlsUrl === null) {
      throw new Error("Streaming status did not expose a creator-channel HLS URL");
    }

    let baselineSegments: string[] = [];
    await expect
      .poll(
        async () => {
          const snapshot = await fetchHlsManifestSnapshot(request, hlsUrl!);
          baselineSegments = snapshot.segmentUris;
          return snapshot.segmentUris.length;
        },
        {
          message: "Creator-channel HLS manifest should publish at least one media segment",
          timeout: PLAYBACK_PROOF_TIMEOUT_MS,
          intervals: POLL_INTERVALS_MS,
        },
      )
      .toBeGreaterThan(0);

    const baselineSegmentSet = new Set(baselineSegments);
    await expect
      .poll(
        async () => {
          const snapshot = await fetchHlsManifestSnapshot(request, hlsUrl!);
          return snapshot.segmentUris.filter((uri) => !baselineSegmentSet.has(uri)).length;
        },
        {
          message: "Creator-channel HLS manifest should expose new media segments over time",
          timeout: PLAYBACK_PROOF_TIMEOUT_MS,
          intervals: POLL_INTERVALS_MS,
        },
      )
      .toBeGreaterThan(0);
  });
});
