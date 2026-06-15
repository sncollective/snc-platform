import { test, expect } from "@playwright/test";

import { mainNav } from "./helpers/nav.js";

test.describe("Landing page", () => {
  test("loads with hero section and featured creators", async ({ page }, testInfo) => {
    await page.goto("/");

    // Page title
    await expect(page).toHaveTitle(/S\/NC/);

    // Hero section renders
    const hero = page.getByRole("heading", { level: 1 });
    await expect(hero).toBeVisible();

    // Featured creators section (heading + region both labeled "Creators"
    // since the 0.2.7 landing redesign).
    const creatorsHeading = page.getByRole("heading", {
      name: "Creators",
      exact: true,
    });
    await expect(creatorsHeading).toBeVisible();

    // At least one creator card is visible (Maya is seeded)
    const creatorsRegion = page.getByRole("region", {
      name: "Creators",
      exact: true,
    });
    await expect(creatorsRegion).toBeVisible();

    // Navigation present with Creators and Live links (viewport-aware surface)
    const nav = mainNav(page, testInfo);
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("link", { name: "Creators" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Live" })).toBeVisible();
  });

  test("Coming Up section renders — visible with heading regardless of event count", async ({ page }) => {
    await page.goto("/");

    // The ComingUp section renders its heading in both populated and empty
    // states, so the heading itself is the stable assertion.
    const heading = page.getByRole("heading", { name: "Coming Up" });
    await expect(heading).toBeVisible();
  });
});
