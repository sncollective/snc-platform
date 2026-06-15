import { test, expect } from "@playwright/test";

test.describe("Auth flow", () => {
  // A stable account, not a timestamped one. A timestamped email leaks a fresh
  // user row on every run; those accumulate in the dev DB and, since the admin
  // user list is newest-first with a page size of 20, eventually bury the seed
  // users and break admin-roles. The stable email registers once and is
  // re-used (login path) thereafter, so the suite never accumulates accounts.
  const testEmail = "e2e-register@snc.test";
  const testPassword = "testpass123";

  test("register, log out, and log back in", async ({ page }) => {
    // ── Register (or no-op if a prior run already created this account) ──
    await page.goto("/register");
    await page.getByLabel("Name").fill("E2E Test User");
    await page.getByLabel("Email").fill(testEmail);
    await page.getByLabel("Password").fill(testPassword);
    await page.getByRole("button", { name: "Create account" }).click();

    // First run: signup succeeds and redirects away. Subsequent runs: the
    // email is already taken, so registration stays on /register with an error.
    // Either way, end up authenticated on a non-register page before logout —
    // fall back to the login form when the account already exists.
    const userMenuButton = page.getByRole("button", { name: "User menu" });
    const stillOnRegister = await page
      .waitForURL((url) => !/\/register/.test(url.pathname), { timeout: 10000 })
      .then(() => false)
      .catch(() => true);

    if (stillOnRegister) {
      // Account already exists from a prior run — log in instead.
      await page.goto("/login");
      await page.getByLabel("Email").fill(testEmail);
      await page.getByLabel("Password").fill(testPassword);
      await page.getByRole("button", { name: "Log in" }).click();
      await expect(userMenuButton).toBeVisible({ timeout: 10000 });
    }

    // ── Log out ──
    await expect(userMenuButton).toBeVisible({ timeout: 10000 });
    await userMenuButton.click();

    // Log out is an Ark UI MenuItem (role=menuitem), not a button.
    const logoutButton = page.getByRole("menuitem", { name: "Log out" });
    await expect(logoutButton).toBeVisible();
    await logoutButton.click();

    // Should see login/signup links
    await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();

    // ── Log back in ──
    await page.goto("/login");
    await page.getByLabel("Email").fill(testEmail);
    await page.getByLabel("Password").fill(testPassword);
    await page.getByRole("button", { name: "Log in" }).click();

    // Should be redirected and see user menu
    await expect(userMenuButton).toBeVisible({ timeout: 10000 });
  });
});
