import { test, expect } from "@playwright/test";

test.describe("Accessibility", () => {
  test("skip-to-content link works", async ({ page }) => {
    await page.goto("/");

    // Press Tab to focus the skip link
    await page.keyboard.press("Tab");

    const skipLink = page.getByRole("link", { name: /skip to main content/i });
    await expect(skipLink).toBeFocused();

    // Activate it
    await page.keyboard.press("Enter");

    // Main content area should exist
    const main = page.locator("#main-content");
    await expect(main).toBeVisible();
  });

  test("login form has proper aria attributes on errors", async ({ page }) => {
    await page.goto("/login");

    // Submit empty form
    await page.getByRole("button", { name: /log in|sign in/i }).click();

    // Error messages should have role="alert"
    const alerts = page.locator("[role='alert']");
    await expect(alerts.first()).toBeVisible();

    // Email field should have aria-invalid
    const emailInput = page.getByLabel("Email");
    await expect(emailInput).toHaveAttribute("aria-invalid", "true");
  });
});
