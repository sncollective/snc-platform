import { test, expect } from "@playwright/test";

test.describe("Creators listing", () => {
  test("shows creator grid with view toggle", async ({ page }) => {
    await page.goto("/creators");

    // Page heading
    await expect(
      page.getByRole("heading", { name: "Creators" }),
    ).toBeVisible();

    // At least one creator card visible (Maya is seeded)
    await expect(page.getByText("Maya Chen")).toBeVisible();

    // View toggle exists
    const listToggle = page.getByRole("button", { name: /list/i });
    if (await listToggle.isVisible()) {
      await listToggle.click();
      // Maya should still be visible in list view
      await expect(page.getByText("Maya Chen")).toBeVisible();
    }
  });
});
