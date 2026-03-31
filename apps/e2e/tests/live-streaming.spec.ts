import { test, expect } from "@playwright/test";

test.describe("Live streaming page", () => {
  test("live page loads and shows channel content", async ({ page }) => {
    await page.goto("/live");
    // Verify the page loaded (not redirected away from /live)
    await expect(page).toHaveURL(/\/live/);
    // The playout channel (S/NC TV) should always exist, rendering a channel
    // selector. If no streams are active, a "Coming Soon" heading appears.
    await expect(
      page
        .getByLabel("Select channel")
        .or(page.getByRole("heading", { name: "Coming Soon" })),
    ).toBeVisible();
  });

  test("live page is accessible without authentication", async ({ page }) => {
    // No auth state — public access
    await page.goto("/live");
    await expect(page).toHaveURL(/\/live/);
    // Should load normally, not redirect to login
    await expect(
      page
        .getByLabel("Select channel")
        .or(page.getByRole("heading", { name: "Coming Soon" })),
    ).toBeVisible();
  });

  test("live page has correct page title", async ({ page }) => {
    await page.goto("/live");
    await expect(page).toHaveTitle(/Live — S\/NC/);
  });
});

test.describe("Live streaming page (authenticated)", () => {
  test.use({ storageState: "auth/stakeholder.json" });

  test("authenticated user sees live page with chat input", async ({
    page,
  }) => {
    await page.goto("/live");
    await expect(page).toHaveURL(/\/live/);
    // Chat panel should render for authenticated users.
    // When connected, the chat input and send button are visible.
    await expect(page.getByLabel("Chat message")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Send" }),
    ).toBeVisible();
  });

  test("theater mode toggle is present", async ({ page }) => {
    await page.goto("/live");
    await expect(
      page.getByRole("button", { name: "Theater mode" }),
    ).toBeVisible();
  });
});
