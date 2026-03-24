import { test, expect } from "@playwright/test";

test.describe("Feature gates", () => {
  // These routes have their feature flags OFF in the staging/production config.
  // /feed is NOT here because FEATURE_CONTENT is ON in staging.
  const DISABLED_ROUTES = ["/studio", "/merch", "/pricing", "/emissions"];

  for (const route of DISABLED_ROUTES) {
    test(`${route} is gated when feature is disabled`, async ({ page }) => {
      const response = await page.goto(route);

      // Should either redirect to home, show Coming Soon, or nav link is disabled
      const url = new URL(page.url());
      const wasRedirected = url.pathname === "/";
      const hasComingSoon = await page
        .getByText("Coming Soon")
        .isVisible()
        .catch(() => false);

      expect(
        wasRedirected || hasComingSoon,
        `Expected ${route} to redirect or show Coming Soon, got ${url.pathname}`,
      ).toBe(true);
    });
  }
});
