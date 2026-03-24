import { test, expect } from "@playwright/test";

test.describe("Auth guards", () => {
  test("calendar redirects unauthenticated users to login", async ({
    page,
  }) => {
    await page.goto("/calendar");
    await expect(page).toHaveURL(/\/login/);
  });

  test("admin redirects unauthenticated users to login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });

  test("settings redirects unauthenticated users to login", async ({
    page,
  }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/login/);
  });

  test("login preserves returnTo parameter", async ({ page }) => {
    await page.goto("/calendar");
    await expect(page).toHaveURL(/returnTo.*calendar/);
  });
});
