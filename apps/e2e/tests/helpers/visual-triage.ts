import type { Locator, Page, TestInfo } from "@playwright/test";

/**
 * Visual-triage capture for the L4 "agent eyeballs" capability.
 *
 * This is advisory triage/debugging ONLY — it is never a CI gate and never
 * replaces a deterministic Playwright assertion. L3 (`<video>` readyState +
 * currentTime) remains the hard playback gate. A vision-capable agent inspects
 * the captured image after the run via the documented runbook in
 * `apps/e2e/README.md`; the result is evidence for debugging, not pass/fail.
 */

const PLAYER_SELECTOR = "[data-media-player]";
const PLAYER_VIDEO_SELECTOR = `${PLAYER_SELECTOR} video`;

export type VisualTriageCapture = {
  kind: string;
  pageUrl: string;
  selector: string;
  fallbackUsed: boolean;
  capturedAt: string;
  triageQuestion: string;
  expectationHint: string;
  nonGatePolicy: "advisory-triage-only";
};

/**
 * Resolve the most specific useful locator for the rendered surface.
 * Playback-first: the native `<video>` inside the Vidstack player; falls back to
 * the whole `[data-media-player]` element when no video is mounted.
 */
const resolveTargetLocator = (page: Page): { locator: Locator; selector: string; fallbackUsed: boolean } => {
  const primary = page.locator(PLAYER_VIDEO_SELECTOR).first();
  return { locator: primary, selector: PLAYER_VIDEO_SELECTOR, fallbackUsed: false };
};

/**
 * Capture a targeted PNG artifact of the rendered surface and attach it (plus a
 * JSON metadata sidecar) to the test result so the existing triage reporter
 * surfaces it for post-run vision inspection.
 *
 * Safe to call from a spec or a failure path; never throws into the test flow —
 * a capture miss degrades to "no targeted artifact" rather than failing the run.
 */
export const captureVisualTriageArtifact = async (
  page: Page,
  testInfo: TestInfo,
  options: {
    kind?: string;
    triageQuestion?: string;
    expectationHint?: string;
  } = {},
): Promise<void> => {
  const kind = options.kind ?? "player-frame";
  const slug = `${kind}-${testInfo.testId}`;

  const { locator, selector, fallbackUsed } = resolveTargetLocator(page);
  const meta: VisualTriageCapture = {
    kind,
    pageUrl: page.url(),
    selector,
    fallbackUsed,
    capturedAt: new Date().toISOString(),
    triageQuestion:
      options.triageQuestion ??
      "Does this image show real rendered video content rather than a black/blank frame, and is it plausibly the expected creator playback scene?",
    expectationHint: options.expectationHint ?? "Expected: Maya / Studio Tour creator playback scene (coarse only).",
    nonGatePolicy: "advisory-triage-only",
  };

  try {
    const count = await locator.count();
    if (count === 0) {
      // Nothing to capture — fall back to the full player element so triage still
      // gets a focused image rather than nothing.
      const fallback = page.locator(PLAYER_SELECTOR).first();
      const fallbackCount = await fallback.count();
      if (fallbackCount === 0) return;
      await testInfo.attach(`vision-target:${slug}`, {
        body: await fallback.screenshot(),
        contentType: "image/png",
      });
      meta.selector = PLAYER_SELECTOR;
      meta.fallbackUsed = true;
    } else {
      await testInfo.attach(`vision-target:${slug}`, {
        body: await locator.screenshot(),
        contentType: "image/png",
      });
    }
    await testInfo.attach(`vision-target-meta:${slug}`, {
      body: JSON.stringify(meta, null, 2),
      contentType: "application/json",
    });
  } catch {
    // A capture miss must never fail the test. The triage reporter still
    // surfaces whatever artifacts Playwright retained on its own.
  }
};
