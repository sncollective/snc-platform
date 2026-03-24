import { test, expect } from "@playwright/test";

test.describe("Auth flow", () => {
  const uniqueId = Date.now();
  const testEmail = `e2e-register-${uniqueId}@snc.test`;

  test("register, log out, and log back in", async ({ page }) => {
    // ── Register ──
    await page.goto("/register");
    await page.getByLabel("Name").fill("E2E Test User");
    await page.getByLabel("Email").fill(testEmail);
    await page.getByLabel("Password").fill("testpass123");
    await page.getByRole("button", { name: "Create account" }).click();

    // Should redirect away from register page after signup
    // Wait for navigation (the button changes to "Creating account..." then redirects)
    await expect(page).not.toHaveURL(/\/register/, { timeout: 10000 });

    // ── Log out ──
    const userMenuButton = page.getByRole("button", { name: "User menu" });
    await expect(userMenuButton).toBeVisible({ timeout: 10000 });
    await userMenuButton.click();

    const logoutButton = page.getByRole("button", { name: "Log out" });
    await expect(logoutButton).toBeVisible();
    await logoutButton.click();

    // Should see login/signup links
    await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();

    // ── Log back in ──
    await page.goto("/login");
    await page.getByLabel("Email").fill(testEmail);
    await page.getByLabel("Password").fill("testpass123");
    await page.getByRole("button", { name: "Log in" }).click();

    // Should be redirected and see user menu
    await expect(userMenuButton).toBeVisible({ timeout: 10000 });
  });
});
