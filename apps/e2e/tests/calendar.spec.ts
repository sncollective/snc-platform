import { test, expect } from "@playwright/test";

test.describe("Calendar", () => {
  test.use({ storageState: "auth/stakeholder.json" });

  test("loads calendar page with grid and filters", async ({ page }) => {
    await page.goto("/calendar");

    // Page heading
    await expect(
      page.getByRole("heading", { name: "Calendar", exact: true }),
    ).toBeVisible();

    // View toggle
    await expect(page.getByRole("button", { name: "Month" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Timeline" })).toBeVisible();

    // Calendar grid
    await expect(page.getByRole("table", { name: "Calendar grid" })).toBeVisible();

    // Filter controls
    await expect(page.getByLabel("Filter by event type")).toBeVisible();
    await expect(page.getByLabel("Filter by creator")).toBeVisible();

    // New Event button exists
    await expect(page.getByRole("button", { name: "New Event" })).toBeVisible();
  });
});
