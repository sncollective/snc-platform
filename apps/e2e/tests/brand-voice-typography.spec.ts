import { expect, test, type Locator, type Page } from "@playwright/test";

async function expectComputedFamily(locator: Locator, family: string): Promise<void> {
  await expect(locator).toBeAttached();
  const computedFamily = await locator.evaluate((element) => getComputedStyle(element).fontFamily);
  expect(computedFamily).toMatch(new RegExp(`^"?${family.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
}

async function probeWebFont(
  page: Page,
  family: string,
  sample: string,
): Promise<{ readonly checked: boolean; readonly loadedFamilies: readonly string[] }> {
  return page.evaluate(async ({ family: faceFamily, sample: faceSample }) => {
    await document.fonts.ready;
    const font = `16px "${faceFamily}"`;
    const loadedFaces = await document.fonts.load(font, faceSample);
    return {
      checked: document.fonts.check(font, faceSample),
      loadedFamilies: loadedFaces.map((face) => face.family),
    };
  }, { family, sample });
}

test.describe("brand voice typography", () => {
  test("renders route families and signature glyph coverage in Chromium", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "One desktop Chromium pass proves computed styles and the browser FontFaceSet contract",
    );

    await page.goto("/");
    await expectComputedFamily(page.getByRole("heading", { level: 1 }), "Source Sans 3 Variable");
    await expectComputedFamily(
      page.getByText(/We're building something different/),
      "Source Sans 3 Variable",
    );
    const parentLatinExt = await probeWebFont(page, "Source Sans 3 Variable", "Žčž");
    expect(parentLatinExt).toEqual({
      checked: true,
      loadedFamilies: ["Source Sans 3 Variable"],
    });

    await page.goto("/studio");
    // Booking is intentionally gated in staging, but the leaf voice boundary still guarantees
    // that the real Coming Soon heading and copy resolve through the Studio family.
    await expect(page.getByRole("heading", { name: "Studio — Coming Soon" })).toBeVisible();
    await expectComputedFamily(
      page.getByRole("heading", { name: "Studio — Coming Soon" }),
      "Newsreader Variable",
    );
    await expectComputedFamily(
      page.getByText(/Recording studio, podcast production/),
      "Newsreader Variable",
    );
    const studioChip = await probeWebFont(page, "Newsreader Variable", "24·96");
    expect(studioChip).toEqual({
      checked: true,
      loadedFamilies: ["Newsreader Variable"],
    });

    await page.goto("/live");
    const liveScope = page.locator('[data-route="tv"]').first();
    await expectComputedFamily(liveScope, "Saira Variable");
    await expectComputedFamily(page.locator('[data-route="tv"] p').first(), "Saira Variable");
    // Scheduled playout has no route heading; when an offline heading is present, prove that
    // element too. The route scope above is the display-family inheritance guarantee otherwise.
    const liveHeading = page.locator('[data-route="tv"] h1').first();
    if (await liveHeading.count()) await expectComputedFamily(liveHeading, "Saira Variable");
    const liveLetters = await probeWebFont(page, "Saira Variable", "LIVE");
    expect(liveLetters).toEqual({
      checked: true,
      loadedFamilies: ["Saira Variable"],
    });
    // The primary Saira cmap intentionally lacks U+25CF; the named Arial fallback owns the dot.
    const liveDotFallback = await probeWebFont(page, "Arial", "●");
    expect(liveDotFallback.checked).toBe(true);

    await page.goto("/creators/animalfuture/press");
    await expectComputedFamily(page.locator("#press-band-name"), "Barlow Condensed");
    await expectComputedFamily(
      page.locator('section[aria-labelledby="press-about-heading"] p').last(),
      "Archivo Variable",
    );
  });
});
