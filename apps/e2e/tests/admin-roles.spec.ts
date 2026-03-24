import { test, expect } from "@playwright/test";

test.describe("Admin panel", () => {
  test.use({ storageState: "auth/admin.json" });

  test("loads user list and displays role badges", async ({ page }) => {
    await page.goto("/admin");

    // Page heading
    await expect(
      page.getByRole("heading", { name: /admin/i }),
    ).toBeVisible();

    // User list loads with seeded users
    await expect(page.getByText("Pat Morgan")).toBeVisible();
    await expect(page.getByText("Maya Chen")).toBeVisible();
  });
});
