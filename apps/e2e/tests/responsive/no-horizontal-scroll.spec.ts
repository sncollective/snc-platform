import { test, expect } from "@playwright/test";

const ROUTES = ["/", "/live", "/creators"];

test.describe("no horizontal scroll at mobile viewport", () => {
  test.use({ viewport: { width: 320, height: 568 } });

  for (const route of ROUTES) {
    test(`${route} has no horizontal overflow`, async ({ page }) => {
      await page.goto(route);
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    });
  }
});
