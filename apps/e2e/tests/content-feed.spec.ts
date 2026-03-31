import { test, expect } from "@playwright/test";

test.describe("Content feed", () => {
  test("feed page loads with published content", async ({ page }) => {
    await page.goto("/feed");

    await expect(
      page.getByRole("heading", { name: "Content Feed" }),
    ).toBeVisible();

    // Seeded content should be visible (Maya's public items)
    await expect(page.getByText("Midnight Frequencies")).toBeVisible();
  });

  test("feed is accessible without authentication", async ({ page }) => {
    await page.goto("/feed");
    // Should not redirect to login
    await expect(page).toHaveURL(/\/feed/);
    await expect(
      page.getByRole("heading", { name: "Content Feed" }),
    ).toBeVisible();
  });

  test("feed has content type filter buttons", async ({ page }) => {
    await page.goto("/feed");

    // Filter uses toggle buttons in a group
    const filterGroup = page.getByRole("group", { name: /filter by content type/i });
    await expect(filterGroup).toBeVisible();
    await expect(filterGroup.getByRole("button", { name: "All" })).toBeVisible();
    await expect(filterGroup.getByRole("button", { name: "Video" })).toBeVisible();
    await expect(filterGroup.getByRole("button", { name: "Audio" })).toBeVisible();
    await expect(filterGroup.getByRole("button", { name: "Written" })).toBeVisible();
  });

  test("feed shows content from multiple creators", async ({ page }) => {
    await page.goto("/feed");

    // Content from different creators should appear
    await expect(page.getByText("Maya Chen").first()).toBeVisible();
    await expect(page.getByText("Jordan Ellis").first()).toBeVisible();
    await expect(page.getByText("Sam Okafor").first()).toBeVisible();
  });

  test("nav bar has Feed link when content feature is enabled", async ({ page }) => {
    await page.goto("/");

    const nav = page.getByRole("navigation", { name: "Main navigation" });
    await expect(nav.getByRole("link", { name: "Feed" })).toBeVisible();
  });
});
