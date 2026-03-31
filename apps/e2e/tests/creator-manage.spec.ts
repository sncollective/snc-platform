import { test, expect } from "@playwright/test";

test.describe("Creator management", () => {
  test.use({ storageState: "auth/stakeholder.json" });

  test("loads tabbed dashboard for Maya", async ({ page }) => {
    await page.goto("/creators/maya-chen/manage");

    // Context nav should show all management tabs
    const sidebar = page.getByRole("navigation", { name: "Maya Chen navigation" });
    await expect(sidebar.getByRole("link", { name: "Overview" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Content" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Streaming" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Settings" })).toBeVisible();

    // Display name visible
    await expect(page.getByText("Maya Chen")).toBeVisible();
  });

  test("settings tab allows profile editing", async ({ page }) => {
    await page.goto("/creators/maya-chen/manage/settings");

    // Bio field should be visible and editable
    const bioField = page.getByLabel(/bio/i);
    await expect(bioField).toBeVisible();
  });
});
