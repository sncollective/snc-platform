import { test, expect } from "@playwright/test";

test.describe("Navigation flow", () => {
  test.use({ storageState: "auth/stakeholder.json" });

  test("navigates between pages via nav links", async ({ page }) => {
    // Start at landing page
    await page.goto("/");

    // Navigate to Creators via nav bar
    const nav = page.getByRole("navigation", { name: "Main navigation" });
    await nav.getByRole("link", { name: "Creators" }).click();
    await expect(page).toHaveURL(/\/creators/);
    await expect(
      page.getByRole("heading", { name: "Creators" }),
    ).toBeVisible();

    // Click on Maya's profile
    await page.getByText("Maya Chen").first().click();
    await expect(page).toHaveURL(/\/creators\/maya-chen/);
    await expect(page.getByText("Maya Chen")).toBeVisible();
  });

  test("authenticated user sees user menu button", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "User menu" }),
    ).toBeVisible();
  });

  test("calendar page is accessible for stakeholders", async ({ page }) => {
    await page.goto("/calendar");
    await expect(
      page.getByRole("heading", { name: "Calendar", exact: true }),
    ).toBeVisible();
  });

  test("settings page is accessible for authenticated users", async ({ page }) => {
    await page.goto("/settings");
    await expect(
      page.getByRole("heading", { name: "Settings" }),
    ).toBeVisible();
  });
});
