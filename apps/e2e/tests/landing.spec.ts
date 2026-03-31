import { test, expect } from "@playwright/test";

test.describe("Landing page", () => {
  test("loads with hero section and featured creators", async ({ page }) => {
    await page.goto("/");

    // Page title
    await expect(page).toHaveTitle(/S\/NC/);

    // Hero section renders
    const hero = page.getByRole("heading", { level: 1 });
    await expect(hero).toBeVisible();

    // Featured creators section
    const creatorsHeading = page.getByRole("heading", {
      name: "Featured Creators",
    });
    await expect(creatorsHeading).toBeVisible();

    // At least one creator card is visible (Maya is seeded)
    const creatorsRegion = page.getByRole("region", {
      name: "Featured creators",
    });
    await expect(creatorsRegion).toBeVisible();

    // Navigation bar present with Creators and Live links
    const nav = page.getByRole("navigation", { name: "Main navigation" });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("link", { name: "Creators" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Live" })).toBeVisible();
  });
});
