import { test, expect } from "@playwright/test";

test.describe("Settings", () => {
  test.use({ storageState: "auth/subscriber.json" });

  test("loads settings page with change password form", async ({ page }) => {
    await page.goto("/settings");

    // Page heading
    await expect(
      page.getByRole("heading", { name: "Settings" }),
    ).toBeVisible();

    // Change password form fields
    await expect(
      page.getByRole("heading", { name: "Change password" }),
    ).toBeVisible();
    await expect(page.getByLabel(/current password/i)).toBeVisible();
    await expect(page.getByLabel(/new password/i).first()).toBeVisible();
  });
});
