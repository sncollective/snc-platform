import { test, expect } from "@playwright/test";

test.describe("Live streaming page", () => {
  test("live page loads and shows channel selector", async ({ page }) => {
    await page.goto("/live");
    await expect(page).toHaveURL(/\/live/);
    // Channel selector always present — playout channels are pre-seeded
    await expect(page.getByRole("combobox", { name: "Select channel" })).toBeVisible();
    // S/NC TV playout channel should be listed
    await expect(page.getByRole("option", { name: /S\/NC TV/ })).toBeAttached();
  });

  test("live page is accessible without authentication", async ({ page }) => {
    await page.goto("/live");
    await expect(page).toHaveURL(/\/live/);
    await expect(page.getByRole("combobox", { name: "Select channel" })).toBeVisible();
  });

  test("live page has correct page title", async ({ page }) => {
    await page.goto("/live");
    await expect(page).toHaveTitle(/Live/);
  });
});

test.describe("Live streaming page (authenticated)", () => {
  test.use({ storageState: "auth/stakeholder.json" });

  test("theater mode toggle is present", async ({ page }) => {
    await page.goto("/live");
    await expect(
      page.getByRole("button", { name: "Theater mode" }),
    ).toBeVisible();
  });

  test("chat panel input mounts", async ({ page }) => {
    await page.goto("/live");
    // Chat input has aria-label="Chat message" — render-level check only.
    // WebSocket connectivity is out of scope for this test; the input
    // should be present even in a disconnected state.
    await expect(
      page.getByRole("textbox", { name: "Chat message" }),
    ).toBeVisible();
  });
});
